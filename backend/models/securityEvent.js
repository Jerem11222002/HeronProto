const mongoose = require('mongoose');

const SecurityEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: [
      'failed_login',
      'suspicious_ip',
      'multiple_failed_attempts',
      'unusual_access_pattern',
      'privilege_escalation_attempt',
      'rate_limit_exceeded',
      'sql_injection_attempt',
      'xss_attempt',
      'csrf_violation',
      'token_theft',
      'session_hijacking',
      'brute_force',
      'account_lockout',
      'password_change',
      'permission_change',
      'data_export',
      'admin_action'
    ],
    required: true,
    index: true
  },
  
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Source information
  sourceIp: {
    type: String,
    index: true
  },
  userAgent: String,
  sessionId: String,
  
  // Location
  location: {
    country: String,
    city: String,
    region: String,
    latitude: Number,
    longitude: Number,
    isVpn: Boolean,
    isTor: Boolean
  },
  
  // Event details
  details: {
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resource: String, // affected resource
    action: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed
  },
  
  // Request context
  request: {
    method: String,
    url: String,
    headers: mongoose.Schema.Types.Mixed,
    query: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed
  },
  
  // Risk score
  riskScore: { type: Number, min: 0, max: 100 },
  
  // Related events (for chaining suspicious activities)
  relatedEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SecurityEvent'
  }],
  
  // Alert status
  alertSent: { type: Boolean, default: false },
  alertSentAt: Date,
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: Date,
  
  // Resolution
  resolved: { type: Boolean, default: false },
  resolvedAt: Date,
  resolution: String,
  
  // Automated response
  automatedAction: {
    type: String,
    enum: ['none', 'rate_limited', 'blocked', 'challenged', 'logged_out']
  },
  automatedActionAt: Date
}, {
  timestamps: true
});

// Indexes
SecurityEventSchema.index({ eventType: 1, timestamp: -1 });
SecurityEventSchema.index({ sourceIp: 1, timestamp: -1 });
SecurityEventSchema.index({ severity: 1, acknowledged: 1, timestamp: -1 });
SecurityEventSchema.index({ riskScore: -1 });

// Static methods
SecurityEventSchema.statics.getSecurityStats = async function(timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  const [byType, bySeverity, topIps, recent, unacknowledged] = await Promise.all([
    this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$sourceIp', count: { $sum: 1 }, events: { $push: '$eventType' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    this.find({ timestamp: { $gte: startDate } })
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('userId', 'username email'),
    this.countDocuments({ timestamp: { $gte: startDate }, acknowledged: false, severity: { $in: ['high', 'critical'] } })
  ]);
  
  return { byType, bySeverity, topIps, recent, unacknowledged };
};

SecurityEventSchema.statics.checkForBruteForce = async function(ip, userId, threshold = 5, window = 15) {
  const startDate = new Date(Date.now() - window * 60 * 1000);
  
  const attempts = await this.countDocuments({
    $or: [
      { sourceIp: ip, eventType: 'failed_login', timestamp: { $gte: startDate } },
      { userId, eventType: 'failed_login', timestamp: { $gte: startDate } }
    ]
  });
  
  return attempts >= threshold;
};

SecurityEventSchema.statics.getGeographicThreats = async function(timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  return this.aggregate([
    { 
      $match: { 
        timestamp: { $gte: startDate },
        'location.country': { $exists: true }
      } 
    },
    {
      $group: {
        _id: '$location.country',
        count: { $sum: 1 },
        events: { $sum: 1 },
        highRisk: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('SecurityEvent', SecurityEventSchema);
