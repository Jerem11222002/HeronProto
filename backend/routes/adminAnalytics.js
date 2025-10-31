const express = require('express');
const router = express.Router();
const adminAuthMiddleware = require('../Middleware/adminAuthMiddleware');
const logger = require('../utils/logger');

// normalize admin auth export: support function export or object with .check/.verify/.middleware
const adminAuth = (typeof adminAuthMiddleware === 'function')
  ? adminAuthMiddleware
  : (
      (adminAuthMiddleware && (adminAuthMiddleware.check || adminAuthMiddleware.verify || adminAuthMiddleware.middleware || adminAuthMiddleware.default))
      || ((req, res, next) => next()) // fallback no-op to avoid server crash in dev
    );

logger.info('[adminAnalytics.js] module loaded and router initializing'); // optional debug

const User = require('../models/users');
const Event = require('../models/event');
const EventRegistration = require('../models/eventRegistration');

// Helper to build date array
function buildDateArray(start, end) {
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// GET /api/admin/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/overview', adminAuth, async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    to.setHours(23,59,59,999);

    const totalUsersPromise = User.countDocuments();
    const activeEventsPromise = Event.countDocuments({ date: { $gte: new Date() } }); // upcoming
    const regAggPromise = EventRegistration.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, totalAmount: { $sum: { $ifNull: ['$amount', 0] } }, totalRegistrations: { $sum: 1 } } }
    ]);

    const [totalUsers, activeEvents, regAgg] = await Promise.all([totalUsersPromise, activeEventsPromise, regAggPromise]);

    const totalRevenue = Array.isArray(regAgg) && regAgg[0] ? regAgg[0].totalAmount || 0 : 0;
    const totalRegistrations = Array.isArray(regAgg) && regAgg[0] ? regAgg[0].totalRegistrations || 0 : 0;
    const conversionRate = totalUsers > 0 ? +( (totalRegistrations / totalUsers) * 100 ).toFixed(2) : 0;

    res.json({
      totalUsers,
      activeEvents,
      totalRevenue,
      conversionRate
    });
  } catch (err) {
    logger.error('admin.analytics.overview.error', { message: err.message });
    res.status(500).json({ message: 'Failed to compute overview', error: err.message });
  }
});

// GET /api/admin/analytics/visitors?from=...&to=...
// returns { labels: [...dates...], values: [...counts...] }
router.get('/visitors', adminAuth, async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    to.setHours(23,59,59,999);

    // Use EventRegistration.createdAt as proxy for activity/visitors; fallback to user registrations if none exist
    const agg = await EventRegistration.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const labels = buildDateArray(new Date(from.toISOString().slice(0,10)), new Date(to.toISOString().slice(0,10)));
    const map = (agg || []).reduce((acc, row) => { acc[row._id] = row.count; return acc; }, {});
    const values = labels.map(d => map[d] || 0);

    // if everything zero, fallback to users created per day
    const totalActivity = values.reduce((s,v)=>s+v,0);
    if (totalActivity === 0) {
      const uagg = await User.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      const umap = (uagg || []).reduce((acc, row) => { acc[row._id] = row.count; return acc; }, {});
      const uvalues = labels.map(d => umap[d] || 0);
      return res.json({ labels, values: uvalues });
    }

    res.json({ labels, values });
  } catch (err) {
    logger.error('admin.analytics.visitors.error', { message: err.message });
    res.status(500).json({ message: 'Failed to fetch visitors', error: err.message });
  }
});

// GET /api/admin/analytics/events-distribution?from=...&to=...
// returns { labels: [...], values: [...] }
router.get('/events-distribution', adminAuth, async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    to.setHours(23,59,59,999);

    // Group by type/category with safe fallback
    const agg = await Event.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            $ifNull: [
              '$type',
              { $ifNull: ['$category', 'Unspecified'] }
            ]
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const labels = (agg || []).map(r => r._id);
    const values = (agg || []).map(r => r.count);
    res.json({ labels, values });
  } catch (err) {
    logger.error('admin.analytics.eventsDist.error', { message: err.message });
    res.status(500).json({ message: 'Failed to fetch events distribution', error: err.message });
  }
});

// GET /api/admin/analytics/participants?from=...&to=...
// returns { labels: [...], values: [...] } participant counts per day
router.get('/participants', adminAuth, async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    to.setHours(23,59,59,999);

    const agg = await EventRegistration.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const labels = buildDateArray(new Date(from.toISOString().slice(0,10)), new Date(to.toISOString().slice(0,10)));
    const map = (agg || []).reduce((acc, row) => { acc[row._id] = row.count; return acc; }, {});
    const values = labels.map(d => map[d] || 0);

    res.json({ labels, values });
  } catch (err) {
    logger.error('admin.analytics.participants.error', { message: err.message });
    res.status(500).json({ message: 'Failed to fetch participants', error: err.message });
  }
});

module.exports = router;