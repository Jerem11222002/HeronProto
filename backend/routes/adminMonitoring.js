const express = require('express');
const router = express.Router();
const UserSession = require('../models/userSession');
const PerformanceMetrics = require('../models/performanceMetrics');
const ErrorLog = require('../models/errorLog');
const SecurityEvent = require('../models/securityEvent');
const { adminAuthMiddleware, requireAdminRole } = require('../Middleware/adminAuthMiddleware');
const authenticateToken = require('../Middleware/authenticateToken');
const { io } = require('../../server');
const { getLocationFromIP, getClientIP } = require('../utils/geoipService');

// Helper to apply auth middleware to specific routes
const applyAdminAuth = () => adminAuthMiddleware;

// ==================== SESSION TRACKING ====================

// Get active sessions - admin only
router.get('/sessions', adminAuthMiddleware, async (req, res) => {
  try {
    const sessions = await UserSession.getActiveSessions();
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DEBUG: Get ALL sessions (including completed) with raw data
router.get('/sessions/debug', requireAdminRole('super'), async (req, res) => {
  try {
    const sessions = await UserSession.find()
      .sort({ startTime: -1 })
      .limit(100)
      .select('sessionId userId isAdmin status startTime device pageViews');
    
    // Group by sessionId to find duplicates
    const bySessionId = {};
    sessions.forEach(s => {
      if (!bySessionId[s.sessionId]) bySessionId[s.sessionId] = [];
      bySessionId[s.sessionId].push(s);
    });
    
    const duplicates = Object.entries(bySessionId).filter(([k, v]) => v.length > 1);
    
    res.json({
      success: true,
      total: sessions.length,
      active: sessions.filter(s => s.status === 'active').length,
      duplicates: duplicates.length,
      duplicateDetails: duplicates.map(([id, docs]) => ({ sessionId: id, count: docs.length, docs })),
      recentSessions: sessions.slice(0, 20)
    });
  } catch (error) {
    console.error('Debug sessions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DEBUG: Cleanup duplicate sessions
router.post('/sessions/cleanup-duplicates', requireAdminRole('super'), async (req, res) => {
  try {
    // Find all duplicate sessionIds
    const duplicates = await UserSession.aggregate([
      { $group: { _id: '$sessionId', count: { $sum: 1 }, docs: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    let deleted = 0;
    
    for (const dup of duplicates) {
      // Keep the first one (most recent), delete the rest
      const idsToDelete = dup.docs.slice(1);
      const result = await UserSession.deleteMany({ _id: { $in: idsToDelete } });
      deleted += result.deletedCount;
    }
    
    res.json({ success: true, duplicatesFound: duplicates.length, deleted });
  } catch (error) {
    console.error('Cleanup duplicates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DEBUG: Clear all sessions (nuclear option)
router.post('/sessions/clear-all', requireAdminRole('super'), async (req, res) => {
  try {
    const result = await UserSession.deleteMany({});
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Clear sessions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get session statistics - admin only
router.get('/sessions/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const stats = await UserSession.getSessionStats(hours);
    
    // Get device breakdown - use lastActivity to capture active sessions
    const deviceStats = await UserSession.aggregate([
      { $match: { lastActivity: { $gte: startDate } } },
      { $group: { _id: '$device.type', count: { $sum: 1 } } }
    ]);
    
    // Get browser breakdown - use lastActivity to capture active sessions
    const browserStats = await UserSession.aggregate([
      { $match: { lastActivity: { $gte: startDate } } },
      { $group: { _id: '$device.browser', count: { $sum: 1 } } }
    ]);
    
    res.json({ 
      success: true, 
      stats,
      deviceBreakdown: deviceStats,
      browserBreakdown: browserStats
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Terminate session - admin only
router.post('/sessions/:sessionId/terminate', adminAuthMiddleware, async (req, res) => {
  try {
    const session = await UserSession.findOne({ sessionId: req.params.sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    session.status = 'terminated';
    session.endTime = new Date();
    await session.save();
    
    // Notify via socket
    if (io) {
      io.to(`session_${req.params.sessionId}`).emit('session:terminated', {
        reason: 'Admin terminated session'
      });
    }
    
    res.json({ success: true, message: 'Session terminated' });
  } catch (error) {
    console.error('Terminate session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Block user
router.post('/users/:userId/block', requireAdminRole('super'), async (req, res) => {
  try {
    const User = require('../models/users');
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.isBlocked = true;
    user.blockedAt = new Date();
    user.blockedBy = req.user._id;
    await user.save();
    
    // Log security event
    await SecurityEvent.create({
      eventType: 'account_lockout',
      severity: 'high',
      userId: req.params.userId,
      sourceIp: req.ip,
      details: {
        action: 'admin_block',
        performedBy: req.user._id
      }
    });
    
    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== PERFORMANCE METRICS ====================

// Get performance metrics - admin only
router.get('/performance', adminAuthMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const pageUrl = req.query.pageUrl;
    
    const metrics = await PerformanceMetrics.getAverageMetrics(hours, pageUrl);
    const trends = await PerformanceMetrics.getPerformanceTrends(hours);
    
    // Get pages with slowest load times
    const slowPages = await PerformanceMetrics.aggregate([
      { $match: { timestamp: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) } } },
      { $group: { 
        _id: '$pageUrl', 
        avgLoadTime: { $avg: '$metrics.windowLoadTime' },
        p95LoadTime: { $avg: '$metrics.windowLoadTime' },
        count: { $sum: 1 }
      }},
      { $sort: { avgLoadTime: -1 } },
      { $limit: 10 }
    ]);
    
    // Get alerts
    const alerts = await PerformanceMetrics.find({
      timestamp: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
      'alerts.0': { $exists: true }
    })
    .sort({ timestamp: -1 })
    .limit(50)
    .select('pageUrl alerts timestamp');
    
    res.json({
      success: true,
      metrics,
      trends,
      slowPages,
      alerts
    });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ERROR LOGGING ====================

// Get error statistics - admin only
router.get('/errors', adminAuthMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await ErrorLog.getErrorStats(hours);
    const trend = await ErrorLog.getTrend(hours);
    
    res.json({
      success: true,
      ...stats,
      trend
    });
  } catch (error) {
    console.error('Get errors error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark error as resolved
router.patch('/errors/:errorId/resolve', async (req, res) => {
  try {
    const error = await ErrorLog.findById(req.params.errorId);
    if (!error) {
      return res.status(404).json({ success: false, message: 'Error not found' });
    }
    
    error.resolved = true;
    error.resolvedAt = new Date();
    error.resolvedBy = req.user._id;
    error.resolution = req.body.resolution;
    await error.save();
    
    res.json({ success: true, message: 'Error marked as resolved' });
  } catch (error) {
    console.error('Resolve error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SECURITY EVENTS ====================

// Get security statistics - admin only
router.get('/security', adminAuthMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await SecurityEvent.getSecurityStats(hours);
    const geographicThreats = await SecurityEvent.getGeographicThreats(hours);
    
    res.json({
      success: true,
      ...stats,
      geographicThreats
    });
  } catch (error) {
    console.error('Get security stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Acknowledge security event
router.patch('/security/:eventId/acknowledge', async (req, res) => {
  try {
    const event = await SecurityEvent.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    event.acknowledged = true;
    event.acknowledgedBy = req.user._id;
    event.acknowledgedAt = new Date();
    await event.save();
    
    res.json({ success: true, message: 'Event acknowledged' });
  } catch (error) {
    console.error('Acknowledge event error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ACTIVITY & ANALYTICS ====================

// Get real-time activity data - admin only
router.get('/activity', adminAuthMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Aggregate activity by hour - use lastActivity to capture active sessions
    const activity = await UserSession.aggregate([
      { $match: { lastActivity: { $gte: startDate } } },
      {
        $group: {
          _id: {
            hour: { $hour: '$lastActivity' },
            date: { $dateToString: { format: '%Y-%m-%d', date: '$lastActivity' } }
          },
          users: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      { $sort: { '_id.date': 1, '_id.hour': 1 } }
    ]);
    
    // Format for chart
    const formatted = activity.map(a => ({
      timestamp: `${a._id.date} ${String(a._id.hour).padStart(2, '0')}:00`,
      users: a.users,
      uniqueUsers: a.uniqueUsers.length
    }));
    
    res.json({ success: true, activity: formatted });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device and browser analytics - admin only
router.get('/analytics/devices', adminAuthMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Use lastActivity to capture all active sessions within the time window
    const [devices, browsers, os] = await Promise.all([
      UserSession.aggregate([
        { $match: { lastActivity: { $gte: startDate } } },
        { $group: { _id: '$device.type', count: { $sum: 1 }, users: { $addToSet: '$userId' } } }
      ]),
      UserSession.aggregate([
        { $match: { lastActivity: { $gte: startDate } } },
        { $group: { _id: '$device.browser', count: { $sum: 1 } } }
      ]),
      UserSession.aggregate([
        { $match: { lastActivity: { $gte: startDate } } },
        { $group: { _id: '$device.os', count: { $sum: 1 } } }
      ])
    ]);
    
    res.json({
      success: true,
      devices,
      browsers,
      os
    });
  } catch (error) {
    console.error('Get device analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get geographical analytics - admin only
router.get('/analytics/geo', adminAuthMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Use lastActivity instead of startTime to capture active sessions
    const geoData = await UserSession.aggregate([
      { 
        $match: { 
          lastActivity: { $gte: startDate },
          'location.country': { $exists: true, $ne: null, $ne: '' }
        } 
      },
      {
        $group: {
          _id: '$location.country',
          sessions: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          cities: { $addToSet: '$location.city' }
        }
      },
      { $sort: { sessions: -1 } },
      { $limit: 20 }
    ]);
    
    res.json({
      success: true,
      geoData
    });
  } catch (error) {
    console.error('Get geo analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== DATA COLLECTION ENDPOINTS (from frontend) ====================

// Collect performance metrics - any logged-in user (uses authenticateToken, NOT adminAuthMiddleware)
router.post('/collect/performance', authenticateToken, async (req, res) => {
  try {
    const metric = await PerformanceMetrics.create({
      ...req.body,
      userId: req.user?._id
    });
    
    // Check for performance alerts
    const alerts = [];
    if (req.body.metrics?.windowLoadTime > 3000) {
      alerts.push({ type: 'slow_page', severity: 'medium', message: 'Page load time exceeded 3s' });
    }
    if (req.body.metrics?.lcp > 2500) {
      alerts.push({ type: 'slow_page', severity: 'high', message: 'Largest Contentful Paint exceeded 2.5s' });
    }
    
    if (alerts.length > 0) {
      metric.alerts = alerts;
      await metric.save();
      
      // Emit real-time alert
      if (io) {
        io.to('admin:monitoring').emit('performance:alert', {
          metric: req.body.pageUrl,
          alerts
        });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Collect performance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Collect error logs - any logged-in user (uses authenticateToken, NOT adminAuthMiddleware)
router.post('/collect/error', authenticateToken, async (req, res) => {
  try {
    const errorLog = await ErrorLog.create({
      ...req.body,
      userId: req.user?._id
    });
    
    // Emit real-time error to admins
    if (io) {
      io.to('admin:monitoring').emit('error:new', {
        error: errorLog
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    // Don't expose duplicate errors
    if (error.isDuplicate) {
      return res.json({ success: true, merged: true });
    }
    console.error('Collect error error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Collect user interactions - any logged-in user (uses authenticateToken, NOT adminAuthMiddleware)
router.post('/collect/interaction', authenticateToken, async (req, res) => {
  try {
    const { sessionId, interaction } = req.body;
    
    await UserSession.findOneAndUpdate(
      { sessionId },
      { $push: { interactions: interaction } },
      { upsert: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Collect interaction error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Collect session data - any logged-in user (uses authenticateToken, NOT adminAuthMiddleware)
router.post('/collect/session', authenticateToken, async (req, res) => {
  try {
    const { sessionId, pageView, device, location, referrer } = req.body;
    const now = new Date();
    
    console.log(`[Session] Collect request: ${sessionId?.substring(0,8)}, pageView: ${pageView?.url}`);
    
    // First try to find existing session
    let session = await UserSession.findOne({ sessionId });
    
    // Get location from IP if not provided or empty
    let sessionLocation = location;
    if (!sessionLocation || !sessionLocation.country) {
      const clientIP = getClientIP(req);
      sessionLocation = await getLocationFromIP(clientIP);
      console.log(`[Session] Location from IP ${clientIP}:`, sessionLocation);
    }
    
    if (!session) {
      console.log(`[Session] Creating NEW session: ${sessionId?.substring(0,8)}`);
      // Create new session with proper initialization
      session = new UserSession({
        sessionId,
        userId: req.user?._id,
        isAdmin: req.user?.isAdmin || false,
        status: 'active',
        startTime: now,
        lastActivity: now,  // CRITICAL: Set lastActivity on creation
        entryPage: pageView?.url,
        device: device || { type: 'unknown' },
        location: sessionLocation,
        ipAddress: getClientIP(req),
        pageViews: pageView ? [pageView] : [],
        'metadata.referrer': referrer
      });
    } else {
      console.log(`[Session] Updating EXISTING: ${sessionId?.substring(0,8)}, status: ${session.status}`);
      // Update existing session
      if (pageView) {
        session.pageViews.push(pageView);
      }
      session.userId = req.user?._id || session.userId;
      session.isAdmin = req.user?.isAdmin || session.isAdmin;
      session.lastActivity = now;  // CRITICAL: Update lastActivity on every interaction
      
      // Update device if not set
      if ((!session.device?.type || session.device.type === 'unknown') && device) {
        session.device = device;
      }
      
      // Update location if not set
      if ((!session.location?.country || session.location?.isLocal) && sessionLocation?.country && !sessionLocation?.isLocal) {
        session.location = sessionLocation;
        session.ipAddress = getClientIP(req);
      }
    }
    
    await session.save();
    console.log(`[Session] Saved: ${sessionId?.substring(0,8)}, lastActivity: ${session.lastActivity}`);
    
    res.json({ success: true, sessionId: session._id });
  } catch (error) {
    console.error('Collect session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update session status (heartbeat) - any logged-in user (uses authenticateToken, NOT adminAuthMiddleware)
router.post('/collect/session/heartbeat', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    await UserSession.findOneAndUpdate(
      { sessionId },
      { 
        $set: { 
          status: 'active',
          lastActivity: new Date()
        }
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Session heartbeat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bug Reports Integration for Monitoring Dashboard
router.get('/bug-reports/overview', adminAuthMiddleware, async (req, res) => {
  try {
    const BugReport = require('../models/bugReport');
    const stats = await BugReport.aggregate([
      { $match: {} },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unresolved: { $sum: { $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          recent: { $sum: { $cond: [{ $gte: ['$createdAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] }, 1, 0] } }
        }
      }
    ]);

    const byStatus = await BugReport.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const byCategory = await BugReport.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const recentReports = await BugReport.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'username name profilePic')
      .populate('assignedTo', 'username name profilePic');

    res.json({
      success: true,
      stats: stats[0] || { total: 0, unresolved: 0, critical: 0, recent: 0 },
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byCategory: byCategory.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {}),
      recentReports
    });
  } catch (error) {
    console.error('Bug report overview error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
