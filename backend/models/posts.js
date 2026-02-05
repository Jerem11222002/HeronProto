const mongoose = require("mongoose");
const path = require('path');

const PostSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId,  // Ensure this is ObjectId
      ref: 'User',
      required: true,
      index: true
    },
    name: { 
      type: String, 
      required: true 
    },
    profilePic: { 
      type: String,
      default: null
    },
    desc: { 
      type: String, 
      required: false,
      default: "",
      trim: true,
      index: 'text'
    },
    media: { 
      type: String,
      default: null,
      get: function(media) {
        if (!media) return null;
        if (media.startsWith('http')) return media;
        return `/uploads/${media.split(/[\/\\]/).pop()}`;
      }
    },
    mediaArray: {
      type: [{
        url: {
          type: String,
          required: true
        },
        type: {
          type: String,
          enum: ['image', 'video'],
          required: true
        },
        size: {
          type: Number,
          default: 0
        },
        duration: {
          type: Number,
          default: 0
        },
        thumbnail: {
          type: String,
          default: null
        }
      }],
      default: []
    },
    mediaCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    mediaType: {
      type: String,
      enum: ["image", "video", null],
      default: null,
      validate: {
        validator: function(v) {
          if (v === null) return !this.media;
          if (v === "video") return this.media && !this.media.match(/\.(jpg|jpeg|png|gif|avif)$/i);
          if (v === "image") return this.media && this.media.match(/\.(jpg|jpeg|png|gif|avif)$/i);
          return false;
        },
        message: 'Invalid media type for the given file'
      }
    },
    videoMetadata: {
      type: {
        duration: { type: Number, default: 0 },
        thumbnail: { type: String, default: null },
        quality: { type: String, default: 'original' },
        size: { type: Number, default: 0 },
        thumbnailBlob: { type: String, default: null } // Add this field
      },
      default: () => ({
        duration: 0,
        thumbnail: null,
        quality: 'original',
        size: 0,
        thumbnailBlob: null
      }),
      required: false
    },
    sharedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    likes: { 
      type: [mongoose.Schema.Types.ObjectId],  // Ensure this is ObjectId
      ref: 'User',
      default: [],
      index: true
    },
    comments: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Comment" 
    }],
    tags: {
      type: [String],
      default: [],
      index: true,
      validate: {
        validator: function(v) {
          return v.length <= 5;
        },
        message: 'Posts cannot have more than 5 tags'
      }
    },
    organization: {
      type: String,
      sparse: true,
      index: true,
      validate: {
        validator: function(v) {
          return !v || Object.keys(require('../constants/organizationCategories')).includes(v);
        },
        message: 'Invalid organization'
      }
    },
    contentType: {
      type: String,
      enum: ['regular', 'announcement', 'event-related', 'highlight'],
      default: 'regular',
      index: true
    },
    visibility: {
      type: String,
      enum: ['public', 'followers', 'organization'],
      default: 'public',
      index: true
    },
    shares: { type: Number, default: 0 },
    engagementMetrics: {
      views: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
      popularity: { type: Number, default: 0 },
      recency: { type: Number, default: 1 }
    }
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      getters: true,
      transform: function(doc, ret) {
        if (ret.likes) {
          ret.likes = ret.likes.map(id => id.toString());
        }
        return ret;
      }
    },
    toObject: { 
      virtuals: true,
      getters: true
    }
  }
);

// Methods for like handling
PostSchema.methods.toggleLike = function(userId) {
  const userIdStr = userId.toString();
  const index = this.likes.findIndex(id => id.toString() === userIdStr);
  
  if (index === -1) {
    this.likes.push(userId);
    this.engagementMetrics.popularity = (this.engagementMetrics.popularity || 0) + 1;
    return true;
  } else {
    this.likes.splice(index, 1);
    this.engagementMetrics.popularity = Math.max(0, (this.engagementMetrics.popularity || 0) - 1);
    return false;
  }
};

PostSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

PostSchema.methods.getLikesCount = function() {
  return this.likes.length;
};

// Enhanced indexes
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ tags: 1, 'engagementMetrics.popularity': -1 });
PostSchema.index({ 'engagementMetrics.popularity': -1, createdAt: -1 });
PostSchema.index({ 
  visibility: 1,
  contentType: 1, 
  'engagementMetrics.popularity': -1
});

// Pre-save hooks
PostSchema.pre('save', function(next) {
  // Initialize engagementMetrics if not present
  this.engagementMetrics = this.engagementMetrics || {
    views: 0,
    shares: 0,
    commentCount: 0,
    popularity: 0,
    recency: 1
  };

  // Clean media path if present
  if (this.media) {
    this.media = this.media.split(/[\/\\]/).pop();
  }

  next();
});

// Virtual for backward compatibility
PostSchema.virtual('img').get(function() {
  if (this.media) {
    return `/uploads/${path.basename(this.media)}`;
  }
  return null;
});

module.exports = mongoose.model("Post", PostSchema);