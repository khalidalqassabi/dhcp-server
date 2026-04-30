const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const http       = require('http');
const WebSocket  = require('ws');
const DHCPServer = require('./dhcp/server');
const { detectConflicts } = require('./dhcp/detector');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'dhcp-secret-change-in-prod';
const PORT       = process.env.PORT || 3000;

// Single admin account — replace with a database in production
const ADMIN = {
  username:     'admin',
  passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10)
};

app.use(cors());
app.use(express.json());

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── DHCP server instance ───────────────────────────────────────────────────────
const dhcp = new DHCPServer({
  serverIp:   process.env.SERVER_IP   || '192.168.1.1',
  subnetMask: process.env.SUBNET_MASK || '255.255.255.0',
  router:     process.env.ROUTER      || '192.168.1.1',
  dns:        (process.env.DNS || '8.8.8.8,8.8.4.4').split(','),
  poolStart:  process.env.POOL_START  || '192.168.1.100',
  poolEnd:    process.env.POOL_END    || '192.168.1.200',
  leaseTime:  parseInt(process.env.LEASE_TIME || '86400', 10)
});

// ── WebSocket broadcast ────────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

dhcp.on('log',         entry  => broadcast({ type: 'log',    data: entry }));
dhcp.on('leaseUpdate', leases => broadcast({ type: 'leases', data: leases }));
dhcp.on('started',     ()     => broadcast({ type: 'status', data: { running: true  } }));
dhcp.on('stopped',     ()     => broadcast({ type: 'status', data: { running: false } }));

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url?.split('?')[1]);
  const token  = params.get('token');
  try {
    jwt.verify(token, JWT_SECRET);
    ws.send(JSON.stringify({ type: 'connected', data: dhcp.getStatus() }));
  } catch {
    ws.close(1008, 'Unauthorized');
  }
});

// ── REST routes ────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });

  if (username !== ADMIN.username || !bcrypt.compareSync(password, ADMIN.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username });
});

app.get('/api/dhcp/status', requireAuth, (_req, res) => {
  res.json(dhcp.getStatus());
});

app.post('/api/dhcp/start', requireAuth, async (_req, res) => {
  try {
    await dhcp.start();
    res.json({ success: true, message: 'DHCP server started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dhcp/stop', requireAuth, async (_req, res) => {
  try {
    await dhcp.stop();
    res.json({ success: true, message: 'DHCP server stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dhcp/detect', requireAuth, async (_req, res) => {
  try {
    const result = await detectConflicts(dhcp.config.serverIp);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/dhcp/config', requireAuth, async (req, res) => {
  try {
    await dhcp.updateConfig(req.body);
    res.json({ success: true, config: dhcp.config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dhcp/leases/:mac', requireAuth, (req, res) => {
  dhcp.pool.release(decodeURIComponent(req.params.mac));
  broadcast({ type: 'leases', data: dhcp.pool.getLeases() });
  res.json({ success: true });
});

// ── Start HTTP/WS server ───────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n┌─────────────────────────────────────────────┐`);
  console.log(`│  DHCP Server API running on port ${PORT}        │`);
  console.log(`│  Default credentials: admin / admin123       │`);
  console.log(`│  ⚠️  Binding UDP port 67 requires sudo/root  │`);
  console.log(`└─────────────────────────────────────────────┘\n`);
});
