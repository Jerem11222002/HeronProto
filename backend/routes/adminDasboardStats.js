const router = require('express').Router();
const { adminAuthMiddleware } = require('../Middleware/adminAuthMiddleware');
const User = require('../models/users');
const Event = require('../models/event');
const EventRegistration = require('../models/eventRegistration');
const Activity = require('../models/activity');
const logger = require('../utils/logger'); // centralized backend logger

// Stats route
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    // Log presence of auth header (don't print full token in prod)
    logger.info('admin.stats.fetch.start', { path: req.path, hasAuthHeader: !!req.headers.authorization });

    // Total users
    const totalUsersPromise = User.countDocuments();

    // Consider "upcoming/active" events as those with a future date (use model 'date' field)
    const now = new Date();
    const upcomingEventsDocsPromise = Event.find({ date: { $gte: now } }).select('_id').lean();

    // Resolve counts
    const [totalUsers, upcomingEventsDocs] = await Promise.all([
      totalUsersPromise,
      upcomingEventsDocsPromise
    ]);

    const upcomingEventIds = (upcomingEventsDocs || []).map(d => d._id);
    const upcomingEvents = upcomingEventIds.length;

    // Count participants robustly:
    // - Sum embedded arrays and engagementMetrics.registrations on Event documents
    // - Count EventRegistration documents referencing those events
    // Use the larger value to avoid undercounting (handles either storage strategy).
    let totalParticipants = 0;
    if (upcomingEventIds.length > 0) {
      // 1) sum embedded arrays + engagementMetrics
      const embeddedAgg = await Event.aggregate([
        { $match: { _id: { $in: upcomingEventIds } } },
        {
          $project: {
            regArrayCount: { $size: { $ifNull: ['$registrations', []] } },
            participantsArrayCount: { $size: { $ifNull: ['$participants', []] } },
            engagementRegs: { $ifNull: ['$engagementMetrics.registrations', 0] },
            interestedArrayCount: { $size: { $ifNull: ['$interested', []] } }
          }
        },
        {
          $group: {
            _id: null,
            totalFromEvents: {
              $sum: { $add: ['$regArrayCount', '$participantsArrayCount', '$engagementRegs', '$interestedArrayCount'] }
            }
          }
        }
      ]);

      const totalFromEvents = Array.isArray(embeddedAgg) && embeddedAgg[0] && typeof embeddedAgg[0].totalFromEvents === 'number'
        ? embeddedAgg[0].totalFromEvents
        : 0;

      // 2) count EventRegistration documents for upcoming events
      const registrationCount = await EventRegistration.countDocuments({ eventId: { $in: upcomingEventIds } });

      // prefer the more complete source
      totalParticipants = Math.max(totalFromEvents, registrationCount);
    } else {
      totalParticipants = 0;
    }

    // Online users: try req.app store, otherwise use socket.io if available
    const onlineStore = req.app.get('onlineUsers');
    let onlineUsers = 0;
    if (onlineStore) {
      if (typeof onlineStore.size === 'number') onlineUsers = onlineStore.size;
      else if (Array.isArray(onlineStore)) onlineUsers = onlineStore.length;
      else if (typeof onlineStore === 'object') onlineUsers = Object.keys(onlineStore).length;
    } else {
      // fallback: use socket.io instance attached to app (if present)
      const io = req.app.get('io');
      try {
        if (io && io.of && io.of('/').sockets) {
          // socket.io v4: size
          onlineUsers = typeof io.of('/').sockets.size === 'number'
            ? io.of('/').sockets.size
            : Object.keys(io.of('/').sockets).length;
        }
      } catch (e) {
        onlineUsers = 0;
      }
    }

    logger.info('admin.stats.fetched', {
      totalUsers,
      activeEvents: upcomingEvents,
      totalParticipants,
      onlineUsers,
      timestamp: new Date().toISOString()
    });

    res.json({
      totalUsers,
      activeEvents: upcomingEvents,
      totalParticipants,
      onlineUsers
    });
  } catch (err) {
    logger.error('admin.stats.error', { message: err?.message || String(err), stack: err?.stack });
    return res.status(500).json({ message: 'Failed to fetch dashboard stats', error: err?.message || 'unknown' });
  }
});

// Activities route
router.get('/activities', adminAuthMiddleware, async (req, res) => {
  try {
    const activities = await Activity
      .find()
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    
    res.json(activities);
  } catch (error) {
    logger.error('admin.activities.error', { message: error?.message || String(error) });
    res.status(500).json({ 
      message: 'Failed to fetch activities',
      error: error.message 
    });
  }
});

// Upcoming events route
router.get('/events/upcoming', adminAuthMiddleware, async (req, res) => {
  try {
    const now = new Date();

    // Query using model 'date' field; include canonical statuses and return more items
    const events = await Event.aggregate([
      {
        $match: {
          date: { $gte: now },
          $or: [
            { status: { $in: ['upcoming', 'ongoing'] } },
            { status: { $exists: false } } // include events without status
          ]
        }
      },
      { $sort: { date: 1 } },
      { $limit: 10 }, // return more upcoming events so dashboard can show the newest
       // lookup participant counts from EventRegistration
       {
         $lookup: {
           from: 'eventregistrations',
           let: { eventId: '$_id' },
           pipeline: [
             { $match: { $expr: { $or: [
               { $eq: ['$event', '$$eventId'] },
               { $eq: ['$eventId', '$$eventId'] },
               { $eq: ['$event_id', '$$eventId'] }
             ] } } },
             { $count: 'count' }
           ],
           as: 'regInfo'
         }
       },
       {
         $addFields: {
           participantCount: { $ifNull: [{ $arrayElemAt: ['$regInfo.count', 0] }, 0] }
         }
       },
       {
         $project: {
           regInfo: 0
         }
       }
     ]);
 
     res.json(events);
   } catch (error) {
     logger.error('admin.events.upcoming.error', { message: error?.message || String(error) });
     res.status(500).json({ 
       message: 'Failed to fetch upcoming events',
       error: error.message 
     });
   }
});

// Event registrations counts route
router.get('/registrations/counts', adminAuthMiddleware, async (req, res) => {
  try {
    // total registrations and breakdown by status
    const agg = await EventRegistration.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = agg.reduce((acc, cur) => {
      acc[cur._id || 'unknown'] = cur.count;
      return acc;
    }, {});

    const total = Object.values(counts).reduce((s, v) => s + v, 0);

    return res.json({ total, breakdown: counts });
  } catch (err) {
    logger.error('admin.registrations.counts.error', { message: err?.message || String(err) });
    return res.status(500).json({ message: 'Failed to fetch registration counts' });
  }
});

// Public debug route (TEMP) — call from browser to verify DB counts without auth
router.get('/stats/public-debug', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeEvents = await Event.countDocuments({ status: 'upcoming' });
    // count registrations across EventRegistration collection for active events
    const regCount = await EventRegistration.countDocuments({}); // total registrations
    return res.json({ totalUsers, activeEvents, registrations: regCount });
  } catch (error) {
    logger.error('admin.stats.publicDebug.error', { message: error?.message || String(error) });
    res.status(500).json({ error: error?.message || 'failed' });
  }
});

module.exports = router;