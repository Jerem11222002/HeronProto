const mongoose = require('mongoose');
const User = require('./users');
const debug = require('debug')('app:notification');

// Define the notification schema
const notificationSchema = new mongoose.Schema({
  // Core fields
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid userId format'
    }
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid senderId format'
    }
  },
  type: {
    type: String,
    required: true,
    enum: [
      'like',
      'comment',
      'follow',
      'follow_accept',
      'mention',
      'reply',
      'message',
      'post_tag',
      'share',
      'group_invite',
      'event_invite',
      'test',
      // Admin notification types
      'permission_update',
      'organization_event',
      'organization_registration',
      'organization_update',
      'superadmin_alert',
      'admin_assigned'
    ]
  },
  message: {
    type: String,
    required: false,
    trim: true,
    default: function() {
      return this.generateDefaultMessage();
    }
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },

  // Reference fields
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null,
    validate: {
      validator: function(v) {
        return !v || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid postId format'
    }
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
    validate: {
      validator: function(v) {
        return !v || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid commentId format'
    }
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
    validate: {
      validator: function(v) {
        return !v || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid messageId format'
    }
  },

  // Media fields
  postImage: {
    type: String,
    default: null,
    get: function(v) {
      try {
        if (!v) return null;
        return v.startsWith('http') ? v : `${process.env.API_URL || ''}/${v}`;
      } catch (error) {
        console.error('Error in postImage getter:', error);
        return null;
      }
    }
  },
  mediaUrl: {
    type: String,
    default: null,
    get: function(v) {
      try {
        if (!v) return null;
        return v.startsWith('http') ? v : `${process.env.API_URL || ''}/${v}`;
      } catch (error) {
        console.error('Error in mediaUrl getter:', error);
        return null;
      }
    }
  },

  // Admin-specific fields
  organization: {
    type: String,
    default: null,
    index: true
  },
  isAdminNotification: {
    type: Boolean,
    default: false,
    index: true
  },

  // Metadata fields
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  actionUrl: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        // Allow absolute URLs (http/https) or relative paths (/path)
        return !v || /^(http|https):\/\/[^ "]+$/.test(v) || /^\/[^ ]*$/.test(v);
      },
      message: 'Invalid URL format - must be absolute (http/https) or relative (/path)'
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['social', 'system', 'security', 'promotional'],
    default: 'social'
  },

  // Time-related fields
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000), // 30 days
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },

  // Status fields
  status: {
    type: String,
    enum: ['pending', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  archived: {
    type: Boolean,
    default: false,
    index: true
  },
  deliveryAttempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    getters: true,
    transform: function(doc, ret) {
      delete ret.__v;
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    getters: true
  }
});

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ userId: 1, priority: 1 });
notificationSchema.index({ userId: 1, category: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Admin notification indexes
notificationSchema.index({ isAdminNotification: 1, organization: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isAdminNotification: 1, read: 1 });

// Virtual fields
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

notificationSchema.virtual('age').get(function() {
  return Math.round((new Date() - this.createdAt) / 1000);
});

notificationSchema.virtual('timeAgo').get(function() {
  const seconds = Math.floor((new Date() - this.createdAt) / 1000);
  let interval = Math.floor(seconds / 31536000);

  if (interval > 1) return `${interval} years ago`;
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;
  return `${Math.floor(seconds)} seconds ago`;
});

// Instance methods
notificationSchema.methods.markAsRead = async function() {
  try {
    if (!this.read) {
      this.read = true;
      this.readAt = new Date();
      this.status = 'read';
      await this.save();
    }
    return this;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

notificationSchema.methods.archive = async function() {
  try {
    if (!this.archived) {
      this.archived = true;
      await this.save();
    }
    return this;
  } catch (error) {
    console.error('Error archiving notification:', error);
    throw error;
  }
};

notificationSchema.methods.deliver = async function() {
  try {
    this.status = 'delivered';
    this.deliveryAttempts += 1;
    return await this.save();
  } catch (error) {
    console.error('Error delivering notification:', error);
    throw error;
  }
};

// Static methods
notificationSchema.statics.findUnreadByUser = async function(userId) {
  try {
    debug('Finding unread notifications for user:', userId);

    const query = {
      userId,
      read: false,
      archived: false,
      expiresAt: { $gt: new Date() }
    };

    debug('Query:', JSON.stringify(query, null, 2));

    const notifications = await this.find(query)
      .sort({ createdAt: -1 })
      .populate('senderId', 'name profilePic gender')
      .lean();

    debug('Found notifications:', {
      count: notifications.length,
      notifications: notifications.map(n => ({
        id: n._id,
        type: n.type,
        message: n.message,
        createdAt: n.createdAt
      }))
    });

    return notifications;
  } catch (error) {
    debug('Error finding unread notifications:', error);
    throw error;
  }
};

notificationSchema.statics.markAllAsRead = async function(userId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const result = await this.updateMany(
      { 
        userId,
        read: false,
        archived: false
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
          status: 'read'
        }
      }
    );
    return result.modifiedCount;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

notificationSchema.statics.getUnreadCount = async function(userId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    return await this.countDocuments({
      userId,
      read: false,
      archived: false,
      expiresAt: { $gt: new Date() }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

notificationSchema.statics.debugNotifications = async function(userId) {
  try {
    debug('Debugging notifications for user:', userId);

    const allNotifications = await this.find({ userId }).lean();
    const unreadNotifications = await this.find({ 
      userId, 
      read: false 
    }).lean();
    const activeNotifications = await this.find({ 
      userId,
      read: false,
      archived: false,
      expiresAt: { $gt: new Date() }
    }).lean();

    debug('Notification counts:', {
      all: allNotifications.length,
      unread: unreadNotifications.length,
      active: activeNotifications.length
    });

    return {
      all: allNotifications,
      unread: unreadNotifications,
      active: activeNotifications
    };
  } catch (error) {
    debug('Error debugging notifications:', error);
    throw error;
  }
};

// Middleware
notificationSchema.pre('save', function(next) {
  try {
    if (this.isNew) {
      debug('Creating new notification:', {
        type: this.type,
        userId: this.userId.toString(),
        senderId: this.senderId.toString(),
        message: this.message,
        postId: this.postId?.toString()
      });

      if (!this.expiresAt) {
        this.expiresAt = new Date(+new Date() + 30*24*60*60*1000);
      }
      if (!this.message) {
        this.message = this.generateDefaultMessage();
      }
    }
    next();
  } catch (error) {
    debug('Error in pre-save middleware:', error);
    next(error);
  }
});

notificationSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('Error saving notification:', {
      error: error.message,
      notification: {
        type: this.type,
        userId: this.userId,
        senderId: this.senderId
      }
    });
  }
  next(error);
});

// Helper methods
notificationSchema.methods.generateDefaultMessage = function() {
  const messages = {
    like: 'liked your post',
    comment: 'commented on your post',
    follow: 'started following you',
    follow_accept: 'accepted your follow request',
    mention: 'mentioned you',
    reply: 'replied to your comment',
    message: 'sent you a message',
    post_tag: 'tagged you in a post',
    share: 'shared your post',
    group_invite: 'invited you to join a group',
    event_invite: 'invited you to an event',
    test: 'This is a test notification',
    // Admin notification messages
    permission_update: 'Your admin permissions have been updated',
    organization_event: 'New event created for your organization',
    organization_registration: 'New registration for your organization event',
    organization_update: 'Organization information updated',
    superadmin_alert: 'System alert for superadmin',
    admin_assigned: 'You have been assigned as an admin'
  };
  return messages[this.type] || 'sent you a notification';
};

// Create and export the model
const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;