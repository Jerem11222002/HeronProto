const mongoose = require('mongoose');

const UserSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true  // Unique index to prevent duplicates
  },
  ipAddress: {
    type: String,
    index: true
  },
  userAgent: String,
  device: {
    type: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'], default: 'unknown' },
    browser: String,
    os: String,
    screenResolution: String
  },
  location: {
    country: String,
    city: String,
    region: String,
    latitude: Number,
    longitude: Number
  },
  entryPage: String,
  exitPage: String,
  pageViews: [{
    url: String,
    timestamp: { type: Date, default: Date.now },
    duration: Number, // seconds spent on page
    scrollDepth: Number // percentage scrolled
  }],
  interactions: [{
    type: { type: String, enum: ['click', 'scroll', 'form_start', 'form_submit', 'hover'] },
    target: String, // element clicked/hovered
    pageUrl: String,
    timestamp: { type: Date, default: Date.now },
    data: mongoose.Schema.Types.Mixed // additional interaction data
  }],
  status: {
    type: String,
    enum: ['active', 'idle', 'terminated', 'completed'],
    default: 'active'
  },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  duration: Number, // total session duration in seconds
  lastActivity: { type: Date, default: Date.now },
  isAdmin: { type: Boolean, default: false },
  metadata: {
    referrer: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
UserSessionSchema.index({ startTime: -1 });
UserSessionSchema.index({ userId: 1, startTime: -1 });
UserSessionSchema.index({ status: 1, startTime: -1 });
UserSessionSchema.index({ 'location.country': 1 });
UserSessionSchema.index({ 'device.type': 1 });
// TTL index to auto-delete sessions after 7 days
UserSessionSchema.index({ startTime: 1 }, { expireAfterSeconds: 604800 });

// Static methods
UserSessionSchema.statics.getActiveSessions = async function() {
  // Clean up stale sessions first (no activity in last 30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  console.log(`[Session Cleanup] Checking for sessions older than: ${thirtyMinutesAgo}`);
  
  // Find stale sessions first
  const staleSessions = await this.find({
    status: 'active',
    lastActivity: { $lt: thirtyMinutesAgo }
  });
  
  console.log(`[Session Cleanup] Found ${staleSessions.length} stale sessions`);
  
  // Update each stale session individually to calculate duration properly
  for (const session of staleSessions) {
    console.log(`[Session Cleanup] Marking session ${session.sessionId?.substring(0,8)} as completed`);
    session.status = 'completed';
    session.endTime = new Date();
    // Calculate duration from start to last activity (not thirtyMinutesAgo)
    session.duration = Math.round((session.lastActivity - session.startTime) / 1000);
    await session.save();
  }
  
  const active = await this.find({ status: 'active' })
    .populate('userId', 'username email name profilePic')
    .sort({ lastActivity: -1 });
  
  console.log(`[Session Cleanup] Returning ${active.length} active sessions`);
  return active;
};

UserSessionSchema.statics.getSessionStats = async function(timeRange = 24) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  // Use lastActivity instead of startTime to capture all active sessions in the time window
  const stats = await this.aggregate([
    { $match: { lastActivity: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        avgDuration: { $avg: '$duration' },
        deviceBreakdown: { $push: '$device.type' }
      }
    }
  ]);
  
  return stats[0] || { totalSessions: 0, uniqueUsers: [], avgDuration: 0 };
};

UserSessionSchema.methods.endSession = async function() {
  this.endTime = new Date();
  this.duration = Math.round((this.endTime - this.startTime) / 1000);
  this.status = 'completed';
  return this.save();
};

// Static method to clean up very old active sessions
UserSessionSchema.statics.cleanupStaleSessions = async function() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const result = await this.updateMany(
    {
      status: 'active',
      startTime: { $lt: oneDayAgo }
    },
    {
      $set: {
        status: 'completed',
        endTime: new Date()
      }
    }
  );
  
  return result.modifiedCount;
};

module.exports = mongoose.model('UserSession', UserSessionSchema);
