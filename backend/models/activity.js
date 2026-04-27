const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who did the action
  description: { type: String, required: true }, // what happened
  type: { type: String, default: 'general' }, // e.g. 'login', 'event', 'admin', etc.
  timestamp: { type: Date, default: Date.now }
});

// INDEXES - Enable admin audit trail and analytics
activitySchema.index({ user: 1, timestamp: -1 });    // User activity log
activitySchema.index({ type: 1, timestamp: -1 });    // Activity by type
activitySchema.index({ timestamp: -1 });              // All activities sorted

module.exports = mongoose.model('Activity', activitySchema);