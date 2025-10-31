const mongoose = require('mongoose');

const EventArchiveSchema = new mongoose.Schema({
  originalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: Date.now, index: true },
  eventData: { type: mongoose.Schema.Types.Mixed, required: true }, // full snapshot of the original event
  reason: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('EventArchive', EventArchiveSchema);