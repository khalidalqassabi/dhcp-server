const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const http       = require('http');
const WebSocket  = require('ws');
const fs         = require('fs');
const path       = require('path');
const DHCPServer = require('./dhcp/server');
const { detectConflicts } = require('./dhcp/detector');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'dhcp-secret-change-in-prod';
const PORT       = process.env.PORT || 3000;
const CREDS_PATH = path.join(__dirname, 'data', 'credentials.json');

// ── Credentials persistence ────────────────────────────────────────────────────
function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  } catch {
    const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 12);
    const initial = { passwordHash, passwordVersion: 1 };
    saveCredentials(initial);
    return initial;
  }
}

function saveCredentials(data) {
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  const tmp = CREDS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, CREDS_PATH);
}

let creds = loadCredentials();

// ── Rate limiter (change-password brute-force protection) ──────────────────────
const rateLimiter = { failCount: 0, lockedUntil: 0 };

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.passwordVersion !== creds.passwordVersion)
      return res.status(401).json({ error: 'Session expired, please log in again' });
    req.user = decoded;
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
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.passwordVersion !== creds.passwordVersion)
      return ws.close(1008, 'Session expired');
    ws.send(JSON.stringify({ type: 'connected', data: dhcp.getStatus() }));
  } catch {
    ws.close(1008, 'Unauthorized');
  }
});

// ── REST routes ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors());

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });

  if (username !== 'admin' || !bcrypt.compareSync(password, creds.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { username, passwordVersion: creds.passwordVersion },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token, username });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  if (Date.now() < rateLimiter.lockedUntil) {
    const retryAfter = Math.ceil((rateLimiter.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${retryAfter} seconds.`
    });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });

  if (!bcrypt.compareSync(currentPassword, creds.passwordHash)) {
    rateLimiter.failCount++;
    if (rateLimiter.failCount >= 5)
      rateLimiter.lockedUntil = Date.now() + 15 * 60 * 1000;
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  creds = {
    passwordHash:    bcrypt.hashSync(newPassword, 12),
    passwordVersion: creds.passwordVersion + 1,
  };
  saveCredentials(creds);
  rateLimiter.failCount  = 0;
  rateLimiter.lockedUntil = 0;
  res.json({ success: true });
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
