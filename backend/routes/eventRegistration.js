const express = require('express');
const router = express.Router();
const authenticate = require("../Middleware/authenticateToken"); // Import user auth middleware
const mongoose = require('mongoose');
const EventRegistration = require("../models/eventRegistration");
const Event = require("../models/event");
const { adminAuthMiddleware } = require("../Middleware/adminAuthMiddleware");
const User = require("../models/users");
const multer = require('multer');
const { createAdminNotification } = require('./adminNotifications');

console.log('[EventRegistration] Route module loaded, createAdminNotification:', typeof createAdminNotification);

// Multer configuration for parsing multipart/form-data (file uploads)
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory for processing
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// Get event details with registration count
router.get("/events/:eventId", async (req, res) => {
  console.log('Fetching event details for ID:', req.params.eventId);
  try {
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      console.log('Invalid ObjectId format:', req.params.eventId);
      return res.status(400).json({ message: "Invalid event ID format" });
    }

    const event = await Event.findById(req.params.eventId)
      .select('-__v')
      .lean();

    console.log('Found event:', event);

    if (!event) {
      console.log('Event not found for ID:', req.params.eventId);
      return res.status(404).json({ message: "Event not found" });
    }

    // Get registration count with improved query
    const registrationCount = await EventRegistration.countDocuments({ 
      eventId: req.params.eventId,
      status: { $in: ['pending', 'approved'] }
    });

    console.log('Current registration count:', registrationCount);
    console.log('Max participants:', event.maxParticipants);

    const isEventFull = event.maxParticipants && registrationCount >= event.maxParticipants;

    // Return combined event and registration data
    res.status(200).json({
      ...event,
      currentParticipants: registrationCount,
      maxParticipants: event.maxParticipants || null,
      isRegistrationOpen: !isEventFull,
      isFull: isEventFull
    });
  } catch (err) {
    console.error('Error in event registration:', err);
    res.status(500).json({ 
      message: "Error fetching event details",
      error: err.message 
    });
  }
});

