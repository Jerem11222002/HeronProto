const router = require("express").Router();
const logger = require('../utils/logger');

// Add these imports so Cloudinary/multer are defined
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

logger.debug('[events.js] module load START', { file: __filename });

let RecommendationService;
try {
  const recModule = require("../services/recommendations");
  RecommendationService = recModule?.RecommendationService || recModule?.default || recModule;
} catch (err) {
  logger.error('[events.js] Failed to require ../services/recommendations:', err && (err.stack || err.message || err));
}

const { adminAuthMiddleware } = require("../Middleware/adminAuthMiddleware");
const authenticate = require("../Middleware/authenticateToken");
const Event = require("../models/event");
const User = require("../models/users");
const EventRegistration = require('../models/eventRegistration');
const EventArchive = require('../models/eventArchive');
const { ORGANIZATION_CATEGORIES, EVENT_STATUS } = require("../utils/constants");
const { createAdminNotification } = require('./adminNotifications');

logger.debug('[events.js] module load COMPLETE', { file: __filename });

// --- Add Cloudinary + upload endpoint HERE (before any param-based routes) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const eventsStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'heron_events',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1600, height: 900, crop: 'limit', quality: 'auto' }],
  }
});

const uploadSingleImage = multer({ storage: eventsStorage }).single('image');

