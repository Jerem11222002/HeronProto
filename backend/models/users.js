const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// add central VALID_INTERESTS so schema and methods stay consistent
const VALID_INTERESTS = [
  'music',
  'dance',
  'theatre',
  'cultural-arts',
  'vocal-arts',
  'modern-music',
  'traditional-arts',
  'instruments',
  'visual-arts',
  'painting',
  'artwork',
  'canvas',
  'digital-art',
  'technical-production',
  'creatives',
  'multimedia',
  'design',
  'graphics',
  'performance',
  // new interests added to match frontend
  'photography',
  'film',
  'fashion',
  'writing',
  'sculpture',
  'animation',
  'photogrammetry'
];

const getTagsFromInterestIds = (interestIds) => {
  const interestMap = {
    1: ['music', 'performance'],
    2: ['dance', 'choreography'],
    3: ['theater', 'drama'],
    4: ['visual-arts', 'painting'],
    5: ['photography', 'digital-art'],
    6: ['writing', 'poetry'],
    7: ['film', 'video'],
    8: ['design', 'graphics'],
    9: ['crafts', 'handmade'],
    10: ['cultural-arts', 'traditional']
  };
  
  return interestIds.reduce((tags, id) => {
    return [...tags, ...(interestMap[id] || [])];
  }, []);
};

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    set: v => v.toLowerCase()
  },
  studentId: {
    type: String,
    required: function() {
      // Only require studentId if NOT admin or superadmin
      return !this.isAdmin && (!this.adminRole || !['admin', 'super'].includes(this.adminRole));
    },
    unique: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true, 
    select: false,
    minlength: 6
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  bio: { 
    type: String, 
    trim: true,
    maxLength: [150, 'Bio cannot exceed 150 characters'],
    default: ''
  },
  gender: { 
    type: String, 
    required: true,
    enum: ['male', 'female', 'prefer-not-to-say'],
    default: 'prefer-not-to-say',
    lowercase: true,
    trim: true,
    index: true
  },
  genderHistory: [{
    value: { type: String, enum: ['male', 'female', 'prefer-not-to-say'] },
    changedAt: { type: Date, default: Date.now }
  }],
  interests: { 
    type: [String],
    default: undefined,
    validate: {
      validator: function(v) {
        // ensure array of strings and each not too long
        return !v || (Array.isArray(v) && v.every(i => typeof i === 'string' && i.length > 0 && i.length <= 50));
      },
      message: 'Invalid interests'
    }
  },
  interestsSelected: { 
    type: Boolean, 
    default: false,
    index: true
  },
  interestsSkipped: {
    type: Boolean,
    default: false,
    index: true
  },
  profileSetup: {
    type: Boolean,
    default: false,
    index: true
  },
  implicitPreferences: {
    type: Object,
    default: {},
    validate: {
      validator: function(prefs) {
        if (!prefs) return true;
        return Object.values(prefs).every(score => 
          typeof score === 'number' && score >= -5 && score <= 5
        );
      },
      message: 'Implicit preference scores must be numbers between -5 and 5'
    }
  },
  interactionHistory: [{
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    },
    action: {
      type: String,
      enum: ['like', 'view', 'share', 'comment']
    },
    tags: [String],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  contentPreferences: {
    viewedPosts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
      default: [],
      select: false
    },
    likedPosts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
      default: [],
      select: false
    },
    sharedPosts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
      default: [],
      select: false
    }
  },
  
  // Admin-specific fields
  isAdmin: {
    type: Boolean,
    default: false,
    index: true
  },
  adminRole: {
    type: String,
    enum: ['super', 'admin', 'moderator', 'editor', null],
    default: null,
    validate: {
      validator: function(v) {
        return !this.isAdmin || (v && ['super', 'admin', 'moderator', 'editor'].includes(v));
      },
      message: 'Invalid admin role'
    }
  },
  adminPermissions: {
    canManageUsers: { type: Boolean, default: false },
    canManageEvents: { type: Boolean, default: false },
    canModerateContent: { type: Boolean, default: false },
    canAccessAnalytics: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false }
  },
  adminActionLog: [{
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now }
  }],
  lastAdminLogin: {
    type: Date,
    default: null
  },

  customization: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      enum: ['en', 'es', 'fr'],
      default: 'en'
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'friends'],
      default: 'public'
    }
  },
  lastPasswordChange: { 
    type: Date, 
    default: Date.now 
  },
  profilePic: { 
    type: String,
    default: function() {
      switch(this.gender) {
        case 'female':
          return '/assets/person/Female.jpg';
        case 'male':
          return '/assets/person/Male.jpg';
        default:
          // Use a special string to indicate SVG fallback
          return 'svg-fallback';
      }
    }
  },

  coverPic: {
    type: String
  },
  imageHistory: [{
    type: {
      type: String,
      enum: ['profilePic', 'coverPic']
    },
    url: String,
    publicId: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  followers: { 
    type: [mongoose.Schema.Types.ObjectId], 
    ref: "User", 
    default: [],
    index: true
  },
  following: { 
    type: [mongoose.Schema.Types.ObjectId], 
    ref: "User", 
    default: [],
    index: true
  },

  // Password reset
  passwordResetToken: {
    type: String,
    default: null,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    default: null,
    select: false
  }

}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      ret.profileCompletion = doc.profileCompletionStatus;
      return ret;
    }
  }
});

