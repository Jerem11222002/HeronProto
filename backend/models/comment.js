const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    postId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Post", 
      required: true,
      index: true 
    },
    userId: { 
      type: String,  // Changed to String to match Post schema's userId type
      required: true,
      index: true 
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    profilePicture: {
      type: String,
      default: null
    },
    text: { 
      type: String, 
      required: true,
      trim: true,
      maxLength: [500, 'Comment cannot exceed 500 characters'],
      minLength: [1, 'Comment cannot be empty']
    },
    edited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date,
      default: null
    },
    likes: {
      type: [String], // Changed to array of Strings to match Post schema
      default: [],
      index: true
    },
    likeCount: {
      type: Number,
      default: 0,
      min: [0, 'Like count cannot be negative']
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null
    },
    // allow deeper nesting (no hardcoded max here)
    depth: {
      type: Number,
      default: 0
    }
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.__v;
        delete ret.isDeleted;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Indexes
CommentSchema.index({ createdAt: -1 });
CommentSchema.index({ userId: 1, createdAt: -1 });
CommentSchema.index({ postId: 1, createdAt: -1 });
CommentSchema.index({ replyTo: 1, createdAt: -1 });

// Middlewares
CommentSchema.pre('save', function(next) {
  if (this.isModified('likes')) {
    this.likeCount = this.likes.length;
  }
  if (this.isModified('text') && !this.isNew) {
    this.edited = true;
    this.editedAt = new Date();
  }
  next();
});

// Virtual for timeAgo
CommentSchema.virtual('timeAgo').get(function() {
  const seconds = Math.floor((new Date() - this.createdAt) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
});

// Instance methods
CommentSchema.methods.like = function(userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

CommentSchema.methods.unlike = function(userId) {
  this.likes = this.likes.filter(id => id !== userId);
  return this.save();
};

// Static methods
CommentSchema.statics.findByPostWithUser = function(postId) {
  return this.find({ postId, isDeleted: false })
    .sort('-createdAt')
    .lean();
};

module.exports = mongoose.model("Comment", CommentSchema);