// Admin image upload endpoint for event images (placed before param routes)
router.post('/upload', adminAuthMiddleware, (req, res) => {
  uploadSingleImage(req, res, (err) => {
    if (err) {
      console.error('[events.upload] upload error', err);
      return res.status(500).json({ success: false, message: 'Image upload failed', error: err.message });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // multer-storage-cloudinary provides path/secure_url/url depending on version
    const url = file.path || file.secure_url || file.url || (file?.metadata && file.metadata.secure_url) || null;
    if (!url) {
      console.warn('[events.upload] uploaded file object', file);
      return res.status(500).json({ success: false, message: 'Could not determine uploaded file URL' });
    }
    return res.status(200).json({ success: true, url });
  });
});
// --- end added block ---

// Get all events (accessible by all authenticated users)
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Add helper to sanitize incoming registrationForm payloads
function sanitizeRegistrationForm(input) {
  let arr = [];
  if (!input) return arr;

  // handle JSON string or already-parsed array
  if (typeof input === 'string') {
    try { arr = JSON.parse(input); } catch { arr = []; }
  } else if (Array.isArray(input)) {
    arr = input;
  } else {
    return [];
  }

  if (!Array.isArray(arr)) return [];

  // basic safety: cap fields and normalize shape
  const MAX_FIELDS = 200;
  return arr.slice(0, MAX_FIELDS).map(f => {
    const field = f || {};
    return {
      key: String(field.key || '').trim(),
      label: String(field.label || '').trim(),
      type: String(field.type || 'text'),
      required: !!field.required,
      placeholder: field.placeholder || '',
      hint: field.hint || '',
      options: Array.isArray(field.options) ? field.options.map(String) : [],
      validation: field.validation || {},
      meta: field.meta || {}
    };
  }).filter(f => f.key && f.label && f.type);
}

// Create new event (admin only)
router.post("/", adminAuthMiddleware, async (req, res) => {
  try {
    console.log('Creating new event:', req.body);

    // sanitize registrationForm (if provided)
    const registrationForm = sanitizeRegistrationForm(req.body.registrationForm);

    // normalize date to JS Date (avoid storing raw string which may cause filtering issues)
    const normalizedDate = req.body.date ? new Date(req.body.date) : null;
    if (!normalizedDate || isNaN(normalizedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    // normalize status to lowercase canonical value expected by schema
    const providedStatus = String(req.body.status || EVENT_STATUS?.UPCOMING || 'upcoming').trim();
    const normalizedStatus = providedStatus.toLowerCase();
    const allowedStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
    const finalStatus = allowedStatuses.includes(normalizedStatus) ? normalizedStatus : 'upcoming';

    const newEvent = new Event({
      title: req.body.title,
      description: req.body.description,
      date: normalizedDate,
      image: req.body.image,
      organization: req.body.organization,
      location: req.body.location,
      category: req.body.category,
      status: finalStatus,
      eventType: req.body.eventType || 'watch-only',
      requirements: req.body.requirements || {
        videoRequired: false,
        photoRequired: false,
        experienceRequired: false,
        additionalRequirements: '',
        maxParticipants: null
      },
      ticketing: req.body.ticketing || {
        isPaid: false,
        price: 0,
        availableSeats: 0
      },
      tags: (req.body.tags || []).map(t => String(t).toLowerCase().trim()),
      registrationForm, // persist sanitized form schema
      createdBy: req.user.id
    });

    // Normalize organization to one of the Event schema enum values (case-insensitive)
    try {
      const validOrgs = Array.isArray(Event.schema.path('organization').enumValues)
        ? Event.schema.path('organization').enumValues
        : [];
      const provided = String(newEvent.organization || '').trim();
      const canonical = validOrgs.find(o => String(o).toLowerCase() === provided.toLowerCase());
      if (!canonical) {
        // fallback: try to match against ORGANIZATION_CATEGORIES display values (if any)
        const fallbackMatch = Object.values(ORGANIZATION_CATEGORIES || {}).find(v => String(v).toLowerCase() === provided.toLowerCase());
        if (fallbackMatch) {
          // try to find canonical by matching display value to enum
          const matchedByDisplay = validOrgs.find(o => String(o).toLowerCase() === String(fallbackMatch).toLowerCase());
          if (matchedByDisplay) {
            newEvent.organization = matchedByDisplay;
          } else {
            return res.status(400).json({
              message: 'Invalid organization',
              validOrganizations: validOrgs
            });
          }
        } else {
          return res.status(400).json({
            message: 'Invalid organization',
            validOrganizations: validOrgs
          });
        }
      } else {
        newEvent.organization = canonical;
      }
    } catch (normErr) {
      console.warn('[events] organization normalization failed:', normErr);
      return res.status(400).json({ message: 'Invalid organization' });
    }
    
    const savedEvent = await newEvent.save();
    console.log('Event created:', savedEvent);
    
    // Notify superadmins about the new event (only superadmins, not other orgs)
    try {
      const superadmins = await User.find({
        isAdmin: true,
        adminRole: 'super'
      }).select('_id');

      if (superadmins.length > 0) {
        const creatorName = req.user?.email || req.user?.username || 'An admin';
        
        await Promise.all(
          superadmins.map(admin => 
            createAdminNotification({
              userId: admin._id.toString(),
              senderId: req.user.id || req.user._id,
              type: 'organization_event',
              message: `${creatorName} created event "${savedEvent.title}" for ${savedEvent.organization}`,
              organization: savedEvent.organization,
              data: {
                eventId: savedEvent._id.toString(),
                eventTitle: savedEvent.title,
                eventOrganization: savedEvent.organization,
                createdBy: creatorName
              },
              priority: 'medium',
              category: 'system',
              actionUrl: `/admin/events/${savedEvent._id}`
            }).catch(err => {
              console.error('[Events] Failed to create notification for superadmin:', admin._id, err.message);
            })
          )
        );
        
        console.log(`[Events] Created ${superadmins.length} notifications for superadmins about new event`);
      }
    } catch (notifError) {
      console.error('[Events] Error creating superadmin notifications:', notifError);
    }
    
    // Emit a server-side socket event so admin UIs update in realtime
    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io && typeof io.emit === 'function') {
        io.emit('events:changed', { action: 'created', event: savedEvent });
      }
    } catch (e) { console.warn('[events] realtime emit failed', e); }
    
    res.status(201).json(savedEvent);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ 
      message: 'Failed to create event',
      error: err.message 
    });
  }
});

// Update event (admin only)
router.put("/:id", adminAuthMiddleware, async (req, res) => {
  try {
    const updatePayload = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(req.body, 'registrationForm')) {
      updatePayload.registrationForm = sanitizeRegistrationForm(req.body.registrationForm);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const allowedStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
      const s = String(req.body.status || '').trim().toLowerCase();
      updatePayload.status = allowedStatuses.includes(s) ? s : undefined;
      if (updatePayload.status === undefined) delete updatePayload.status;
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updatePayload },
      { new: true }
    );

    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io && typeof io.emit === 'function') {
        io.emit('events:changed', { action: 'updated', event: updatedEvent });
      }
    } catch (e) { console.warn('[events] realtime emit failed', e); }

    res.status(200).json(updatedEvent);
  } catch (err) {
    res.status(500).json({ error: "Failed to update event" });
  }
});

