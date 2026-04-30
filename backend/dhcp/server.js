const dgram        = require('dgram');
const EventEmitter = require('events');
const packet       = require('./packet');
const IPPool       = require('./pool');

const SERVER_PORT = 67;
const CLIENT_PORT = 68;

class DHCPServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      serverIp:   config.serverIp   || '192.168.1.1',
      subnetMask: config.subnetMask || '255.255.255.0',
      router:     config.router     || '192.168.1.1',
      dns:        config.dns        || ['8.8.8.8', '8.8.4.4'],
      poolStart:  config.poolStart  || '192.168.1.100',
      poolEnd:    config.poolEnd    || '192.168.1.200',
      leaseTime:  config.leaseTime  || 86400,
      bindAddress: config.bindAddress || '0.0.0.0'
    };
    this.pool    = new IPPool(this.config.poolStart, this.config.poolEnd, this.config.leaseTime);
    this.socket  = null;
    this.running = false;
    this.logs    = [];
  }

  log(msg) {
    const entry = { time: new Date().toISOString(), msg };
    this.logs.push(entry);
    if (this.logs.length > 300) this.logs.shift();
    this.emit('log', entry);
  }

  start() {
    return new Promise((resolve, reject) => {
      if (this.running) return resolve();

      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.once('error', (err) => {
        this.log(`Socket error: ${err.message}`);
        this.emit('error', err);
        reject(err);
      });

      this.socket.on('message', (msg, rinfo) => {
        try { this.handlePacket(msg, rinfo); }
        catch (e) { this.log(`Parse error: ${e.message}`); }
      });

      this.socket.bind(SERVER_PORT, this.config.bindAddress, () => {
        try {
          this.socket.setBroadcast(true);
          this.running = true;
          this.log(`DHCP server listening on port ${SERVER_PORT}`);
          this.emit('started');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.running || !this.socket) return resolve();
      this.socket.close(() => {
        this.socket  = null;
        this.running = false;
        this.log('DHCP server stopped');
        this.emit('stopped');
        resolve();
      });
    });
  }

  handlePacket(msg, rinfo) {
    const pkt = packet.parse(msg);
    if (pkt.op !== 1) return; // only BOOTREQUEST

    const typeName = packet.MSG_TYPE_NAMES[pkt.msgType] || pkt.msgType;
    this.log(`← ${typeName} from ${pkt.chaddr}${pkt.hostname ? ' (' + pkt.hostname + ')' : ''}`);

    switch (pkt.msgType) {
      case packet.MSG_TYPES.DISCOVER: this.handleDiscover(pkt, rinfo); break;
      case packet.MSG_TYPES.REQUEST:  this.handleRequest(pkt, rinfo);  break;
      case packet.MSG_TYPES.RELEASE:  this.handleRelease(pkt);         break;
      case packet.MSG_TYPES.DECLINE:
        this.log(`DECLINE from ${pkt.chaddr} — marking IP as bad`);
        this.pool.release(pkt.chaddr);
        this.emit('leaseUpdate', this.pool.getLeases());
        break;
    }
  }

  handleDiscover(pkt, rinfo) {
    const offered = this.pool.allocate(pkt.chaddr, pkt.requestedIp, pkt.hostname);
    if (!offered) { this.log(`Pool exhausted — no IP for ${pkt.chaddr}`); return; }

    const reply = this.buildReply(pkt, offered, packet.MSG_TYPES.OFFER);
    this.sendPacket(reply, rinfo);
    this.log(`→ OFFER ${offered} → ${pkt.chaddr}`);
    this.emit('leaseUpdate', this.pool.getLeases());
  }

  handleRequest(pkt, rinfo) {
    const wanted = pkt.requestedIp || pkt.ciaddr;
    const lease  = this.pool.leases.get(pkt.chaddr);

    if (lease && lease.ip === wanted) {
      this.pool.allocate(pkt.chaddr, wanted, pkt.hostname);
      const reply = this.buildReply(pkt, wanted, packet.MSG_TYPES.ACK);
      this.sendPacket(reply, rinfo);
      this.log(`→ ACK ${wanted} → ${pkt.chaddr}`);
      this.emit('leaseUpdate', this.pool.getLeases());
    } else {
      const reply = this.buildNak(pkt);
      this.sendPacket(reply, rinfo);
      this.log(`→ NAK → ${pkt.chaddr}`);
    }
  }

  handleRelease(pkt) {
    this.pool.release(pkt.chaddr);
    this.log(`RELEASE from ${pkt.chaddr}`);
    this.emit('leaseUpdate', this.pool.getLeases());
  }

  buildReply(pkt, yiaddr, msgType) {
    const { serverIp, subnetMask, router, dns, leaseTime } = this.config;
    const lt = leaseTime;

    return packet.build({
      op:       2,
      xid:      pkt.xid,
      flags:    pkt.flags,
      yiaddr,
      siaddr:   serverIp,
      chadrRaw: pkt.chadrRaw,
      options: {
        53: Buffer.from([msgType]),
        54: packet.ipToBuffer(serverIp),
        51: Buffer.from([(lt>>>24)&0xff,(lt>>>16)&0xff,(lt>>>8)&0xff,lt&0xff]),
        58: Buffer.from([0,0,28,32]),   // T1 renewal:  2h
        59: Buffer.from([0,0,56,64]),   // T2 rebinding: ~3.5h
        1:  packet.ipToBuffer(subnetMask),
        3:  packet.ipToBuffer(router),
        6:  Buffer.concat(dns.map(d => packet.ipToBuffer(d)))
      }
    });
  }

  buildNak(pkt) {
    return packet.build({
      op:       2,
      xid:      pkt.xid,
      chadrRaw: pkt.chadrRaw,
      options: {
        53: Buffer.from([packet.MSG_TYPES.NAK]),
        54: packet.ipToBuffer(this.config.serverIp)
      }
    });
  }

  sendPacket(buf, rinfo) {
    const isAll = rinfo.address === '0.0.0.0' || rinfo.address === '255.255.255.255';
    const dest  = isAll ? '255.255.255.255' : rinfo.address;
    this.socket.send(buf, 0, buf.length, CLIENT_PORT, dest);
  }

  getStatus() {
    return {
      running: this.running,
      config:  this.config,
      leases:  this.pool.getLeases(),
      stats:   this.pool.getStats(),
      logs:    this.logs.slice(-50)
    };
  }

  async updateConfig(newConfig) {
    const wasRunning = this.running;
    if (wasRunning) await this.stop();
    this.config = { ...this.config, ...newConfig };
    this.pool   = new IPPool(this.config.poolStart, this.config.poolEnd, this.config.leaseTime);
    if (wasRunning) await this.start();
  }
}

module.exports = DHCPServer;
