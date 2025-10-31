const mongoose = require("mongoose");
const { VALID_INTERESTS } = require('../utils/constants');

// Organization constants
const VALID_ORGANIZATIONS = [
  'CAST',
  'CULTURA',
  'UMAK Jammers',
  'UMAK Chorale',
  'UMAK Dance Extreme',
  'UMAK Siglahi',
  'UMAK Brass Band',
  'UTPC' // Added missing organization
];

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      index: 'text'
    },
    description: {
      type: String,
      required: true,
      index: 'text'
    },
    date: {
      type: Date,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    organization: {
      type: String,
      required: true,
      enum: VALID_ORGANIZATIONS,
      validate: {
        validator: function(org) {
          return VALID_ORGANIZATIONS.includes(org);
        },
        message: props => `${props.value} is not a valid organization`
      }
    },
    location: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming'
    },
    // --- NEW: Event Type, Requirements, Ticketing ---
    eventType: {
      type: String,
      enum: ['watch-only', 'audition'],
      required: true,
      default: 'watch-only'
    },
    requirements: {
      videoRequired: { type: Boolean, default: false },
      photoRequired: { type: Boolean, default: false },
      experienceRequired: { type: Boolean, default: false },
      additionalRequirements: { type: String, default: '' },
      maxParticipants: { type: Number, default: null }
    },
    ticketing: {
      isPaid: { type: Boolean, default: false },
      price: { type: Number, default: 0 },
      availableSeats: { type: Number, default: 0 }
    },
    // --- END NEW ---
    createdBy: {  // This is the correct field name
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    
    // Enhanced user interaction tracking
    interested: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now }
    }],
    registrations: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now },
      status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending'
      }
    }],
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    maxParticipants: {
      type: Number,
      default: null
    },

    // Enhanced recommendation system fields
    tags: {
      type: [String],
      default: [],
      // REMOVE the validator so there is no fixed limit
      // validate: {
      //   validator: function(tags) {
      //     return tags.length <= 5;
      //   },
      //   message: 'Maximum 5 tags allowed'
      // }
    },
    engagementMetrics: {
      views: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      interested: { type: Number, default: 0 },
      registrations: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
      clickThrough: { type: Number, default: 0 },
      timeSpent: { type: Number, default: 0 },
      bounceRate: { type: Number, default: 0 },
      registrationConversion: { type: Number, default: 0 }
    },
    primaryInterest: {
      type: String,
      required: false,
      enum: VALID_INTERESTS, // use canonical list
      default: function() {
        const orgMappings = {
          'CAST': 'theatre',
          'CULTURA': 'cultural-arts',
          'UMAK Jammers': 'music',
          'UMAK Chorale': 'music',
          'UMAK Dance Extreme': 'dance',
          'UMAK Siglahi': 'dance',
          'UMAK Brass Band': 'music',
          'UTPC': 'visual-arts'
        };
        return orgMappings[this.organization] || 'cultural-arts';
      }
    },
    relatedInterests: [{
      type: String,
      enum: VALID_INTERESTS
    }],

    // Time-based relevance fields
    eventDuration: {
      type: Number, // in minutes
      required: false
    },
    recurrence: {
      type: String,
      enum: ['one-time', 'daily', 'weekly', 'monthly'],
      default: 'one-time'
    },
    series: {
      isPartOfSeries: { type: Boolean, default: false },
      seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventSeries' }
    },

    // Social proof metrics
    socialProof: {
      recentRegistrations: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date }
      }],
      recentInteractions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        type: { type: String, enum: ['view', 'interest', 'share'] },
        timestamp: { type: Date }
      }]
    },

    // New fields for enhanced recommendations
    contentVector: {
      type: [Number],
      default: [],
      select: false
    },

    visibility: {
      type: String,
      enum: ['public', 'organization-only', 'invite-only'],
      default: 'public',
      index: true
    },

    targetAudience: {
      interests: [String],
      yearLevels: [String],
      colleges: [String],
      preferredGroupSize: {
        min: { type: Number, default: null },
        max: { type: Number, default: null }
      }
    },

    // Canonical embedded registration form schema (snapshot used by the frontend)
    registrationForm: {
      type: [
        new mongoose.Schema({
          key: { type: String, required: true },
          label: { type: String, required: true },
          type: { type: String, enum: ['text','textarea','number','select','checkbox','multicheck','date','time','file','email','tel'], required: true },
          required: { type: Boolean, default: false },
          placeholder: { type: String, default: '' },
          hint: { type: String, default: '' },
          options: { type: [String], default: [] },
          validation: { type: mongoose.Schema.Types.Mixed, default: {} },
          meta: { type: mongoose.Schema.Types.Mixed, default: {} }
        }, { _id: false })
      ],
      default: []
    },

    // optional link to a reusable template
    registrationFormTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationForm', default: null }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Auto-generate tags and interests based on organization