// Delete event (admin only) -> archive instead of permanent delete
router.delete("/:id", adminAuthMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    // save snapshot to archive
    const archive = new EventArchive({
      originalId: event._id,
      archivedBy: req.user.id,
      eventData: event,
      reason: req.body?.reason || ''
    });
    await archive.save();

    // remove original event and related registrations if desired
    await Event.findByIdAndDelete(req.params.id);

    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io && typeof io.emit === 'function') {
        io.emit('events:changed', { action: 'deleted', eventId: req.params.id });
      }
    } catch (e) { console.warn('[events] realtime emit failed', e); }

    return res.status(200).json({ success: true, message: 'Event archived', archiveId: archive._id });
  } catch (err) {
    console.error('Failed to archive event:', err);
    return res.status(500).json({ error: "Failed to archive event" });
  }
});

// ADMIN: list archived events
router.get("/archive", adminAuthMiddleware, async (req, res) => {
  try {
    const items = await EventArchive.find().sort({ archivedAt: -1 }).lean();
    return res.status(200).json({ success: true, items });
  } catch (err) {
    console.error('Failed to list archived events:', err);
    return res.status(500).json({ success: false, message: 'Failed to list archive' });
  }
});

// ADMIN: restore archived event (recreate event and remove archive)
router.post("/archive/:archiveId/restore", adminAuthMiddleware, async (req, res) => {
  try {
    const archive = await EventArchive.findById(req.params.archiveId).lean();
    if (!archive) return res.status(404).json({ success: false, message: 'Archive not found' });

    const eventData = { ...archive.eventData };
    // remove _id so mongoose will create a new document; keep originalId in archive record
    delete eventData._id;
    // ensure createdBy exists or set to archivedBy
    if (!eventData.createdBy) eventData.createdBy = archive.archivedBy;

    const restored = await Event.create(eventData);
    // remove archive after successful restore
    await EventArchive.findByIdAndDelete(req.params.archiveId);

    return res.status(200).json({ success: true, message: 'Event restored', event: restored });
  } catch (err) {
    console.error('Failed to restore archived event:', err);
    return res.status(500).json({ success: false, message: 'Failed to restore archived event' });
  }
});

// ADMIN: permanently delete an archived record
router.delete("/archive/:archiveId", adminAuthMiddleware, async (req, res) => {
  try {
    const archive = await EventArchive.findById(req.params.archiveId);
    if (!archive) return res.status(404).json({ success: false, message: 'Archive not found' });
    await EventArchive.findByIdAndDelete(req.params.archiveId);
    return res.status(200).json({ success: true, message: 'Archive permanently deleted' });
  } catch (err) {
    console.error('Failed to permanently delete archive:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete archive' });
  }
});

