const express = require('express');
const router = express.Router();
const authenticate = require("../Middleware/authenticateToken"); // Import user auth middleware
const mongoose = require('mongoose');
const EventRegistration = require("../models/eventRegistration");
const Event = require("../models/event");
const { adminAuthMiddleware } = require("../Middleware/adminAuthMiddleware");
const User = require("../models/users");

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
router.post('/register', authenticate, async (req, res) => {
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
      userId: req.user._id,
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
    res.status(201).json({ success: true, registrationId: newRegistration._id });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ message: 'Failed to register', error: err.message });
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

console.log('Schema for uploadedFiles:', EventRegistration.schema.paths.uploadedFiles);

module.exports = router;