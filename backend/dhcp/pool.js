class IPPool {
  constructor(start, end, leaseTime = 86400) {
    this.startNum = this._toNum(start);
    this.endNum   = this._toNum(end);
    this.leaseTime = leaseTime;
    this.leases    = new Map(); // mac  -> { ip, expiry, hostname, assignedAt }
    this.usedIPs   = new Map(); // ip   -> mac
  }

  _toNum(ip) {
    return ip.split('.').reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0) >>> 0;
  }

  _toIp(num) {
    return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.');
  }

  _assign(mac, ip, hostname) {
    const expiry = Date.now() + this.leaseTime * 1000;
    this.leases.set(mac, { ip, expiry, hostname: hostname || '', assignedAt: new Date().toISOString() });
    this.usedIPs.set(ip, mac);
  }

  allocate(mac, requestedIp = null, hostname = null) {
    // Renew existing lease
    if (this.leases.has(mac)) {
      const lease = this.leases.get(mac);
      lease.expiry = Date.now() + this.leaseTime * 1000;
      if (hostname) lease.hostname = hostname;
      return lease.ip;
    }

    // Try requested IP
    if (requestedIp) {
      const num = this._toNum(requestedIp);
      if (num >= this.startNum && num <= this.endNum && !this.usedIPs.has(requestedIp)) {
        this._assign(mac, requestedIp, hostname);
        return requestedIp;
      }
    }

    // Next free IP
    for (let num = this.startNum; num <= this.endNum; num++) {
      const ip = this._toIp(num);
      if (!this.usedIPs.has(ip)) {
        this._assign(mac, ip, hostname);
        return ip;
      }
    }
    return null; // pool exhausted
  }

  release(mac) {
    const lease = this.leases.get(mac);
    if (lease) {
      this.usedIPs.delete(lease.ip);
      this.leases.delete(mac);
    }
  }

  cleanExpired() {
    const now = Date.now();
    for (const [mac, lease] of this.leases) {
      if (lease.expiry < now) {
        this.usedIPs.delete(lease.ip);
        this.leases.delete(mac);
      }
    }
  }

  getLeases() {
    this.cleanExpired();
    return Array.from(this.leases.entries()).map(([mac, l]) => ({
      mac,
      ip:         l.ip,
      hostname:   l.hostname,
      expiry:     new Date(l.expiry).toISOString(),
      assignedAt: l.assignedAt
    }));
  }

  getStats() {
    this.cleanExpired();
    const total = this.endNum - this.startNum + 1;
    const used  = this.leases.size;
    return { total, used, available: total - used };
  }
}

module.exports = IPPool;
