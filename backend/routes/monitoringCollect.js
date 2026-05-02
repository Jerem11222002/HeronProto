// Data collection endpoints for monitoring - accessible to all authenticated users
const express = require('express');
const router = express.Router();
const UserSession = require('../models/userSession');
const PerformanceMetrics = require('../models/performanceMetrics');
const ErrorLog = require('../models/errorLog');
const authenticateToken = require('../Middleware/authenticateToken');
const { io } = require('../../server');
const { getLocationFromIP, getClientIP } = require('../utils/geoipService');

// Collect performance metrics
router.post('/performance', authenticateToken, async (req, res) => {
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

// Collect error logs
router.post('/error', authenticateToken, async (req, res) => {
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
    if (error.isDuplicate) {
      return res.json({ success: true, merged: true });
    }
    console.error('Collect error error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Collect user interactions
router.post('/interaction', authenticateToken, async (req, res) => {
  try {
    const { sessionId, interaction } = req.body;

    // Only update existing session, don't create new one
    const session = await UserSession.findOne({ sessionId });
    if (session) {
      session.interactions.push(interaction);
      session.lastActivity = new Date();
      await session.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Collect interaction error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Collect session data
router.post('/session', authenticateToken, async (req, res) => {
  try {
    const { sessionId, pageView, device, location, referrer } = req.body;
    const now = new Date();

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    console.log(`[Session] Collect request: ${sessionId.substring(0,8)}, pageView: ${pageView?.url}`);

    // Get location from IP if not provided or empty
    let sessionLocation = location;
    if (!sessionLocation || !sessionLocation.country) {
      const clientIP = getClientIP(req);
      sessionLocation = await getLocationFromIP(clientIP);
      console.log(`[Session] Location from IP ${clientIP}:`, sessionLocation);
    }

    // Use findOneAndUpdate with upsert to prevent race condition duplicates
    const updateData = {
      $setOnInsert: {
        sessionId,
        userId: req.user?._id,
        isAdmin: req.user?.isAdmin || false,
        status: 'active',
        startTime: now,
        entryPage: pageView?.url,
        'metadata.referrer': referrer
      },
      $set: {
        lastActivity: now
      },
      $push: pageView ? { pageViews: pageView } : undefined
    };

    // Only set device on insert or if currently unknown
    if (device && device.type !== 'unknown') {
      updateData.$setOnInsert.device = device;
    }

    // Only set location on insert or if currently empty
    if (sessionLocation?.country && !sessionLocation?.isLocal) {
      updateData.$setOnInsert.location = sessionLocation;
      updateData.$setOnInsert.ipAddress = getClientIP(req);
    }

    // Remove undefined values
    if (!updateData.$push) delete updateData.$push;

    const session = await UserSession.findOneAndUpdate(
      { sessionId },
      updateData,
      { upsert: true, new: true }
    );

    // If session existed, update device if needed
    if (session.startTime < now - 1000 && device && (!session.device?.type || session.device.type === 'unknown')) {
      await UserSession.findOneAndUpdate(
        { sessionId },
        { $set: { device: device } }
      );
    }

    // If session existed, update location if needed
    if (session.startTime < now - 1000 && sessionLocation?.country && (!session.location?.country || session.location?.isLocal)) {
      await UserSession.findOneAndUpdate(
        { sessionId },
        { $set: { location: sessionLocation, ipAddress: getClientIP(req) } }
      );
    }

    console.log(`[Session] Saved: ${sessionId.substring(0,8)}, lastActivity: ${session.lastActivity}`);

    res.json({ success: true, sessionId: session._id });
  } catch (error) {
    console.error('Collect session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update session status (heartbeat)
router.post('/session/heartbeat', authenticateToken, async (req, res) => {
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

// End session (logout)
router.post('/session/end', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const now = new Date();

    const session = await UserSession.findOne({ sessionId });
    if (session) {
      session.status = 'completed';
      session.endTime = now;
      session.duration = Math.round((now - session.startTime) / 1000);
      await session.save();
      console.log(`[Session] Ended: ${sessionId?.substring(0,8)}, duration: ${session.duration}s`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
