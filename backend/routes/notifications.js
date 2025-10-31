const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const authenticateToken = require('../Middleware/authenticateToken');
const User = require('../models/users');

const mongoose = require('mongoose');

// Get user notifications with pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching notifications for user:', req.user?.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'name profilePic gender')
        .lean(),
      Notification.countDocuments({ userId: req.user.id }),
      Notification.countDocuments({ 
        userId: req.user.id,
        read: false 
      })
    ]);
    
    console.log(`Found ${notifications.length} notifications`);
    
    res.json({
      notifications: notifications.map(notification => ({
        ...notification,
        senderName: notification.senderId?.name,
        senderPic: notification.senderId?.profilePic === 'svg-fallback' ? null : notification.senderId?.profilePic,
        senderGender: notification.senderId?.gender,
        useSvgFallback: notification.senderId?.profilePic === 'svg-fallback'
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalNotifications: totalCount,
        unreadCount,
        hasMore: totalCount > page * limit
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get unread count and latest notifications
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('Fetching notification status for user:', req.user.id);

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      read: false
    });

    console.log('Unread count:', unreadCount);

    res.json({
      unreadCount,
      success: true
    });
  } catch (error) {
    console.error('Error in /status route:', error);
    res.status(500).json({
      error: 'Failed to fetch notification status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Mark notification as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    console.log('Marking notification as read:', id);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const notification = await Notification.findOneAndUpdate(
      { 
        _id: id,
        userId: req.user.id
      },
      { read: true },
      { new: true }
    )
    .populate('senderId', 'name profilePic gender')
    .lean();

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      read: false
    });

    console.log('Notification marked as read');

    res.json({ 
      notification: {
        ...notification,
        senderName: notification.senderId?.name,
        senderPic: notification.senderId?.profilePic,
        senderGender: notification.senderId?.gender,
      },
      unreadCount 
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Mark all notifications as read
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    console.log('Marking all notifications as read for user:', req.user?.id);

    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );

    console.log(`Marked ${result.modifiedCount} notifications as read`);

    res.json({ 
      success: true,
      modifiedCount: result.modifiedCount,
      unreadCount: 0
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Clear all notifications
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    console.log('Clearing all notifications for user:', req.user?.id);

    const result = await Notification.deleteMany({ 
      userId: req.user.id 
    });

    console.log(`Deleted ${result.deletedCount} notifications`);

    res.json({ 
      success: true,
      deleted: result.deletedCount 
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Delete specific notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    console.log('Deleting notification:', id);

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      read: false
    });

    console.log('Notification deleted');

    res.json({ 
      success: true,
      deletedNotification: notification,
      unreadCount
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Test endpoint
router.post('/test-notification', authenticateToken, async (req, res) => {
  try {
    console.log('Creating test notification for user:', req.user?.id);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First check if user exists
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Creating notification with data:', {
      userId: req.user.id,
      userName: user.name
    });

    const notification = await Notification.create({
      userId: req.user.id,
      senderId: req.user.id,
      type: 'test',
      message: 'This is a test notification',
      postId: null,
      postImage: null
    });

    console.log('Notification created:', {
      id: notification._id,
      type: notification.type
    });

    // Socket handling
    const io = req.app.get('io');
    if (io) {
      io.emit('notification:new', notification);
      console.log('Socket event emitted');
    }

    res.json({ 
      success: true, 
      notification,
      socketEmitted: !!io
    });
  } catch (error) {
    console.error('Test notification error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to create test notification',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Debug endpoint
router.get('/debug', authenticateToken, async (req, res) => {
  try {
    console.log('Running notification debug for user:', req.user?.id);

    const stats = await Promise.all([
      Notification.countDocuments({ userId: req.user.id }),
      Notification.countDocuments({ userId: req.user.id, read: false }),
      Notification.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean()
    ]);

    res.json({
      totalCount: stats[0],
      unreadCount: stats[1],
      latestNotification: stats[2][0],
      userId: req.user.id,
      socketConnected: !!req.app.get('io')
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug check failed' });
  }
});

// Add this new route
router.get('/debug', authenticateToken, async (req, res) => {
  try {
    console.log('Running notification debug for user:', req.user.id);

    const results = await Notification.debugNotifications(req.user.id);
    
    res.json({
      userId: req.user.id,
      counts: {
        all: results.all.length,
        unread: results.unread.length,
        active: results.active.length
      },
      notifications: {
        all: results.all,
        unread: results.unread,
        active: results.active
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug check failed' });
  }
});

module.exports = router;