// User registration for an event (with authentication)
// Uses multer.any() to parse multipart/form-data when files are present
router.post('/register', upload.any(), authenticate, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ message: 'Event ID is required.' });

    // Fetch event and its registrationForm
    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    req.body.organization = event.organization;

    // --- Robustly sanitize uploadedFiles ---
    let { uploadedFiles = [] } = req.body;
    if (typeof uploadedFiles === 'string') {
      try {
        uploadedFiles = JSON.parse(uploadedFiles);
        if (typeof uploadedFiles === 'string') uploadedFiles = JSON.parse(uploadedFiles);
      } catch { uploadedFiles = []; }
    }
    if (!Array.isArray(uploadedFiles)) uploadedFiles = [];
    uploadedFiles = uploadedFiles.map(f => {
      if (typeof f === 'string') {
        try { return JSON.parse(f); } catch { return null; }
      }
      return f;
    }).filter(f => f && typeof f === 'object' && f.url);

    // Load full user profile if available to fill missing required fields
    let fullUser = null;
    try {
      const uid = req.user?.id || req.user?._id;
      if (uid) fullUser = await User.findById(uid).lean();
    } catch (e) {
      fullUser = null;
    }

    // Build registration payload from request and user profile.
    // Put unknown/dynamic keys into `formResponses` so they are preserved.
    const allowedSchemaKeys = new Set(Object.keys(EventRegistration.schema.paths || {}));
    const registrationPayload = {
      eventId,
      userId: req.user._id || req.user.id,
      organization: event.organization,
      uploadedFiles
    };

    const formResponses = {};
    // iterate incoming keys and split into allowed top-level fields vs formResponses
    Object.keys(req.body || {}).forEach(k => {
      if (['eventId', 'organization', 'uploadedFiles', 'userId'].includes(k)) return;
      // If key is a known schema path, copy as top-level
      if (allowedSchemaKeys.has(k)) {
        registrationPayload[k] = req.body[k];
      } else {
        // try to parse JSON strings (from FormData)
        let v = req.body[k];
        if (typeof v === 'string') {
          try { v = JSON.parse(v); } catch { /* keep original string */ }
        }
        formResponses[k] = v;
      }
    });
    // attach parsed form responses
    registrationPayload.formResponses = formResponses;

    // Fill basic fields from user profile if missing
    ['name', 'studentId', 'email'].forEach(key => {
      if (!registrationPayload[key]) {
        registrationPayload[key] = fullUser?.[key] || '';
      }
    });

    // --- Dynamic required fields check ---
    // Only require fields present in event.registrationForm and marked as required
    const requiredFields = (event.registrationForm || [])
      .filter(f => f.required)
      .map(f => f.key);

    // For nested fields (e.g. emergencyContact.name), check dot notation
    const getDeep = (obj, path) => {
      if (!obj || !path) return undefined;
      const parts = String(path).split('.');
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    };

    const missing = [];
    requiredFields.forEach(key => {
      const val = getDeep(registrationPayload, key) ?? getDeep(registrationPayload.formResponses || {}, key);
      const empty = (val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0));
      if (empty) missing.push(key);
    });

    if (missing.length > 0) {
      return res.status(400).json({
        message: 'Missing required registration fields. Please complete these fields before submitting.',
        missingFields: missing
      });
    }

    // Save registration
    const newRegistration = new EventRegistration(registrationPayload);
    await newRegistration.save();

    // Create notifications for organization admins and superadmins
    try {
      console.log(`[EventRegistration] Starting notification creation for org: "${event.organization}"`);

      // Find all admins for this organization
      const organizationAdmins = await User.find({
        isAdmin: true,
        adminOrganization: event.organization
      }).select('_id adminOrganization');

      console.log(`[EventRegistration] Found ${organizationAdmins.length} org admins for "${event.organization}":`, organizationAdmins.map(a => ({ id: a._id.toString(), org: a.adminOrganization })));

      // Find all superadmins
      const superadmins = await User.find({
        isAdmin: true,
        adminRole: 'super'
      }).select('_id adminRole');

      console.log(`[EventRegistration] Found ${superadmins.length} superadmins:`, superadmins.map(a => a._id.toString()));

      // Combine unique admin IDs
      const adminIds = [...new Set([
        ...organizationAdmins.map(a => a._id.toString()),
        ...superadmins.map(a => a._id.toString())
      ])];

      console.log(`[EventRegistration] Total unique admin IDs to notify: ${adminIds.length}`, adminIds);

      if (adminIds.length === 0) {
        console.warn(`[EventRegistration] No admins found to notify for organization "${event.organization}"`);
      } else {
        // Get registrant info for the notification message
        const registrantName = registrationPayload.name || fullUser?.name || 'A user';
        const senderId = req.user._id || req.user.id;

        console.log(`[EventRegistration] Creating notifications: senderId=${senderId}, registrantName=${registrantName}`);

        // Create notifications for each admin
        const notificationResults = await Promise.all(
          adminIds.map(async (adminId) => {
            try {
              const notif = await createAdminNotification({
                userId: adminId,
                senderId: senderId,
                type: 'organization_registration',
                message: `${registrantName} registered for "${event.title}"`,
                organization: event.organization,
                data: {
                  eventId: event._id.toString(),
                  eventTitle: event.title,
                  registrationId: newRegistration._id.toString(),
                  registrantName,
                  registrantId: senderId.toString()
                },
                priority: 'medium',
                category: 'system',
                actionUrl: `/admin/participants`
              });
              console.log(`[EventRegistration] ✓ Created notification for admin ${adminId}:`, notif._id.toString());
              return notif;
            } catch (err) {
              console.error(`[EventRegistration] ✗ Failed to create notification for admin ${adminId}:`, err.message);
              return null;
            }
          })
        );

        const successCount = notificationResults.filter(n => n !== null).length;
        console.log(`[EventRegistration] Successfully created ${successCount}/${adminIds.length} notifications`);
      }
    } catch (notifError) {
      // Log but don't fail the registration if notification fails
      console.error('[EventRegistration] Error creating notifications:', notifError);
    }

    res.status(201).json({ success: true, registrationId: newRegistration._id });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: 'Failed to register', error: err.message });
  }
});

