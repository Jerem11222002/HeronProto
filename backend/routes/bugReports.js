const express = require('express');
const router = express.Router();
const BugReport = require('../models/bugReport');
const UserSession = require('../models/userSession');
const User = require('../models/users');
const authenticateToken = require('../Middleware/authenticateToken');
const { adminAuthMiddleware } = require('../Middleware/adminAuthMiddleware');
const { getClientIP } = require('../utils/geoipService');
const { createAdminNotification } = require('./adminNotifications');

// Submit a new bug report (user)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, severity, pageUrl } = req.body;

    if (!title || !description || !category || !severity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, description, category, and severity are required' 
      });
    }

    // Get current session info if available
    const session = await UserSession.findOne({
      userId: req.user._id,
      status: 'active'
    }).sort({ lastActivity: -1 });

    const bugReport = await BugReport.create({
      userId: req.user._id,
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      pageUrl: pageUrl || req.headers.referer || '',
      sessionId: session?.sessionId || null,
      userAgent: req.headers['user-agent'] || '',
      metadata: {
        ipAddress: getClientIP(req),
        browser: req.headers['sec-ch-ua'] || '',
        os: req.headers['sec-ch-ua-platform'] || ''
      }
    });

    await bugReport.populate('userId', 'username email name profilePic');

    // Create admin notifications for superadmins
    try {
      // Find all superadmins
      const superadmins = await User.find({
        isAdmin: true,
        adminRole: 'super'
      }).select('_id');

      console.log(`[BugReports] Found ${superadmins.length} superadmins`);

      if (superadmins.length > 0) {
        // Create notification for each superadmin
        await Promise.all(
          superadmins.map(admin =>
            createAdminNotification({
              userId: admin._id.toString(),
              senderId: req.user._id.toString(),
              type: 'bug_report',
              message: `New ${bugReport.severity} bug report: ${bugReport.title}`,
              organization: null, // Bug reports are system-wide
              data: {
                bugReportId: bugReport._id,
                category: bugReport.category,
                severity: bugReport.severity,
                title: bugReport.title
              },
              priority: bugReport.severity === 'critical' ? 'high' : 'medium',
              category: 'bug_report',
              actionUrl: `/admin/bug-reports`
            })
          )
        );
        console.log(`[BugReports] Created ${superadmins.length} notifications for superadmins`);
      } else {
        console.log('[BugReports] No superadmins found to notify');
      }
    } catch (notifError) {
      console.error('[BugReports] Error creating superadmin notifications:', notifError);
      console.error('[BugReports] Error stack:', notifError.stack);
      // Don't fail the bug report submission if notification creation fails
    }

    // Emit real-time update to admin monitoring
    const io = req.app.get('io');
    if (io) {
      console.log('[BugReports] Emitting socket events for new bug report');
      
      // Emit to admin monitoring room
      io.to('admin:monitoring').emit('bugreport:new', {
        report: {
          _id: bugReport._id,
          title: bugReport.title,
          category: bugReport.category,
          severity: bugReport.severity,
          status: bugReport.status,
          user: bugReport.userId,
          createdAt: bugReport.createdAt
        }
      });
      console.log('[BugReports] Emitted bugreport:new to admin:monitoring room');
      
      // Emit admin notification event for real-time badge update and toast
      io.emit('admin:notification:new', {
        type: 'bug_report',
        severity: bugReport.severity,
        title: bugReport.title
      });
      console.log('[BugReports] Emitted admin:notification:new event:', {
        type: 'bug_report',
        severity: bugReport.severity,
        title: bugReport.title
      });
    } else {
      console.warn('[BugReports] Socket.io instance not available');
    }

    res.status(201).json({ success: true, report: bugReport });
  } catch (error) {
    console.error('Bug report submission error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's own bug reports (user)
router.get('/my-reports', authenticateToken, async (req, res) => {
  try {
    const reports = await BugReport.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('title category severity status resolution createdAt updatedAt');

    res.json({ success: true, reports });
  } catch (error) {
    console.error('Fetch user reports error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all bug reports (admin only)
router.get('/all', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const { status, severity, category, assignedTo, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (category) query.category = category;
    if (assignedTo === 'unassigned') query.assignedTo = null;
    else if (assignedTo) query.assignedTo = assignedTo;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total, stats] = await Promise.all([
      BugReport.find(query)
        .populate('userId', 'username email name profilePic')
        .populate('assignedTo', 'username name')
        .populate('resolution.resolvedBy', 'username name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      BugReport.countDocuments(query),
      BugReport.getStats()
    ]);

    res.json({
      success: true,
      reports,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      stats
    });
  } catch (error) {
    console.error('Fetch all reports error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get bug report statistics (admin only)
router.get('/stats', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await BugReport.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Bug report stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a single bug report by ID (admin only)
router.get('/:id', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const report = await BugReport.findById(req.params.id)
      .populate('userId', 'username email name profilePic')
      .populate('assignedTo', 'username name profilePic')
      .populate('resolution.resolvedBy', 'username name')
      .populate('impact.relatedReports', 'title status severity');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Get related session info for context
    const sessionInfo = report.sessionId
      ? await UserSession.findOne({ sessionId: report.sessionId }).select('device location startTime lastActivity pageViews').lean()
      : null;

    res.json({ success: true, report, sessionContext: sessionInfo });
  } catch (error) {
    console.error('Fetch report detail error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update bug report status (admin only)
router.patch('/:id/status', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;

    const update = { status };
    if (status === 'resolved' || status === 'closed') {
      update['resolution.resolvedBy'] = req.user._id;
      update['resolution.resolvedAt'] = new Date();
      if (resolutionNotes) update['resolution.notes'] = resolutionNotes;
    }

    const report = await BugReport.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    )
      .populate('userId', 'username email name profilePic')
      .populate('assignedTo', 'username name');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Emit status update
    const io = req.app.get('io');
    if (io) {
      io.to('admin:monitoring').emit('bugreport:updated', {
        reportId: report._id,
        status: report.status,
        resolution: report.resolution
      });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign bug report to admin (admin only)
router.patch('/:id/assign', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const report = await BugReport.findByIdAndUpdate(
      req.params.id,
      { assignedTo: assignedTo || req.user._id, status: 'in-progress' },
      { new: true }
    )
      .populate('userId', 'username email name profilePic')
      .populate('assignedTo', 'username name profilePic');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Emit assignment update
    const io = req.app.get('io');
    if (io) {
      io.to('admin:monitoring').emit('bugreport:assigned', {
        reportId: report._id,
        assignedTo: report.assignedTo,
        status: report.status
      });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Assign report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add resolution notes (admin only)
router.patch('/:id/notes', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes || !notes.trim()) {
      return res.status(400).json({ success: false, message: 'Notes are required' });
    }

    const report = await BugReport.findByIdAndUpdate(
      req.params.id,
      { 'resolution.notes': notes.trim() },
      { new: true }
    )
      .populate('userId', 'username email name profilePic')
      .populate('resolution.resolvedBy', 'username name');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Add notes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark user as notified (admin only)
router.patch('/:id/notify', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const { type } = req.body; // 'acknowledged', 'assigned', 'resolved', 'updated'

    if (!['acknowledged', 'assigned', 'resolved', 'updated'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid notification type' });
    }

    const report = await BugReport.findByIdAndUpdate(
      req.params.id,
      { [`userNotified.${type}`]: true },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error('Notify user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete bug report (admin/superadmin only)
router.delete('/:id', authenticateToken, adminAuthMiddleware, async (req, res) => {
  try {
    const report = await BugReport.findByIdAndDelete(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
