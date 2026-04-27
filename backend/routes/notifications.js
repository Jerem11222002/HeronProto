const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const authenticateToken = require('../Middleware/authenticateToken');
const User = require('../models/users');

const mongoose = require('mongoose');
const notificationCache = require('../services/notificationCache');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

// Get user notifications with pagination
router.get('/', authenticateToken, async (req, res) => {
  const queryStartTime = Date.now();
  try {
    console.log(`\n📌 [NOTIFICATIONS] GET /api/notifications start`);
    console.log(`   User: ${req.user?.id}`);
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Cap at 50
    const skip = (page - 1) * limit;

    if (!req.user?.id) {
      console.error(`[NOTIFICATIONS] ❌ User not authenticated`);
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Wrap database operations with retry logic to handle pool exhaustion
    const countStartTime = Date.now();
    const { totalCount, unreadCount } = await retryWithBackoff(
      async () => {
        console.log(`   [COUNT] Fetching notification counts...`);
        
        // First, get count metadata (cached)
        let totalCount, unreadCount;
        const cachedMetadata = notificationCache.get(req.user.id);
        
        if (cachedMetadata && !cachedMetadata.expired) {
          console.log(`   [COUNT] 📦 Cache HIT`);
          totalCount = cachedMetadata.data.totalCount;
          unreadCount = cachedMetadata.data.unreadCount;
        } else {
          // Cache miss - get counts from database with timeout protection
          console.log(`   [COUNT] 🔄 Cache MISS - querying DB`);
          const dbCountStart = Date.now();
          
          const countResults = await Notification.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
            {
              $facet: {
                counts: [
                  {
                    $group: {
                      _id: null,
                      total: { $sum: 1 },
                      unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } }
                    }
                  }
                ]
              }
            }
          ]);
          
          const dbCountDuration = Date.now() - dbCountStart;
          totalCount = countResults[0].counts[0]?.total || 0;
          unreadCount = countResults[0].counts[0]?.unread || 0;
          
          console.log(`   [COUNT] ✅ DB query done (${dbCountDuration}ms): total=${totalCount}, unread=${unreadCount}`);
          
          // Cache metadata for 1 minute
          notificationCache.set(req.user.id, [], totalCount, unreadCount);
        }

        return { totalCount, unreadCount };
      },
      3,
      100,
      `Notification metadata fetch for user ${req.user.id}`
    );
    const countDuration = Date.now() - countStartTime;
    console.log(`   [COUNTS DONE] ${countDuration}ms`);

    // Get paginated notifications with retry
    console.log(`   [PAGINATION] Fetching page ${page}, limit ${limit}`);
    const paginationStartTime = Date.now();
    
    const paginatedNotifications = await retryWithBackoff(
      async () => {
        const aggregateStart = Date.now();
        console.log(`   [PAGINATION] Starting aggregation...`);
        
        try {
          console.log(`   [PAGINATION] Stage 1: $match for userId...`);
          const matchStart = Date.now();
          
          // Build the aggregation pipeline step by step for better error tracking
          const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
            { $sort: { createdAt: -1 } },
            // CRITICAL: $skip and $limit BEFORE $lookup to reduce documents being looked up
            { $skip: skip },
            { $limit: limit }
          ];
          
          console.log(`   [PAGINATION] Stage 2: Executing $skip/$limit...`);
          
          // Add lookup to enrich with sender data
          pipeline.push({
            $lookup: {
              from: 'users',
              localField: 'senderId',
              foreignField: '_id',
              as: 'senderData'
            }
          });
          
          console.log(`   [PAGINATION] Stage 3: Adding $lookup for user data...`);
          
          // Flatten senderData array
          pipeline.push({
            $addFields: {
              senderId: { $arrayElemAt: ['$senderData', 0] }
            }
          });
          
          // Remove temporary array
          pipeline.push({
            $project: { senderData: 0 }
          });
          
          console.log(`   [PAGINATION] Executing aggregation pipeline...`);
          const pipelineStart = Date.now();
          const result = await Notification.aggregate(pipeline).allowDiskUse(true);
          const pipelineDuration = Date.now() - pipelineStart;
          
          console.log(`   [PAGINATION] ✅ Aggregation complete (${pipelineDuration}ms): ${result.length} docs returned`);
          return result;
        } catch (innerError) {
          console.error(`   [PAGINATION] ❌ Aggregation error:`, innerError.message);
          throw innerError;
        }
      },
      3,
      100,
      `Notification pagination fetch for user ${req.user.id} page ${page}`
    );
    
    const paginationDuration = Date.now() - paginationStartTime;
    console.log(`   [PAGINATION DONE] ${paginationDuration}ms`);
    
    console.log(`✅ Found ${paginatedNotifications.length} notifications on page ${page}`);
    
    const totalDuration = Date.now() - queryStartTime;
    console.log(`📌 [NOTIFICATIONS] Complete (${totalDuration}ms)\n`);
    
    res.json({
      success: true,
      data: {
        notifications: paginatedNotifications.map(notification => ({
          ...notification,
          senderName: notification.senderId?.name,
          senderPic: notification.senderId?.profilePic === 'svg-fallback' ? null : notification.senderId?.profilePic,
          senderGender: notification.senderId?.gender,
          useSvgFallback: notification.senderId?.profilePic === 'svg-fallback'
        })),
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          totalNotifications: totalCount,
          unreadCount,
          hasMore: totalCount > page * limit
        }
      }
    });
  } catch (error) {
    const totalDuration = Date.now() - queryStartTime;
    console.error(`\n❌ [NOTIFICATIONS] ERROR (${totalDuration}ms):`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Type: ${error.name}`);
    console.error(`   Stack: ${error.stack}\n`);
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch notifications',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
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
      success: true,
      unreadCount
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
    
    // Invalidate notification cache
    notificationCache.invalidateOnRead(req.user.id);

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
    
    // Invalidate notification cache
    notificationCache.invalidate(req.user.id);

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
    
    // Invalidate notification cache
    notificationCache.invalidate(req.user.id);

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
    
    // Invalidate notification cache
    notificationCache.invalidate(req.user.id);

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

// Diagnostic endpoint - debug notification loading issues
router.get('/diagnostic/user-stats', authenticateToken, async (req, res) => {
  try {
    console.log(`\n📊 [DIAGNOSTIC] Generating notification stats for user: ${req.user?.id}`);
    const startTime = Date.now();
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Count total notifications for this user
    const totalUserNotifs = await Notification.countDocuments({ userId: req.user.id });
    console.log(`   Total notifications for user: ${totalUserNotifs}`);

    // Count by type
    const byType = await Notification.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log(`   Notifications by type:`, JSON.stringify(byType));

    // Count unread
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user.id, 
      read: false 
    });
    console.log(`   Unread notifications: ${unreadCount}`);

    // Check for deleted/orphaned notifications (those with invalid senderIds)
    const orphanedCount = await Notification.countDocuments({
      userId: req.user.id,
      senderId: null
    });
    console.log(`   Orphaned notifications (null sender): ${orphanedCount}`);

    // Sample of newest notifications
    const samples = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    console.log(`   Last 5 notifications:`, samples.map(n => ({ 
      id: n._id, 
      type: n.type, 
      senderId: n.senderId, 
      createdAt: n.createdAt 
    })));

    const duration = Date.now() - startTime;
    console.log(`📊 [DIAGNOSTIC] Complete (${duration}ms)\n`);

    res.json({
      success: true,
      userId: req.user.id,
      stats: {
        totalNotifications: totalUserNotifs,
        unreadCount,
        orphanedCount,
        byType,
        sampleNotifications: samples.map(n => ({
          id: n._id,
          type: n.type,
          senderId: n.senderId,
          createdAt: n.createdAt,
          read: n.read
        }))
      }
    });
  } catch (error) {
    console.error(`❌ [DIAGNOSTIC] Error:`, error.message);
    res.status(500).json({
      error: 'Failed to generate diagnostic stats',
      message: error.message
    });
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