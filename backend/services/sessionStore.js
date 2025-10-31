const dayjs = require('dayjs');

class SessionStore {
  constructor() {
    this.sessions = new Map(); // key = socketId -> { socketId, userId, username, device, ip, connectedAt, lastActive }
    this.activity = []; // simple list of { ts, count } snapshots (optional)
  }

  addSession(socketId, { userId, username, device, ip, isAdmin = false }) {
    const now = new Date();
    this.sessions.set(socketId, {
      socketId,
      userId,
      username,
      device,
      ip,
      isAdmin,
      connectedAt: now,
      lastActive: now,
      status: 'active'
    });
    return this.sessions.get(socketId);
  }

  removeSession(socketId) {
    const removed = this.sessions.get(socketId);
    this.sessions.delete(socketId);
    return removed;
  }

  touchSession(socketId) {
    const s = this.sessions.get(socketId);
    if (s) {
      s.lastActive = new Date();
      s.status = 'active';
    }
  }

  getSessions() {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.socketId,
      userId: s.userId,
      user: s.username,
      device: s.device,
      ip: s.ip,
      isAdmin: !!s.isAdmin,
      connectedAt: s.connectedAt,
      lastActive: s.lastActive,
      status: s.status,
      duration: Math.floor((Date.now() - new Date(s.connectedAt).getTime()) / 1000) + 's',
      activity: 'medium'
    }));
  }

  getSessionsByUser(userId) {
    return this.getSessions().filter(s => String(s.userId) === String(userId));
  }

  // Simple activity aggregation over last N hours
  getActivity({ hours = 24, buckets = 24 } = {}) {
    const now = dayjs();
    const bucketMs = (hours * 3600 * 1000) / buckets;
    const bucketsArr = new Array(buckets).fill(0);
    this.getSessions().forEach(s => {
      const age = now.diff(dayjs(s.connectedAt));
      const index = Math.floor((hours * 3600 * 1000 - age) / bucketMs);
      const idx = Math.max(0, Math.min(buckets - 1, index));
      bucketsArr[idx] = (bucketsArr[idx] || 0) + 1;
    });
    const labels = [];
    for (let i = 0; i < buckets; i++) {
      labels.push(now.subtract(((buckets - 1) - i) * (hours / buckets), 'hour').format('HH:mm'));
    }
    return labels.map((ts, i) => ({ timestamp: ts, users: bucketsArr[i] || 0 }));
  }
}

module.exports = new SessionStore();