EventSchema.pre('save', function(next) {
  const orgMappings = {
    'CAST': {
      primary: 'theatre',
      tags: ['drama', 'acting', 'stage-performance'],
      related: ['performance', 'cultural-arts']
    },
    'CULTURA': {
      primary: 'cultural-arts',
      tags: ['dance', 'music', 'performance'],
      related: ['traditional-arts', 'theatre']
    },
    'UMAK Jammers': {
      primary: 'music',
      tags: ['band', 'modern-music', 'performance'],
      related: ['cultural-arts']
    },
    'UMAK Chorale': {
      primary: 'music',
      tags: ['choir', 'vocal-arts', 'performance'],
      related: ['cultural-arts']
    },
    'UMAK Dance Extreme': {
      primary: 'dance',
      tags: ['modern-dance', 'choreography', 'performance'],
      related: ['cultural-arts']
    },
    'UMAK Siglahi': {
      primary: 'dance',
      tags: ['folk-dance', 'traditional-arts', 'cultural'],
      related: ['cultural-arts', 'theatre']
    },
    'UMAK Brass Band': {
      primary: 'music',
      tags: ['instruments', 'band', 'performance'],
      related: ['cultural-arts']
    },
    'UTPC': {
      primary: 'visual-arts',
      tags: ['visual-arts', 'performance', 'technical-production', 'multimedia'],
      related: ['performance', 'digital-art']
    }
  };

  if (this.isModified('organization') || !this.tags.length) {
    const orgInfo = orgMappings[this.organization];
    if (orgInfo) {
      this.primaryInterest = orgInfo.primary;
      this.relatedInterests = orgInfo.related;
      this.tags = [...new Set([
        ...orgInfo.tags,
        this.category.toLowerCase(),
        orgInfo.primary,
        ...(this.tags || []),
        ...orgInfo.related
      ])];
    }
  }
  next();
});

// Virtual for engagement score
EventSchema.virtual('engagementScore').get(function() {
  const { views, shares, interested, registrations } = this.engagementMetrics;
  return (
    (views * 0.2) + 
    (shares * 0.3) + 
    (interested * 0.2) + 
    (registrations * 0.3)
  );
});

// Virtual for participation rate
EventSchema.virtual('participationRate').get(function() {
  if (!this.maxParticipants) return null;
  return (this.participants.length / this.maxParticipants) * 100;
});

// Updated recommendation score calculation
EventSchema.virtual('recommendationScore').get(function() {
  const weights = {
    timeRelevance: 0.35,
    popularity: 0.25,
    completion: 0.15,
    conversion: 0.15,
    targeting: 0.10
  };

  const timeRelevance = this.calculateTimeRelevance();
  const popularity = this.calculatePopularityScore();
  const completion = this.engagementMetrics.completionRate || 0;
  const conversion = this.engagementMetrics.registrationConversion || 0;
  const targetingScore = this.calculateTargetingScore();

  return (
    (timeRelevance * weights.timeRelevance) +
    (popularity * weights.popularity) +
    (completion * weights.completion) +
    (conversion * weights.conversion) +
    (targetingScore * weights.targeting)
  );
});

EventSchema.methods.calculateTimeRelevance = function() {
  const now = new Date();
  const eventDate = new Date(this.date);
  const daysUntil = (eventDate - now) / (1000 * 60 * 60 * 24);

  switch (this.status) {
    case 'ongoing': return 1.0;
    case 'upcoming':
      if (daysUntil <= 1) return 0.9;
      if (daysUntil <= 3) return 0.8;
      if (daysUntil <= 7) return 0.7;
      return Math.max(0.3, 1 - (daysUntil / 30));
    case 'completed': return 0;
    default: return 0;
  }
};

EventSchema.methods.calculatePopularityScore = function() {
  const { views, interested, registrations } = this.engagementMetrics;
  const maxScore = Math.max(views / 100, interested / 20, registrations / 10);
  return Math.min(1, maxScore);
};

EventSchema.methods.calculateTargetingScore = function() {
  // Will be implemented based on user context
  return 0.5; // Default score
};

// Indexes for efficient querying
EventSchema.index({ organization: 1 });
EventSchema.index({ tags: 1 });
EventSchema.index({ date: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ primaryInterest: 1 });
EventSchema.index({ 'engagementMetrics.views': -1 });
EventSchema.index({ 'socialProof.recentRegistrations.timestamp': -1 });
EventSchema.index({ 'socialProof.recentInteractions.timestamp': -1 });
EventSchema.index({ 'series.seriesId': 1 });
EventSchema.index({ recommendationScore: -1 });
EventSchema.index({ visibility: 1, status: 1, recommendationScore: -1 });
EventSchema.index({ 'targetAudience.interests': 1, date: 1 });

module.exports = mongoose.model("Event", EventSchema);