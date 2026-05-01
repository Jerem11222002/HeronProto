const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const User = require('../models/users');
const { adminAuthMiddleware, requireAdminRole } = require('../Middleware/adminAuthMiddleware');
const mongoose = require('mongoose');

// Apply admin authentication middleware to all routes
router.use(adminAuthMiddleware);

/**
 * Get admin notifications with organization filtering
 * - Superadmins see all admin notifications across all organizations
 * - Organization admins only see notifications for their organization
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const { adminRole, adminOrganization, id: userId } = req.user;

    console.log(`[ADMIN NOTIFICATIONS] Fetching for user ${userId}, role: ${adminRole}, org: ${adminOrganization}`);

    // Build the query based on role
    let query = { isAdminNotification: true };

    if (adminRole === 'super') {
      // Superadmin sees all admin notifications (including those without organization)
      // Also include superadmin-specific notifications
      query = {
        $and: [
          { isAdminNotification: true },
          {
            $or: [
              { organization: { $exists: false } },
              { organization: null },
              { organization: { $ne: null } }
            ]
          }
        ]
      };
    } else {
      // Regular admin only sees notifications for their organization
      // and notifications specifically addressed to them
      query = {
        $and: [
          { isAdminNotification: true },
          {
            $or: [
              { organization: adminOrganization },
              { userId: new mongoose.Types.ObjectId(userId) }
            ]
          }
        ]
      };
    }

    // Get total count
    const totalCount = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      ...query,
      read: false
    });

    // Get paginated notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'name profilePic username')
      .lean();

    // Format notifications
    const formattedNotifications = notifications.map(notification => ({
      ...notification,
      senderName: notification.senderId?.name,
      senderPic: notification.senderId?.profilePic === 'svg-fallback' ? null : notification.senderId?.profilePic,
      senderUsername: notification.senderId?.username,
      timeAgo: getTimeAgo(notification.createdAt)
    }));

    console.log(`[ADMIN NOTIFICATIONS] Found ${formattedNotifications.length} notifications (total: ${totalCount}, unread: ${unreadCount})`);

    res.json({
      success: true,
      data: {
        notifications: formattedNotifications,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          totalNotifications: totalCount,
          unreadCount,
          hasMore: totalCount > page * limit
        },
        adminRole,
        organization: adminOrganization
      }
    });
  } catch (error) {
    console.error('[ADMIN NOTIFICATIONS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin notifications',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get unread notification count for admin
 */
router.get('/status', async (req, res) => {
  try {
    const { adminRole, adminOrganization, id: userId } = req.user;

    let query = { isAdminNotification: true, read: false };

    if (adminRole !== 'super') {
      query = {
        $and: [
          { isAdminNotification: true },
          { read: false },
          {
            $or: [
              { organization: adminOrganization },
              { userId: new mongoose.Types.ObjectId(userId) }
            ]
          }
        ]
      };
    }

    const unreadCount = await Notification.countDocuments(query);

    res.json({
      success: true,
      unreadCount,
      adminRole,
      organization: adminOrganization
    });
  } catch (error) {
    console.error('[ADMIN NOTIFICATIONS] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification status'
    });
  }
});

