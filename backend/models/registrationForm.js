const mongoose = require('mongoose');

if (mongoose.models.RegistrationForm) {
  delete mongoose.models.RegistrationForm;
}

const FieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true, enum: ['text','textarea','number','select','checkbox','multicheck','date','time','file','email','tel'] },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  options: { type: [String], default: [] }, // for select / multicheck
  validation: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { min, max, pattern, message, multiple, accept, maxFiles }
  meta: { type: mongoose.Schema.Types.Mixed, default: {} } // ui hints (order, helpText, group, etc.)
}, { _id: false });

const RegistrationFormSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. "Battle of the Bands - Audition"
  description: { type: String, default: '' },
  organization: { type: String, default: '' }, // optional organization scope
  eventType: { type: String, enum: ['watch-only','audition','generic'], default: 'generic' },
  schema: { type: [FieldSchema], default: [] },
  visibility: { type: String, enum: ['global','organization','private'], default: 'organization' },
  isDefault: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  tags: { type: [String], default: [] }
}, {
  timestamps: true
});

// Indexes for quick lookup
RegistrationFormSchema.index({ organization: 1, eventType: 1, name: 1 });
RegistrationFormSchema.index({ visibility: 1, isDefault: -1 });

module.exports = mongoose.model('RegistrationForm', RegistrationFormSchema);