// Get registrations for the authenticated user
router.get('/user', authenticate, async (req, res) => {
  try {
    const userId = req.user && (req.user.id || req.user._id);
    if (!userId) return res.status(400).json({ message: 'User ID not found in token.' });

    // Pagination params
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const status = req.query.status; // e.g. pending/approved
    const q = req.query.q && String(req.query.q).trim();
    const eventId = req.query.eventId;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const sortBy = req.query.sortBy || 'registrationDate';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

    const match = { userId: new mongoose.Types.ObjectId(String(userId)) };
    if (status) match.status = status;
    if (eventId) {
      // Allow either string-stored eventId or ObjectId
      if (mongoose.isValidObjectId(eventId)) match.eventId = new mongoose.Types.ObjectId(eventId);
      else match.eventId = eventId;
    }

    if (startDate || endDate) {
      match.$and = match.$and || [];
      const range = {};
      if (startDate) range.$gte = startDate;
      if (endDate) range.$lte = endDate;
      match.$and.push({ $or: [{ registrationDate: range }, { createdAt: range }] });
    }

    // Build aggregation pipeline to allow searching by event title and registration fields
    const pipeline = [ { $match: match } ];

    // lookup event details
    pipeline.push({
      $lookup: {
        from: 'events',
        localField: 'eventId',
        foreignField: '_id',
        as: 'event'
      }
    });
    pipeline.push({ $unwind: { path: '$event', preserveNullAndEmptyArrays: true } });

    // Text / fuzzy query
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'event.title': { $regex: re } },
            { name: { $regex: re } },
            { email: { $regex: re } },
            { 'userId.email': { $regex: re } },
            { 'userId.name': { $regex: re } },
            { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: re } } }
          ]
        }
      });
    }

    // add eventId field from lookup to keep compatibility with frontend
    pipeline.push({ $addFields: { eventId: '$event' } });
    pipeline.push({ $project: { event: 0 } });

    // sorting
    const sortStage = {};
    if (sortBy === 'eventName') sortStage['eventId.title'] = sortDir;
    else if (sortBy === 'status') sortStage['status'] = sortDir;
    else sortStage['registrationDate'] = sortDir;

    pipeline.push({
      $facet: {
        metadata: [ { $count: 'total' } ],
        data: [ { $sort: sortStage }, { $skip: skip }, { $limit: limit } ]
      }
    });

    const agg = await EventRegistration.aggregate(pipeline);
    const meta = (agg[0] && agg[0].metadata && agg[0].metadata[0]) || { total: 0 };
    const data = (agg[0] && agg[0].data) || [];

    res.status(200).json({ success: true, data, total: meta.total || 0, page, limit });
  } catch (err) {
    console.error('Error fetching user registrations:', err);
    res.status(500).json({ message: 'Error fetching registrations', error: err.message });
  }
});

// Get a single registration (owner-only)
router.get('/:registrationId', authenticate, async (req, res) => {
  try {
    const regId = req.params.registrationId;
    if (!mongoose.isValidObjectId(regId)) return res.status(400).json({ message: 'Invalid registration ID.' });

    const registration = await EventRegistration.findById(regId)
      .populate('eventId', 'title startDate endDate slug organization registrationForm')
      .populate('userId', 'name email profilePic')
      .lean();

    if (!registration) return res.status(404).json({ message: 'Registration not found.' });

    const userId = String(req.user.id || req.user._id);
    const ownerId = String(registration.userId && (registration.userId._id || registration.userId));
    if (userId !== ownerId) return res.status(403).json({ message: 'Forbidden' });

    res.status(200).json({ success: true, data: registration });
  } catch (err) {
    console.error('Error fetching registration detail:', err);
    res.status(500).json({ message: 'Error fetching registration', error: err.message });
  }
});

// Get a summary of the current user's registrations (counts by status)
router.get('/user/summary', authenticate, async (req, res) => {
  try {
    const userId = req.user && (req.user.id || req.user._id);
    if (!userId) return res.status(400).json({ message: 'User ID not found in token.' });

    const agg = await EventRegistration.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = agg.reduce((acc, cur) => {
      acc[cur._id || 'unknown'] = cur.count;
      return acc;
    }, {});

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // alertCount: registrations that may require user's attention (pending or rejected)
    const alertCount = (counts.pending || 0) + (counts.rejected || 0);

    res.json({ success: true, counts, total, alertCount });
  } catch (err) {
    console.error('Error building registration summary:', err);
    res.status(500).json({ message: 'Error fetching summary', error: err.message });
  }
});

// Admin routes
router.get("/admin/registrations/:eventId", adminAuthMiddleware, async (req, res) => {
  try {
    const registrations = await EventRegistration.find({ 
      eventId: req.params.eventId 
    })
    .sort({ registrationDate: -1 })
    .populate('userId', 'name email profilePic')
    .populate('eventId', 'title organization')
    .lean();

    res.status(200).json(registrations);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ 
      message: "Error fetching registrations",
      error: err.message 
    });
  }
});

router.patch("/admin/registrations/:registrationId/status", adminAuthMiddleware, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'waitlisted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status value",
        validStatuses 
      });
    }

    const registration = await EventRegistration.findByIdAndUpdate(
      req.params.registrationId,
      { 
        status,
        adminNotes,
        lastModified: new Date(),
        modifiedBy: req.user.id
      },
      { new: true }
    )
    .populate('eventId')
    .populate('userId', 'email name');

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    // Update event counts if needed
    if (status === 'approved') {
      await Event.findByIdAndUpdate(registration.eventId, {
        $inc: { approvedParticipants: 1 }
      });
    }

    res.status(200).json({
      message: "Registration status updated successfully",
      registration
    });
  } catch (err) {
    console.error('Error updating registration:', err);
    res.status(500).json({ 
      message: "Error updating registration",
      error: err.message 
    });
  }
});

