const mongoose = require('mongoose');

const InterestSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true }, // e.g. 'film'
  name: { type: String, required: true }, // display name
  description: { type: String, default: '' },
  relatedTags: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approved: { type: Boolean, default: false }, // admin approval required?
  autoApproved: { type: Boolean, default: false }, // optional auto-approve flag
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

InterestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Interest', InterestSchema);