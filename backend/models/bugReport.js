const mongoose = require('mongoose');

const BugReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  category: {
    type: String,
    required: true,
    enum: ['ui', 'performance', 'security', 'feature', 'bug', 'other'],
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in-progress', 'resolved', 'closed'],
    default: 'pending',
    index: true
  },
  // Resolution tracking
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  resolution: {
    notes: { type: String, default: '', maxlength: 2000 },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: { type: Date, default: null }
  },
  // User activity context at time of report
  sessionId: {
    type: String,
    default: null
  },
  pageUrl: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  // Notification tracking
  userNotified: {
    acknowledged: { type: Boolean, default: false },
    assigned: { type: Boolean, default: false },
    resolved: { type: Boolean, default: false },
    updated: { type: Boolean, default: false }
  },
  // Impact metrics
  impact: {
    affectedUsers: { type: Number, default: 1 },
    recurring: { type: Boolean, default: false },
    relatedReports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BugReport' }]
  },
  metadata: {
    ipAddress: { type: String, default: '' },
    browser: { type: String, default: '' },
    os: { type: String, default: '' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
BugReportSchema.index({ status: 1, severity: 1, createdAt: -1 });
BugReportSchema.index({ category: 1, status: 1 });
BugReportSchema.index({ assignedTo: 1, status: 1 });
BugReportSchema.index({ userId: 1, createdAt: -1 });

// Virtual for time elapsed
BugReportSchema.virtual('timeElapsed').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
});

// Static methods
BugReportSchema.statics.getStats = async function() {
  const total = await this.countDocuments();
  const byStatus = await this.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const bySeverity = await this.aggregate([
    { $match: { status: { $nin: ['resolved', 'closed'] } } },
    { $group: { _id: '$severity', count: { $sum: 1 } } }
  ]);
  const byCategory = await this.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  const unresolved = await this.countDocuments({ status: { $nin: ['resolved', 'closed'] } });
  const critical = await this.countDocuments({ severity: 'critical', status: { $nin: ['resolved', 'closed'] } });

  return {
    total,
    unresolved,
    critical,
    byStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
    bySeverity: Object.fromEntries(bySeverity.map(s => [s._id, s.count])),
    byCategory: Object.fromEntries(byCategory.map(c => [c._id, c.count]))
  };
};

BugReportSchema.statics.getUserReports = async function(userId) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .select('title category severity status resolution createdAt updatedAt')
    .lean();
};

BugReportSchema.statics.getPendingReports = async function() {
  return this.find({ status: { $nin: ['resolved', 'closed'] } })
    .populate('userId', 'username email name profilePic')
    .populate('assignedTo', 'username name')
    .sort({ severity: -1, createdAt: -1 })
    .lean();
};

module.exports = mongoose.model('BugReport', BugReportSchema);
