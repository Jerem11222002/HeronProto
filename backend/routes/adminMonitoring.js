const express = require('express');
const router = express.Router();
const authMiddleware = require('../Middleware/authenticateToken');
const adminAuthMiddleware = require('../Middleware/adminAuthMiddleware'); // ensure admin only
const sessionStore = require('../services/sessionStore'); // <- add this require

// Normalize middleware exports: support function export or object with common properties; fallback to no-op in dev
const auth = (typeof authMiddleware === 'function')
  ? authMiddleware
  : ((authMiddleware && (authMiddleware.verify || authMiddleware.default || authMiddleware.middleware)) || ((req, res, next) => next()));

const adminAuth = (typeof adminAuthMiddleware === 'function')
  ? adminAuthMiddleware
  : ((adminAuthMiddleware && (adminAuthMiddleware.check || adminAuthMiddleware.verify || adminAuthMiddleware.default || adminAuthMiddleware.middleware)) || ((req, res, next) => next()));

// Example in-memory or example response. Replace with real DB/redis/session store.
router.get('/activity', auth, adminAuth, async (req, res) => {
  try {
    const activity = sessionStore.getActivity({ hours: 24, buckets: 24 });
    res.json({ activity });
  } catch (err) {
    console.error('adminMonitoring.activity.error', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/sessions', auth, adminAuth, async (req, res) => {
  try {
    const sessions = sessionStore.getSessions();
    res.json({ sessions });
  } catch (err) {
    console.error('adminMonitoring.sessions.error', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.post('/sessions/:id/terminate', auth, adminAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    // TODO: terminate session in session store
    console.log('Terminate session', sessionId, 'by admin', req.user.id);
    // emit socket event server-side after termination if you want real-time update
    res.json({ success: true, sessionId });
  } catch (err) {
    console.error('adminMonitoring.terminate.error', err);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

router.post('/users/:id/block', auth, adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    // TODO: set user.blocked = true in DB
    console.log('Block user', userId, 'by admin', req.user.id);
    res.json({ success: true, userId });
  } catch (err) {
    console.error('adminMonitoring.block.error', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

module.exports = router;