// Get recommended events for user (MOVED here — must appear BEFORE router.get("/:id"))
router.get('/recommended', authenticate, async (req, res) => {
  console.log('[events/recommended] handler ENTRY', { ts: new Date().toISOString(), file: __filename, query: req.query, user: req.user?._id });
  try {
    const includePast = String(req.query.includePast || '').toLowerCase() === 'true';
    const strict = String(req.query.strict || '').toLowerCase() === 'true';
    const userId = req.user?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (strict) {
      try {
        console.log('[events/recommended] strict PATH start', { userId, limit: req.query.limit });
        const limit = parseInt(req.query.limit || '20', 10);
        const user = await User.findById(userId).select('interests organizations following').lean() || { interests: [], organizations: [], following: [] };
        console.log('[events/recommended] fetched user', { userId: user._id, interests: user.interests?.length, orgs: user.organizations?.length });

        const eventsRaw = await RecommendationService.getEventsMatchingUser(user, limit);
        console.log('[events/recommended] RecommendationService returned', { count: Array.isArray(eventsRaw) ? eventsRaw.length : 0 });

        if (String(req.query.debug || '').toLowerCase() === 'true') {
          return res.json({
            success: true,
            events: eventsRaw,
            debug: { requestedLimit: limit, returned: eventsRaw.length, userInterests: user.interests, userOrgs: user.organizations }
          });
        }
        return res.json({ success: true, events: eventsRaw });
      } catch (err) {
        console.error('[events/recommended] strict PATH ERROR', err && (err.stack || err.message || err));
        if (String(req.query.debug || '').toLowerCase() === 'true') {
          return res.status(500).json({ error: 'Failed to fetch event', message: String(err?.message || ''), stack: String(err?.stack || '') });
        }
        return res.status(200).json({ success: true, events: [], debug: { message: 'strict path failed, returning empty list' } });
      }
    }

    try {
      const feed = await RecommendationService.getHybridFeed(userId, { page: 1, limit: 50, sortBy: 'hybrid', includePast });
      const items = Array.isArray(feed?.items) ? feed.items : [];
      const events = items.filter(i => i && i.type === 'event').slice(0, 10);
      if (events.length) return res.json({ success: true, events });
      console.warn('Recommender returned no events, falling back to DB scoring');
    } catch (recErr) {
      console.warn('RecommendationService.getHybridFeed failed:', recErr && recErr.message);
    }

    const user = await User.findById(userId).select('interests implicitPreferences').lean() || { interests: [] };
    user.interests = user.interests || [];

    const now = new Date();
    const statusSet = includePast ? ['upcoming', 'ongoing', 'completed'] : ['upcoming', 'ongoing'];
    const q = { status: { $in: statusSet } };
    if (!includePast) q.date = { $gte: now };

    const eventsRaw = await Event.find(q).lean();
    if (String(req.query.raw || '').toLowerCase() === 'true') {
      return res.json({ success: true, events: eventsRaw.slice(0, 50) });
    }
    const scored = eventsRaw.map(ev => {
      try {
        const timeRelevance = RecommendationService.calculateEventTimeRelevance(ev);
        const score = RecommendationService.calculateEventScore(ev, user);
        return { ...ev, displayScore: { time: timeRelevance, total: score } };
      } catch (err) {
        console.warn('Scoring error for event', ev._id, err && err.message);
        return null;
      }
    }).filter(Boolean)
      .filter(e => e.displayScore.total > 0)
      .sort((a, b) => b.displayScore.total - a.displayScore.total)
      .slice(0, 10);

    return res.json({ success: true, events: scored });
  } catch (error) {
    console.error('Error getting recommended events (full):', error && (error.stack || error.message || error));
    if (String(req.query.debug || '').toLowerCase() === 'true') {
      return res.status(500).json({
        error: 'Failed to fetch event',
        message: String(error?.message || ''),
        stack: String(error?.stack || '')
      });
    }
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// ensure admin-created registrationForm includes basic identity fields
function ensureBasicFields(eventDoc) {
  if (!eventDoc) return eventDoc;
  const form = Array.isArray(eventDoc.registrationForm) ? [...eventDoc.registrationForm] : [];

  const basics = [
    { key: 'name', label: 'Full Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'studentId', label: 'Student ID', type: 'text', required: true }
  ];

  const existingKeys = new Set(form.map(f => String(f.key).toLowerCase()));
  // Prepend missing basic fields (preserve admin order for other fields)
  const missingBasics = basics.filter(b => !existingKeys.has(b.key.toLowerCase()));
  eventDoc.registrationForm = [...missingBasics, ...form];
  return eventDoc;
}

// Get single event by ID
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Ensure registration form contains basic fields so frontend can render + autofill
    ensureBasicFields(event);

    res.status(200).json(event);
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// Track event interest
router.post("/:id/interest", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const userId = req.user._id;
    const user = await User.findById(userId);
    
    // Initialize arrays if they don't exist
    event.interested = event.interested || [];
    event.engagementMetrics = event.engagementMetrics || {
      views: 0,
      interested: 0,
      registrations: 0
    };

    // Toggle interest status
    const isInterested = event.interested.includes(userId);
    if (isInterested) {
      event.interested = event.interested.filter(id => id.toString() !== userId.toString());
      event.engagementMetrics.interested = Math.max(0, event.engagementMetrics.interested - 1);
    } else {
      event.interested.push(userId);
      event.engagementMetrics.interested++;
      
      // Update user preferences with event tags and category
      try {
        const interestData = {
          tags: event.tags || [],
          category: event.category,
          organization: event.organization
        };
        await user.updateImplicitPreferences(interestData, 'interest', 2);
      } catch (error) {
        console.error('Failed to update preferences:', error);
      }
    }

    event.markModified('interested');
    event.markModified('engagementMetrics');
    await event.save();

    // Emit real-time update
    req.io.emit(`event:${event._id}:interest`, {
      eventId: event._id,
      userId: userId.toString(),
      interested: !isInterested,
      interestedCount: event.interested.length
    });

    res.json({ 
      success: true, 
      interested: !isInterested,
      metrics: event.engagementMetrics
    });

  } catch (error) {
    console.error("Error updating event interest:", error);
    res.status(500).json({ message: "Failed to update interest" });
  }
});

// Track event views
router.post("/:id/view", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Initialize or increment metrics
    event.engagementMetrics = event.engagementMetrics || {
      views: 0,
      interested: 0,
      registrations: 0
    };
    
    event.engagementMetrics.views++;
    event.markModified('engagementMetrics');
    await event.save();

    // Update user preferences
    const user = await User.findById(req.user._id);
    try {
      const viewData = {
        tags: event.tags || [],
        category: event.category,
        organization: event.organization
      };
      await user.updateImplicitPreferences(viewData, 'view', 0.5);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }

    res.json({ 
      success: true,
      viewCount: event.engagementMetrics.views
    });

  } catch (error) {
    console.error("Error tracking event view:", error);
    res.status(500).json({ message: "Failed to track view" });
  }
});

