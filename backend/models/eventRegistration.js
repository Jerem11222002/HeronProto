const mongoose = require('mongoose');
if (mongoose.models.EventRegistration) {
  console.error('❌ EventRegistration model was already registered! This means another file loaded it before this schema file.');
  delete mongoose.models.EventRegistration;
}

const eventRegistrationSchema = new mongoose.Schema({
  // Basic Information
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'waitlisted', 'canceled'],
    default: 'pending'
  },

  // Personal Information
  name: {
    type: String,
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: false
  },
  yearLevel: {
    type: String,
    required: false
  },
  course: {
    type: String,
    required: false
  },
  organization: {
    type: String,
    required: true
  },

  // Emergency Contact
  emergencyContact: {
    name: {
      type: String,
      required: false
    },
    relationship: {
      type: String,
      required: false
    },
    phone: {
      type: String,
      required: false
    }
  },

  // Event-specific Information
  experience: {
    type: String,
    default: ''
  },
  interests: {
    type: String,
    default: ''
  },
  expectations: {
    type: String,
    default: ''
  },
  previousParticipation: {
    type: Boolean,
    default: false
  },

  maxParticipants: {
    type: Number,
    default: null // null means unlimited participants
  },

  // Participation Details
  willingness: {
    rehearsals: {
      type: Boolean,
      default: false
    },
    performances: {
      type: Boolean,
      default: false
    },
    workshops: {
      type: Boolean,
      default: false
    }
  },

  // Additional Requirements
  dietary: {
    type: String,
    default: ''
  },
  requirements: {
    type: String,
    default: ''
  },

  // Metadata
  deviceInfo: {
    userAgent: String,
    platform: String,
    timeZone: String
  },

  // Administrative
  adminNotes: {
    type: String,
    default: ''
  },
  lastModified: {
    type: Date,
    default: Date.now
  },

  // Audition-specific fields
  auditionPiece: {
    type: String,
    default: ''
  },
  experienceYears: {
    type: String,
    default: ''
  },
  specialSkills: {
    type: String,
    default: ''
  },
  motivation: {
    type: String,
    default: ''
  },
  availability: {
    type: String,
    default: ''
  },
  uploadedFiles: [{
    name: String,
    url: String,
    type: String
  }],

  // Free-form storage for admin-created registration form answers
  formResponses: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Watch-only-specific fields
  reasonForWatching: {
    type: String,
    default: ''
  },
  attendedBefore: {
    type: String,
    default: ''
  },
  companion: {
    type: String,
    default: ''
  },
  accessibilityNeeds: {
    type: String,
    default: ''
  },

  // Verification fields
  verificationToken: {
    type: String,
    default: null
  },
  verified: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Add indexes for common queries
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventRegistrationSchema.index({ status: 1 });
eventRegistrationSchema.index({ registrationDate: -1 });

// TIER 2 INDEX - User registration history with status filter
eventRegistrationSchema.index({ userId: 1, status: 1, registrationDate: -1 });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);