/**
 * Mark a notification as read
 */
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, adminRole, adminOrganization } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    // Build the query to ensure users can only mark their own notifications
    let query = {
      _id: id,
      isAdminNotification: true
    };

    if (adminRole !== 'super') {
      query = {
        ...query,
        $or: [
          { organization: adminOrganization },
          { userId: new mongoose.Types.ObjectId(userId) }
        ]
      };
    }

    const notification = await Notification.findOneAndUpdate(
      query,
      { read: true, readAt: new Date() },
      { new: true }
    )
      .populate('senderId', 'name profilePic username')
      .lean();

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Get updated unread count
    let countQuery = { isAdminNotification: true, read: false };
    if (adminRole !== 'super') {
      countQuery = {
        $and: [
          { isAdminNotification: true },
          { read: false },
          {
            $or: [
              { organization: adminOrganization },
              { userId: new mongoose.Types.ObjectId(userId) }
            ]
          }
        ]
      };
    }
    const unreadCount = await Notification.countDocuments(countQuery);

    res.json({
      success: true,
      notification: {
        ...notification,
        senderName: notification.senderId?.name,
        senderPic: notification.senderId?.profilePic
      },
      unreadCount
    });
  } catch (error) {
    console.error('[ADMIN NOTIFICATIONS] Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * Mark all notifications as read
 */
router.post('/read-all', async (req, res) => {
  try {
    const { id: userId, adminRole, adminOrganization } = req.user;

    let query = {
      isAdminNotification: true,
      read: false
    };

    if (adminRole !== 'super') {
      query = {
        $and: [
          { isAdminNotification: true },
          { read: false },
          {
            $or: [
              { organization: adminOrganization },
              { userId: new mongoose.Types.ObjectId(userId) }
            ]
          }
        ]
      };
    }

    const result = await Notification.updateMany(
      query,
      { read: true, readAt: new Date() }
    );

    console.log(`[ADMIN NOTIFICATIONS] Marked ${result.modifiedCount} notifications as read`);

    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
      unreadCount: 0
    });
  } catch (error) {
    console.error('[ADMIN NOTIFICATIONS] Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * Delete a notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, adminRole, adminOrganization } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    let query = {
      _id: id,
      isAdminNotification: true
    };

    if (adminRole !== 'super') {
      query = {
        ...query,
        $or: [
          { organization: adminOrganization },
          { userId: new mongoose.Types.ObjectId(userId) }
        ]
      };
    }

    const notification = await Notification.findOneAndDelete(query);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Get updated unread count
    let countQuery = { isAdminNotification: true, read: false };
    if (adminRole !== 'super') {
      countQuery = {
        $and: [
          { isAdminNotification: true },
          { read: false },
          {
            $or: [
              { organization: adminOrganization },
              { userId: new mongoose.Types.ObjectId(userId) }
            ]
          }
        ]
      };
    }
    const unreadCount = await Notification.countDocuments(countQuery);

    res.json({
      success: true,
      deletedNotification: notification,
      unreadCount
    });
  } catch (error) {
    console.error('[ADMIN NOTIFICATIONS] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * Create a test notification (for debugging)
 */
router.post('/test', async (req, res) => {
  try {
    const { id: userId, adminRole, adminOrganization } = req.user;

    const notification = await Notification.create({
      userId: new mongoose.Types.ObjectId(userId),
      senderId: new mongoose.Types.ObjectId(userId),
      type: 'superadmin_alert',
      message: `Test admin notification from ${adminRole} (${adminOrganization || 'no org'})`,
      isAdminNotification: true,
      organization: adminOrganization,
      category: 'system',
      priority: 'medium'
    });

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('[ADMIN NOTIFICATIONS] Test error:', error);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

/**
 * Create admin notification (internal use)
 * This function can be called from other routes to create notifications
 */
const createAdminNotification = async ({
  userId,
  senderId,
  type,
  message,
  organization,
  data = {},
  priority = 'medium',
  category = 'system',
  actionUrl = null
}) => {
  try {
    const notification = await Notification.create({
      userId: new mongoose.Types.ObjectId(userId),
      senderId: new mongoose.Types.ObjectId(senderId),
      type,
      message,
      isAdminNotification: true,
      organization,
      data,
      priority,
      category,
      actionUrl,
      read: false
    });

    console.log(`[ADMIN NOTIFICATION] Created ${type} notification for user ${userId}`);
    return notification;
  } catch (error) {
    console.error('[ADMIN NOTIFICATION] Creation error:', error);
    throw error;
  }
};

/**
 * Create permission update notification
 * Called when admin permissions are updated
 */
const createPermissionUpdateNotification = async (adminId, updatedById, changes) => {
  try {
    const admin = await User.findById(adminId);
    if (!admin) throw new Error('Admin not found');

    const formattedChanges = Object.entries(changes)
      .filter(([key, value]) => key.startsWith('can'))
      .map(([key, value]) => `${key.replace('can', '').replace(/([A-Z])/g, ' $1')}: ${value ? 'Enabled' : 'Disabled'}`)
      .join(', ');

    const message = formattedChanges
      ? `Your permissions were updated: ${formattedChanges}`
      : 'Your admin permissions have been updated';

    return await createAdminNotification({
      userId: adminId,
      senderId: updatedById,
      type: 'permission_update',
      message,
      organization: admin.adminOrganization,
      data: { changes },
      priority: 'high',
      category: 'security',
      actionUrl: '/admin/settings'
    });
  } catch (error) {
    console.error('[ADMIN NOTIFICATION] Permission update error:', error);
    throw error;
  }
};

/**
 * Create organization event notification
 * Called when a new event is created for an organization
 */
const createOrganizationEventNotification = async (organization, eventId, eventTitle, createdById) => {
  try {
    // Find all admins for this organization
    const admins = await User.find({
      isAdmin: true,
      adminOrganization: organization
    }).select('_id');

    const notifications = await Promise.all(
      admins.map(admin =>
        createAdminNotification({
          userId: admin._id,
          senderId: createdById,
          type: 'organization_event',
          message: `New event "${eventTitle}" created for ${organization}`,
          organization,
          data: { eventId, eventTitle },
          priority: 'medium',
          category: 'system',
          actionUrl: `/admin/events/${eventId}`
        })
      )
    );

    return notifications;
  } catch (error) {
    console.error('[ADMIN NOTIFICATION] Organization event error:', error);
    throw error;
  }
};

/**
 * Create superadmin alert notification
 * Sends to all superadmins
 */
const createSuperadminAlert = async (message, data = {}, priority = 'high') => {
  try {
    // Find all superadmins
    const superadmins = await User.find({
      isAdmin: true,
      adminRole: 'super'
    }).select('_id');

    const systemUser = await User.findOne({ isAdmin: true }).select('_id');
    const senderId = systemUser?._id || superadmins[0]?._id;

    const notifications = await Promise.all(
      superadmins.map(superadmin =>
        createAdminNotification({
          userId: superadmin._id,
          senderId,
          type: 'superadmin_alert',
          message,
          organization: null,
          data,
          priority,
          category: 'security'
        })
      )
    );

    return notifications;
  } catch (error) {
    console.error('[ADMIN NOTIFICATION] Superadmin alert error:', error);
    throw error;
  }
};

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = Math.floor(seconds / 31536000);

  if (interval >= 1) return `${interval}y ago`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval}mo ago`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval}d ago`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval}h ago`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval}m ago`;
  return `${seconds}s ago`;
}

// Export helper functions for use in other routes
module.exports = {
  router,
  createAdminNotification,
  createPermissionUpdateNotification,
  createOrganizationEventNotification,
  createSuperadminAlert
};