router.post("/:eventId", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if registration is full
    if (event.maxParticipants && 
        event.registrations.length >= event.maxParticipants) {
      return res.status(400).json({ message: "Event registration is full" });
    }

    // Check if already registered
    const existingReg = event.registrations.find(
      reg => reg.user.toString() === req.user.id
    );
    if (existingReg) {
      return res.status(400).json({ message: "Already registered" });
    }

    // Add registration
    event.registrations.push({
      user: req.user.id,
      status: 'pending',
      timestamp: new Date()
    });

    // Update metrics
    event.engagementMetrics.registrations++;
    await event.save();

    // Emit socket event
    req.app.get('io').emit(`event:${event._id}:registration`, {
      userId: req.user.id,
      status: 'pending',
      registrationCount: event.registrations.length
    });

    res.status(201).json({
      message: "Registration successful",
      status: 'pending'
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Failed to register" });
  }
});

// Update registration status (admin only)
router.put("/:eventId/:userId", adminAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const registration = event.registrations.find(
      reg => reg.user.toString() === req.params.userId
    );

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    registration.status = status;
    registration.updatedAt = new Date();
    await event.save();

    // Emit socket event
    req.app.get('io').emit(`event:${event._id}:registration`, {
      userId: req.params.userId,
      status,
      registrationCount: event.registrations.length
    });

    res.json({ message: "Registration updated", status });

  } catch (error) {
    console.error("Update registration error:", error);
    res.status(500).json({ message: "Failed to update registration" });
  }
});

router.get("/recommendations/test", authenticate, async (req, res) => {
  try {
    const { 
      filterType = 'all',
      sampleSize = 5,
      status,
      organization
    } = req.query;

    // Get user context
    const user = await User.findById(req.user._id)
      .select('interests implicitPreferences following organizations')
      .lean();

    // Get test content
    let testContent;
    if (filterType === 'events') {
      const query = {
        $or: [
          { status: status || { $in: ['upcoming', 'ongoing'] } },
          { status: 'ongoing' }
        ]
      };

      if (organization) {
        query.organization = { $in: user.organizations || [] };
      }

      testContent = await Event.find(query)
        .populate('createdBy', 'name profilePicture organization')
        .limit(parseInt(sampleSize))
        .lean();
    } else {
      testContent = await RecommendationService.testRecommendations(
        req.user._id,
        filterType,
        parseInt(sampleSize)
      );
    }

    // Calculate scores and stats
    const results = testContent.map(item => ({
      id: item._id,
      type: item.type || 'event',
      title: item.title || item.desc?.substring(0, 50),
      scores: {
        base: RecommendationService.calculateBaseEngagementScore(item),
        recency: RecommendationService.calculateRecencyScore(item),
        interest: RecommendationService.calculateInterestScore(item, user.interests),
        implicit: user.implicitPreferences ? 
          RecommendationService.calculateImplicitScore(item, user.implicitPreferences) : 0,
        final: RecommendationService.calculateFinalScore(item, user)
      },
      metadata: {
        matchedInterests: RecommendationService.getMatchedInterests(item, user.interests),
        contentType: item.contentType,
        boost: RecommendationService.getContentTypeBoost(item),
        organization: item.organization,
        status: item.status
      }
    }));

    // Calculate statistics
    const stats = {
      totalItems: results.length,
      averageScore: results.reduce((acc, item) => 
        acc + item.scores.final, 0) / results.length,
      scoreDistribution: {
        high: results.filter(item => item.scores.final > 0.7).length,
        medium: results.filter(item => item.scores.final > 0.4 && item.scores.final <= 0.7).length,
        low: results.filter(item => item.scores.final <= 0.4).length
      }
    };

    res.json({
      userProfile: {
        interestsCount: user.interests.length,
        hasImplicitPrefs: Boolean(user.implicitPreferences),
        topInterests: user.interests.slice(0, 5)
      },
      results,
      stats
    });

  } catch (error) {
    console.error("Error testing recommendations:", error);
    res.status(500).json({ 
      message: "Failed to test recommendations",
      error: error.message 
    });
  }
});

