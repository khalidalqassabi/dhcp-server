// DHCP packet parser/builder — RFC 2131 / RFC 2132
const MAGIC_COOKIE = Buffer.from([99, 130, 83, 99]);

const MSG_TYPES = {
  DISCOVER: 1,
  OFFER:    2,
  REQUEST:  3,
  DECLINE:  4,
  ACK:      5,
  NAK:      6,
  RELEASE:  7,
  INFORM:   8
};

const MSG_TYPE_NAMES = Object.fromEntries(Object.entries(MSG_TYPES).map(([k, v]) => [v, k]));

function ipToBuffer(ip) {
  return Buffer.from(ip.split('.').map(n => parseInt(n, 10)));
}

function bufferToIp(buf, offset = 0) {
  return `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
}

function macToString(buf) {
  return Array.from(buf.slice(0, 6))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');
}

function parseOptions(buf, start) {
  const options = {};
  let i = start;
  while (i < buf.length) {
    const code = buf[i];
    if (code === 255) break;        // END
    if (code === 0)  { i++; continue; } // PAD
    const len = buf[i + 1];
    options[code] = buf.slice(i + 2, i + 2 + len);
    i += 2 + len;
  }
  return options;
}

function parse(buf) {
  if (buf.length < 240) throw new Error('Packet too short');

  // Verify magic cookie
  if (!buf.slice(236, 240).equals(MAGIC_COOKIE)) throw new Error('Bad magic cookie');

  const options = parseOptions(buf, 240);
  return {
    op:          buf[0],
    htype:       buf[1],
    hlen:        buf[2],
    hops:        buf[3],
    xid:         buf.readUInt32BE(4),
    secs:        buf.readUInt16BE(8),
    flags:       buf.readUInt16BE(10),
    ciaddr:      bufferToIp(buf, 12),
    yiaddr:      bufferToIp(buf, 16),
    siaddr:      bufferToIp(buf, 20),
    giaddr:      bufferToIp(buf, 24),
    chaddr:      macToString(buf.slice(28, 44)),
    chadrRaw:    buf.slice(28, 44),
    msgType:     options[53]  ? options[53][0]   : null,
    requestedIp: options[50]  ? bufferToIp(options[50]) : null,
    hostname:    options[12]  ? options[12].toString('ascii') : null,
    paramList:   options[55]  ? Array.from(options[55]) : [],
    options
  };
}

function build({ op, xid, flags, ciaddr, yiaddr, siaddr, chadrRaw, options = {} }) {
  const buf = Buffer.alloc(576);
  buf.fill(0);

  buf[0] = op || 2;
  buf[1] = 1;  // Ethernet
  buf[2] = 6;  // MAC length
  buf[3] = 0;

  buf.writeUInt32BE(xid >>> 0, 4);
  buf.writeUInt16BE(0, 8);
  buf.writeUInt16BE(flags || 0, 10);

  if (ciaddr) ipToBuffer(ciaddr).copy(buf, 12);
  if (yiaddr) ipToBuffer(yiaddr).copy(buf, 16);
  if (siaddr) ipToBuffer(siaddr).copy(buf, 20);
  if (chadrRaw) Buffer.from(chadrRaw).copy(buf, 28);

  MAGIC_COOKIE.copy(buf, 236);

  let i = 240;
  for (const [code, value] of Object.entries(options)) {
    const val = Buffer.isBuffer(value) ? value : Buffer.from(value);
    buf[i++] = parseInt(code, 10);
    buf[i++] = val.length;
    val.copy(buf, i);
    i += val.length;
  }
  buf[i] = 255; // END

  return buf.slice(0, Math.max(300, i + 1));
}

module.exports = { parse, build, ipToBuffer, bufferToIp, macToString, MSG_TYPES, MSG_TYPE_NAMES };
