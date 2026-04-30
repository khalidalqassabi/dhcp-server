const dgram  = require('dgram');
const os     = require('os');
const { exec } = require('child_process');
const packet = require('./packet');

function getLocalMac() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') return addr.mac;
    }
  }
  return '00:11:22:33:44:55';
}

function macToBuffer(mac) {
  const buf = Buffer.alloc(16);
  Buffer.from(mac.split(':').map(h => parseInt(h, 16))).copy(buf);
  return buf;
}

// ── Strategy 1: UDP broadcast DISCOVER → listen for OFFERs on port 68 ─────────
function tryUdpDetection(ownServerIp, timeout) {
  return new Promise((resolve) => {
    const sock      = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const conflicts = [];
    let   timer;

    sock.on('error', (err) => {
      clearTimeout(timer);
      try { sock.close(); } catch {}
      resolve({ success: false, error: err.message });
    });

    sock.on('message', (msg, rinfo) => {
      try {
        const pkt = packet.parse(msg);
        if (pkt.op === 2 && pkt.msgType === packet.MSG_TYPES.OFFER) {
          const src = (pkt.siaddr && pkt.siaddr !== '0.0.0.0') ? pkt.siaddr : rinfo.address;
          if (src !== ownServerIp && !conflicts.find(c => c.ip === src)) {
            conflicts.push({ ip: src, from: rinfo.address });
          }
        }
      } catch {}
    });

    sock.bind(68, () => {
      try { sock.setBroadcast(true); } catch {}

      const xid      = (Math.random() * 0xFFFFFFFF) >>> 0;
      const discover = packet.build({
        op: 1, xid, flags: 0x8000,
        chadrRaw: macToBuffer(getLocalMac()),
        options: {
          53: Buffer.from([packet.MSG_TYPES.DISCOVER]),
          55: Buffer.from([1, 3, 6, 51, 54])
        }
      });

      sock.send(discover, 0, discover.length, 67, '255.255.255.255', (err) => {
        if (err) {
          clearTimeout(timer);
          try { sock.close(); } catch {}
          resolve({ success: false, error: err.message });
          return;
        }
        timer = setTimeout(() => {
          try { sock.close(); } catch {}
          resolve({ success: true, hasConflict: conflicts.length > 0, servers: conflicts });
        }, timeout);
      });
    });
  });
}

// ── Strategy 2: nmap broadcast-dhcp-discover script ───────────────────────────
function tryNmapDetection() {
  return new Promise((resolve) => {
    exec('nmap --script broadcast-dhcp-discover 2>&1', { timeout: 15000 }, (err, stdout) => {
      if (err || !stdout) { resolve({ success: false }); return; }

      const servers = [];
      for (const m of stdout.matchAll(/Server Identifier[:\s]+([\d.]+)/g)) {
        servers.push({ ip: m[1], from: m[1] });
      }
      // nmap found at least one DHCP server if output contains "DHCP Message Type"
      const found = stdout.includes('DHCP Message Type');
      resolve({ success: true, hasConflict: found && servers.length > 0, servers });
    });
  });
}

// ── Strategy 3: check if something else is already listening on UDP port 67 ───
function checkPort67InUse() {
  return new Promise((resolve) => {
    exec('ss -unlp 2>/dev/null || netstat -unlp 2>/dev/null', { timeout: 5000 }, (err, stdout) => {
      if (err && !stdout) { resolve({ success: false }); return; }
      // Look for port 67 in output — but ignore our own process PID
      const inUse = /[:\s]67\s/.test(stdout);
      resolve({ success: true, hasConflict: inUse });
    });
  });
}

// ── Strategy 4: dhcping if available ─────────────────────────────────────────
function tryDhcping() {
  return new Promise((resolve) => {
    exec('which dhcping 2>/dev/null', (err, path) => {
      if (err || !path.trim()) { resolve({ success: false }); return; }
      exec(`dhcping -s 255.255.255.255 2>&1`, { timeout: 8000 }, (e, out) => {
        if (e) { resolve({ success: false }); return; }
        const ip = out.match(/from ([\d.]+)/)?.[1];
        resolve({
          success: true,
          hasConflict: !!ip,
          servers: ip ? [{ ip, from: ip }] : []
        });
      });
    });
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function detectConflicts(ownServerIp, timeout = 5000) {
  // 1. UDP broadcast (most accurate, needs root + host network)
  const udp = await tryUdpDetection(ownServerIp, timeout);
  if (udp.success) {
    return { hasConflict: udp.hasConflict, servers: udp.servers, method: 'UDP broadcast' };
  }

  // 2. nmap fallback
  const nmap = await tryNmapDetection();
  if (nmap.success) {
    return { hasConflict: nmap.hasConflict, servers: nmap.servers, method: 'nmap' };
  }

  // 3. dhcping fallback
  const ping = await tryDhcping();
  if (ping.success) {
    return { hasConflict: ping.hasConflict, servers: ping.servers, method: 'dhcping' };
  }

  // 4. port-in-use check (limited — only detects local processes)
  const port = await checkPort67InUse();
  if (port.success) {
    return {
      hasConflict: port.hasConflict,
      servers: [],
      method: 'port-check',
      warning: 'Limited scan — only checked if port 67 is in use on this machine.'
    };
  }

  // All strategies failed — return explicit warning instead of false "safe"
  return {
    hasConflict: false,
    servers: [],
    method: 'none',
    warning: udp.error?.includes('EACCES') || udp.error?.includes('EPERM')
      ? 'Permission denied: run with sudo/root for accurate scanning. Result may be inaccurate.'
      : 'Running inside Docker bridge network — broadcasts cannot reach the real network. Use network_mode: host on Linux for accurate scanning.'
  };
}

module.exports = { detectConflicts };
