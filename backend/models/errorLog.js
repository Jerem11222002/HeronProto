const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  timestamp: { type: Date, default: Date.now, index: true },
  
  errorType: {
    type: String,
    enum: ['frontend', 'backend', 'api', 'database', 'network', 'security', 'other'],
    required: true,
    index: true
  },
  
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  // Error details
  message: {
    type: String,
    required: true
  },
  stack: String,
  source: String, // filename
  line: Number,
  column: Number,
  
  // Context
  pageUrl: String,
  userAgent: String,
  componentStack: String, // React component stack
  
  // Request info (for API errors)
  request: {
    method: String,
    url: String,
    headers: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed
  },
  
  response: {
    status: Number,
    statusText: String,
    data: mongoose.Schema.Types.Mixed
  },
  
  // User context
  userActions: [{
    action: String,
    timestamp: Date,
    data: mongoose.Schema.Types.Mixed
  }], // Actions leading up to error
  
  // Resolution
  resolved: { type: Boolean, default: false },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolution: String,
  
  // Grouping for duplicate detection
  fingerprint: {
    type: String,
    index: true
  }, // Hash of error message + stack trace
  occurrenceCount: { type: Number, default: 1 },
  
  isAdmin: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes
ErrorLogSchema.index({ fingerprint: 1, timestamp: -1 });
ErrorLogSchema.index({ errorType: 1, severity: 1, timestamp: -1 });
ErrorLogSchema.index({ resolved: 1, severity: 1 });

// Static methods
ErrorLogSchema.statics.getErrorStats = async function(timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  const [byType, bySeverity, recent, topErrors] = await Promise.all([
    this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$errorType', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]),
    this.find({ timestamp: { $gte: startDate } })
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('userId', 'username email'),
    this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$fingerprint', count: { $sum: 1 }, message: { $first: '$message' }, severity: { $first: '$severity' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);
  
  return { byType, bySeverity, recent, topErrors };
};

ErrorLogSchema.statics.getTrend = async function(hours = 24) {
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: {
          hour: { $hour: '$timestamp' },
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
        },
        count: { $sum: 1 },
        critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
      }
    },
    { $sort: { '_id.date': 1, '_id.hour': 1 } }
  ]);
};

// Generate fingerprint before saving
ErrorLogSchema.pre('save', async function(next) {
  if (!this.fingerprint) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(this.message + (this.stack || '') + this.errorType);
    this.fingerprint = hash.digest('hex').substring(0, 16);
    
    // Check for existing error with same fingerprint
    const existing = await this.constructor.findOne({
      fingerprint: this.fingerprint,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });
    
    if (existing) {
      existing.occurrenceCount += 1;
      existing.timestamp = this.timestamp;
      await existing.save();
      // Skip saving this document
      const err = new Error('Duplicate error, merged with existing');
      err.isDuplicate = true;
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('ErrorLog', ErrorLogSchema);
