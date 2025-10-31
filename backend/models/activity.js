const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who did the action
  description: { type: String, required: true }, // what happened
  type: { type: String, default: 'general' }, // e.g. 'login', 'event', 'admin', etc.
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activity', activitySchema);