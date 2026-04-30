// Detects rogue/conflicting DHCP servers by broadcasting a DISCOVER and
// watching for OFFERs from servers other than ourselves.
const dgram  = require('dgram');
const os     = require('os');
const packet = require('./packet');

function getLocalMac() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        return addr.mac;
      }
    }
  }
  return '00:11:22:33:44:55'; // fallback
}

function macToBuffer(mac) {
  const parts = mac.split(':').map(h => parseInt(h, 16));
  const buf   = Buffer.alloc(16);
  Buffer.from(parts).copy(buf);
  return buf;
}

/**
 * Sends a DHCPDISCOVER on the broadcast address and collects OFFER replies.
 * Returns { hasConflict: boolean, servers: [{ ip, from }] }
 */
function detectConflicts(ownServerIp, timeout = 5000) {
  return new Promise((resolve) => {
    const sock      = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const conflicts = [];
    let   timer;

    const finish = () => {
      clearTimeout(timer);
      try { sock.close(); } catch {}
      resolve({ hasConflict: conflicts.length > 0, servers: conflicts });
    };

    sock.on('error', finish);

    sock.on('message', (msg, rinfo) => {
      try {
        const pkt = packet.parse(msg);
        // We only care about OFFER replies from someone else
        if (pkt.op === 2 && pkt.msgType === packet.MSG_TYPES.OFFER) {
          const src = pkt.siaddr && pkt.siaddr !== '0.0.0.0' ? pkt.siaddr : rinfo.address;
          if (src !== ownServerIp && !conflicts.find(c => c.ip === src)) {
            conflicts.push({ ip: src, from: rinfo.address });
          }
        }
      } catch {}
    });

    sock.bind(CLIENT_PORT_DETECT, () => {
      try {
        sock.setBroadcast(true);
      } catch (e) {
        // May fail if already broadcast-enabled or insufficient rights
      }

      const xid      = (Math.random() * 0xFFFFFFFF) >>> 0;
      const chadrRaw = macToBuffer(getLocalMac());

      const discover = packet.build({
        op:       1,
        xid,
        flags:    0x8000, // request broadcast reply
        chadrRaw,
        options: {
          53: Buffer.from([packet.MSG_TYPES.DISCOVER]),
          55: Buffer.from([1, 3, 6, 51, 54])
        }
      });

      sock.send(discover, 0, discover.length, 67, '255.255.255.255', (err) => {
        if (err) return finish();
        timer = setTimeout(finish, timeout);
      });
    });
  });
}

// We listen on 68 to catch OFFER replies, but binding 68 also requires root.
// Use a high port as fallback so the rest of the app still runs.
const CLIENT_PORT_DETECT = 68;

module.exports = { detectConflicts };