// TEMP debug route — remove when done
router.get("/recommended/debug", authenticate, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // 1) Get hybrid feed debug
    let feed;
    try {
      feed = await RecommendationService.getHybridFeed(userId, { page: 1, limit: 50, sortBy: 'hybrid', includePast: true });
    } catch (err) {
      console.warn('getHybridFeed error:', err && err.message);
      feed = null;
    }

    // 2) Get DB visibility & scoring debug
    const user = await User.findById(userId).lean() || { interests: [] };
    const eventsAll = await Event.find({ status: { $in: ['upcoming','ongoing','completed'] } }).lean();
    const visibility = await RecommendationService.debugUserEventVisibility(userId);
    const scored = eventsAll.map(ev => {
      try {
        const time = RecommendationService.calculateEventTimeRelevance(ev);
        const interest = RecommendationService.calculateInterestScore(ev, user.interests || []);
        const score = RecommendationService.calculateEventScore(ev, user);
        return { id: ev._id, title: ev.title, date: ev.date, status: ev.status, tags: ev.tags, time, interest, score };
      } catch (e) {
        return { id: ev._id, error: e.message };
      }
    });

    return res.json({ feed: feed?.items?.slice(0,50) || [], visibilityCount: visibility.length, visibility, scored });
  } catch (error) {
    console.error('recommended/debug error:', error && error.stack ? error.stack : error);
    return res.status(500).json({ error: 'debug failed', details: error?.message });
  }
});

router.get('/recommended/debug-verbose', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user._id ? String(req.user._id) : null;
    if (!userId) return res.status(400).json({ success: false, error: 'missing user' });

    const limit = parseInt(req.query.limit, 10) || 20;
    const collabSample = parseInt(req.query.collabSample, 10) || 50;

    const EventService = require('../services/eventService');

    const events = await EventService.getRecommendedEvents(userId, {
      limit,
      collabSample,
      status: ['upcoming', 'ongoing']
    });

    const verbose = await Promise.all(events.map(async (ev) => {
      // count registrations stored in EventRegistration collection
      let regs = [];
      try {
        regs = await EventRegistration.find({ eventId: ev._id }).select('userId interests name').limit(50).lean();
      } catch (e) {
        console.warn('Failed to read EventRegistration for event', ev._id, e && e.message);
      }

      // preserve original participantCount (from event doc) and include registrationCount
      const eventDocParticipantCount = (Array.isArray(ev.interested) ? ev.interested.length : 0)
        + (Array.isArray(ev.registrations) ? ev.registrations.length : 0);

      return {
        _id: ev._id,
        title: ev.title,
        date: ev.date,
        status: ev.status,
        eventDocParticipantCount,
        eventRegistrationCount: Array.isArray(regs) ? regs.length : 0,
        sampleRegistrations: (regs || []).slice(0,10).map(r => ({
          userId: r.userId,
          name: r.name,
          registrationInterests: r.interests
        })),
        _collabScore: ev._collabScore,
        _baseScore: ev._baseScore,
        _combinedScore: ev._combinedScore
      };
    }));

    return res.json({
      success: true,
      debug: { userId, limit, collabSample, returned: verbose.length },
      events: verbose
    });
  } catch (err) {
    console.error('/recommended/debug-verbose error', err && err.stack || err);
    return res.status(500).json({ success: false, error: err.message || 'server error' });
  }
});

module.exports = router;