router.get("/admin/registrations/all", adminAuthMiddleware, async (req, res) => {
  try {
    console.log('Fetching all registrations for admin');
    
    const registrations = await EventRegistration.find({})
      .sort({ registrationDate: -1 })
      .populate({
        path: 'eventId',
        select: 'title organization registrationForm' // ensure registrationForm is included
      })
      .populate('userId', 'name email profilePic')
      .lean();

    const result = registrations.map(reg => {
      const eventData = reg.eventId || {};
      return {
        ...reg,
        raw: reg,
        eventName: eventData.title || reg.eventName || '',
        eventForm: Array.isArray(eventData.registrationForm) ? eventData.registrationForm : [],
        user: reg.userId || null
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching all registrations:', err);
    res.status(500).json({ 
      message: "Error fetching registrations",
      error: err.message 
    });
  }
});

// BULK counts endpoint: POST /api/event-registrations/counts
// body: { eventIds: ['id1', 'id2', ...] }
router.post('/counts', async (req, res) => {
  try {
    const { eventIds } = req.body;
    console.log('POST /api/event-registrations/counts received eventIds:', eventIds);

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      console.log('No eventIds provided to /counts');
      return res.status(400).json({ error: 'eventIds array required' });
    }

    // Build arrays: valid ObjectIds and raw string IDs (trimmed)
    const objectIds = [];
    const stringIds = [];
    eventIds.forEach(id => {
      const trimmed = typeof id === 'string' ? id.trim() : id;
      if (mongoose.isValidObjectId(trimmed)) {
        objectIds.push(new mongoose.Types.ObjectId(trimmed));
      } else if (typeof trimmed === 'string' && trimmed.length > 0) {
        stringIds.push(trimmed);
      }
    });

    console.log('objectIds:', objectIds);
    console.log('stringIds:', stringIds);

    // Build $match to accept either ObjectId or string-stored eventId
    const matchConditions = [];
    if (objectIds.length) matchConditions.push({ eventId: { $in: objectIds } });
    if (stringIds.length) matchConditions.push({ eventId: { $in: stringIds } });

    if (matchConditions.length === 0) {
      // nothing valid to match
      const resultEmpty = {};
      eventIds.forEach(id => { resultEmpty[id] = { count: 0, maxParticipants: null }; });
      return res.json({ counts: resultEmpty });
    }

    const agg = await EventRegistration.aggregate([
      { $match: { $or: matchConditions } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } }
    ]);

    console.log('Aggregation result for counts:', agg);

    // Normalize aggregation keys to strings
    const countsMap = agg.reduce((acc, cur) => {
      acc[String(cur._id)] = cur.count;
      return acc;
    }, {});

    // Fetch maxParticipants for events (try using objectIds OR stringIds converted to ObjectId where possible)
    const eventIdQueryIds = objectIds.length ? objectIds : (stringIds.length ? stringIds : []);
    const events = eventIdQueryIds.length
      ? await Event.find({ _id: { $in: eventIdQueryIds } }).select('maxParticipants').lean()
      : [];

    const maxMap = events.reduce((acc, e) => {
      acc[String(e._id)] = e.maxParticipants ?? null;
      return acc;
    }, {});

    const result = {};
    eventIds.forEach(id => {
      // try exact key, then fallback to trimmed or ObjectId string
      const key = String(id).trim();
      result[id] = {
        count: countsMap[key] ?? countsMap[mongoose.Types.ObjectId.isValid(key) ? String(new mongoose.Types.ObjectId(key)) : key] ?? 0,
        maxParticipants: maxMap[key] ?? maxMap[mongoose.Types.ObjectId.isValid(key) ? String(new mongoose.Types.ObjectId(key)) : key] ?? null
      };
    });

    console.log('Counts response prepared:', result);
    return res.json({ counts: result });
  } catch (err) {
    console.error('event-registrations/counts error', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Email verification endpoint
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  const registration = await EventRegistration.findOne({ verificationToken: token });
  if (!registration) return res.status(400).send('Invalid or expired token');
  registration.verified = true;
  registration.verificationToken = undefined;
  await registration.save();
  res.send('Email verified! Registration confirmed.');
});

module.exports = router;