// Profile completion virtual
UserSchema.virtual('profileCompletionStatus').get(function() {
  let completed = 0;
  let total = 5;

  if (this.name) completed++;
  if (this.bio) completed++;
  if (this.profilePic && !this.profilePic.includes('Default.jpg')) completed++;
  if (this.interestsSelected && !this.interestsSkipped) completed++;
  if (this.profileSetup) completed++;

  return {
    percentage: Math.round((completed / total) * 100),
    completed,
    total
  };
});

// Interests middleware
UserSchema.pre("save", function(next) {
  if (this.isModified('interests') || this.isModified('interestsSkipped')) {
    this.interestsSelected = this.interests.length > 0 || this.interestsSkipped;
  }
  next();
});

// Profile setup middleware
UserSchema.pre("save", function(next) {
  if (this.isModified('bio') || 
      this.isModified('name') || 
      this.isModified('profilePic')) {
    
    this.profileSetup = !!(
      this.name && 
      (this.bio || this.profilePic !== '/assets/person/Default.jpg')
    );
  }
  next();
});

// Password hashing middleware
UserSchema.pre("save", async function (next) {
  if (this.isModified("password") && !this.password.startsWith('$2a$')) {
    try {
      this.password = await bcrypt.hash(this.password, 10);
      this.lastPasswordChange = Date.now();
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Gender and profile picture middleware
UserSchema.pre("save", function (next) {
  if (this.isModified('gender')) {
    this.genderHistory.push({
      value: this.gender,
      changedAt: new Date()
    });
  }

  if (!this.profilePic || this.isModified('gender')) {
    switch(this.gender) {
      case 'female':
        this.profilePic = '/assets/person/Female.jpg';
        break;
      case 'male':
        this.profilePic = '/assets/person/Male.jpg';
        break;
      default:
        this.profilePic = '/assets/person/Default.jpg';
    }
  }
  next();
});

UserSchema.methods.getAdminAccess = function() {
  if (!this.isAdmin) return null;
  return {
    role: this.adminRole,
    permissions: this.adminPermissions,
    lastLogin: this.lastAdminLogin
  };
};

UserSchema.pre("save", function(next) {
  if (this.isModified('isAdmin')) {
    if (!this.isAdmin) {
      // Clear admin fields when removing admin status
      this.adminRole = undefined;
      this.adminPermissions = undefined;
      this.lastAdminLogin = null;
    } else if (!this.adminRole) {
      // Set default role when making user an admin
      this.adminRole = 'moderator';
      this.adminPermissions = {
        canManageUsers: false,
        canManageEvents: true,
        canModerateContent: true,
        canAccessAnalytics: true,
        canManageSettings: false
      };
    }
  }
  next();
});

UserSchema.methods.logAdminAction = async function(action, details = {}) {
  if (!this.isAdmin) throw new Error('User is not an admin');
  
  this.adminActionLog.unshift({
    action,
    details,
    timestamp: new Date()
  });

  // Keep only last 100 actions
  if (this.adminActionLog.length > 100) {
    this.adminActionLog = this.adminActionLog.slice(0, 100);
  }

  return this.save();
};

UserSchema.methods.updateAdminRole = async function(newRole) {
  if (!['super', 'admin', 'moderator', 'editor'].includes(newRole)) {
    throw new Error('Invalid admin role');
  }

  const permissions = {
    super: {
      canManageUsers: true,
      canManageEvents: true,
      canModerateContent: true,
      canAccessAnalytics: true,
      canManageSettings: true
    },
    admin: {
      canManageUsers: false,
      canManageEvents: true,
      canModerateContent: true,
      canAccessAnalytics: true,
      canManageSettings: false
    },
    moderator: {
      canManageUsers: false,
      canManageEvents: true,
      canModerateContent: true,
      canAccessAnalytics: true,
      canManageSettings: false
    },
    editor: {
      canManageUsers: false,
      canManageEvents: true,
      canModerateContent: false,
      canAccessAnalytics: false,
      canManageSettings: false
    }
  };

  this.adminRole = newRole;
  this.adminPermissions = permissions[newRole];
  await this.logAdminAction('role_updated', { newRole });
  return this.save();
};

UserSchema.methods.updateImplicitPreferences = async function(post, action, weight = 1) {
  try {
    // Validate inputs
    if (!post?._id || !Array.isArray(post.tags)) {
      console.warn('⚠️ Invalid post data for preference update:', {
        postId: post?._id,
        hasTags: Array.isArray(post?.tags),
        action,
        userId: this._id
      });
      return false;
    }

    // Validate action type
    const validActions = ['view', 'like', 'unlike', 'share', 'comment'];
    if (!validActions.includes(action)) {
      console.warn('⚠️ Invalid action type:', {
        action,
        validActions,
        userId: this._id
      });
      return false;
    }

    // Initialize or get existing preferences
    const currentPreferences = this.implicitPreferences || {};
    const updates = {};
    
    // Calculate new preference scores
    post.tags.forEach(tag => {
      if (typeof tag !== 'string') return;
      
      const currentScore = currentPreferences[tag] || 0;
      const newScore = Math.max(-5, Math.min(5, currentScore + weight));
      
      // Only update if score changed
      if (currentScore !== newScore) {
        updates[`implicitPreferences.${tag}`] = newScore;
      }
    });

    // Skip update if no changes
    if (Object.keys(updates).length === 0) {
      console.log('ℹ️ No preference updates needed:', {
        userId: this._id,
        postId: post._id,
        action
      });
      return true;
    }

    // Perform atomic update
    const result = await this.constructor.findByIdAndUpdate(
      this._id,
      {
        $set: updates,
        $push: {
          interactionHistory: {
            $each: [{
              postId: post._id,
              action,
              tags: post.tags,
              timestamp: new Date()
            }],
            $slice: -100 // Keep last 100 interactions
          }
        }
      },
      { new: true }
    );

    if (!result) {
      throw new Error('User not found during preference update');
    }

    // Update instance data
    this.implicitPreferences = {
      ...this.implicitPreferences,
      ...Object.keys(updates).reduce((acc, key) => {
        acc[key.replace('implicitPreferences.', '')] = updates[key];
        return acc;
      }, {})
    };

    console.log('✅ Preferences updated:', {
      userId: this._id,
      postId: post._id,
      action,
      updatedTags: Object.keys(updates).map(k => k.replace('implicitPreferences.', ''))
    });

    return true;

  } catch (error) {
    console.error('❌ Error updating preferences:', {
      error: error.message,
      stack: error.stack,
      userId: this._id,
      postId: post?._id,
      action
    });
    return false;
  }
};

// add alias virtual for profilePicture to keep compatibility with legacy fields
UserSchema.virtual('profilePicture')
  .get(function() {
    return this.profilePic;
  })
  .set(function(val) {
    this.profilePic = val;
  });

UserSchema.methods.addImageHistory = async function(type, url, publicId) {
  // Add new image to history
  this.imageHistory.unshift({
    type,
    url,
    publicId,
    uploadedAt: new Date()
  });

  // Keep only last 5 entries per type
  const typeHistory = this.imageHistory.filter(img => img.type === type);
  if (typeHistory.length > 5) {
    const toRemove = typeHistory.slice(5);
    this.imageHistory = this.imageHistory.filter(img => 
      img.type !== type || !toRemove.find(r => r.url === img.url)
    );
  }

  // Update current image
  if (type === 'profilePic') {
    this.profilePic = url;
  } else if (type === 'coverPic') {
    this.coverPic = url;
  }

  return this.save();
};

// --- NEW: canonical settings getter for user instance ---
UserSchema.methods.getSettings = function() {
  // Provide a stable settings object used by the server and client
  return {
    userId: this._id?.toString ? this._id.toString() : this._id,
    theme: this.customization?.theme || 'system',
    language: this.customization?.language || 'en',
    visibility: this.customization?.visibility || 'public',
    notifications: this.notifications || { email: true, push: false, sms: false },
    // small compatibility aliases
    profilePic: this.profilePic || this.profilePicture || null,
    profilePicture: this.profilePic || this.profilePicture || null
  };
};

// --- NEW: static helper to fetch settings by user id ---
UserSchema.statics.getSettingsById = async function(userId) {
  if (!userId) return null;
  const user = await this.findById(userId).select('customization notifications profilePic profilePicture').exec();
  if (!user) return null;
  return user.getSettings();
};

// fix setupProfile to use correct vars and history helper
UserSchema.methods.setupProfile = async function(profileData) {
  const { name, bio, profilePicture } = profileData;

  if (name) this.name = name.trim();
  if (bio) this.bio = bio.trim();
  if (profilePicture) {
    // ensure the history helper is called with right params
    await this.addImageHistory('profilePic', profilePicture, null);
  }

  this.profileSetup = true;
  return this.save();
};

// Virtual for mutual friends
UserSchema.virtual('mutualFriends').get(function() {
  const following = this.following || [];
  const followers = this.followers || [];
  return following.filter(followingId => followers.includes(followingId));
});

// Virtual for one-way following
UserSchema.virtual('oneWayFollowing').get(function() {
  const following = this.following || [];
  const followers = this.followers || [];
  return following.filter(followingId => !followers.includes(followingId));
});

// Virtual for one-way followers
UserSchema.virtual('oneWayFollowers').get(function() {
  const following = this.following || [];
  const followers = this.followers || [];
  return followers.filter(followerId => !following.includes(followerId));
});

// Virtual for interest status
UserSchema.virtual('interestStatus').get(function() {
  if (!this.interestsSelected) return 'pending';
  if (this.interestsSkipped) return 'skipped';
  return this.interests.length > 0 ? 'selected' : 'none';
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

UserSchema.methods.validateGender = function(gender) {
  return ['male', 'female', 'prefer-not-to-say'].includes(gender?.toLowerCase()?.trim());
};

UserSchema.methods.skipInterests = async function() {
  this.interestsSelected = true;
  this.interestsSkipped = true;
  this.interests = [];
  
  const updated = await this.save();
  console.log('Interests skipped:', {
    userId: this._id,
    interestsSelected: updated.interestsSelected,
    interestsSkipped: updated.interestsSkipped
  });
  
  return updated;
};

UserSchema.methods.setInterests = async function(interests) {
  if (!this.validateInterests(interests)) {
    throw new Error('Invalid interests');
  }
  this.interests = interests;
  this.interestsSelected = true;
  this.interestsSkipped = false;
  await this.save();
};

UserSchema.methods.validateInterests = function(interests) {
  if (!Array.isArray(interests)) return false;
  // allow any number of selections, ensure they exist in VALID_INTERESTS
  return interests.every(interest => VALID_INTERESTS.includes(interest));
};

UserSchema.methods.setupProfile = async function(profileData) {
  const { name, bio, profilePicture } = profileData;

  if (name) this.name = name.trim();
  if (bio) this.bio = bio.trim();
  if (profilePicture) {
    // ensure the history helper is called with right params
    await this.addImageHistory('profilePic', profilePicture, null);
  }

  this.profileSetup = true;
  return this.save();
};

UserSchema.methods.isMutualFriend = function(userId) {
  return this.following.includes(userId) && this.followers.includes(userId);
};

UserSchema.methods.isFollowing = function(userId) {
  return this.following.includes(userId);
};

UserSchema.methods.isFollowedBy = function(userId) {
  return this.followers.includes(userId);
};

UserSchema.methods.hasSelectedInterests = function() {
  return this.interestsSelected === true;
};

// Virtuals for counts
UserSchema.virtual('followerCount').get(function() {
  return (this.followers || []).length;
});

UserSchema.virtual('followingCount').get(function() {
  return (this.following || []).length;
});

UserSchema.virtual('mutualFriendsCount').get(function() {
  return (this.mutualFriends || []).length;
});

UserSchema.methods.getMappedInterests = function() {
  return {
    interests: this.interests,
    implicitScores: this.implicitPreferences || {}
  };
};

// Indexes
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ gender: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ followers: 1 });
UserSchema.index({ following: 1 });
UserSchema.index({ interests: 1 });
UserSchema.index({ interestsSelected: 1 });
UserSchema.index({ interestsSkipped: 1 });
UserSchema.index({ profileSetup: 1 });
UserSchema.index({ 'customization.visibility': 1 });
UserSchema.index({ isAdmin: 1, adminRole: 1 });
UserSchema.index({ 'adminActionLog.timestamp': -1 });
UserSchema.index({ 'interactionHistory.timestamp': -1 });
UserSchema.index({ 'contentPreferences.viewedPosts': 1 });
UserSchema.index({ 'contentPreferences.likedPosts': 1 });
UserSchema.index({ 'contentPreferences.sharedPosts': 1 });


module.exports = mongoose.model("User", UserSchema);