const express = require('express');
const router = express.Router();
const Interest = require('../models/interest');
const authenticateToken = require('../Middleware/authenticateToken');
const adminAuth = require('../Middleware/adminAuthMiddleware'); // optional

// In-memory simple cache (small list) — replace with Redis for scale
let interestsCache = null;
let cacheTs = 0;
const CACHE_TTL = 60 * 1000; // 60s

async function getInterestsCached(force = false) {
  if (!force && interestsCache && (Date.now() - cacheTs) < CACHE_TTL) return interestsCache;
  const list = await Interest.find({ approved: true }).sort({ name: 1 }).lean();
  interestsCache = list;
  cacheTs = Date.now();
  return list;
}

// Public: list approved interests
router.get('/', async (req, res) => {
  try {
    const list = await getInterestsCached();
    return res.json({ interests: list });
  } catch (err) {
    console.error('Interests list error', err);
    return res.status(500).json({ message: 'Failed to load interests' });
  }
});

// Authenticated: propose a new interest or accept existing (auto accept if matches slug)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { slug, name, description, relatedTags } = req.body;
    if (!slug || !name) return res.status(400).json({ message: 'slug and name required' });

    const s = String(slug).trim().toLowerCase();
    // Try find or create (proposed)
    let interest = await Interest.findOne({ slug: s });
    if (!interest) {
      interest = new Interest({
        slug: s,
        name: name.trim(),
        description: description || '',
        relatedTags: Array.isArray(relatedTags) ? relatedTags : [],
        createdBy: req.user.id,
        approved: false // admin to approve, or auto logic below
      });
      // optional auto-approve for common terms
      // interest.approved = someAutoApproveCondition(s);
      await interest.save();
      // invalidate cache
      interestsCache = null;
    }
    return res.status(201).json({ interest });
  } catch (err) {
    console.error('Propose interest error', err);
    return res.status(500).json({ message: 'Failed to propose interest' });
  }
});

// Admin: approve interest
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    // simple admin guard in-route (avoids broken adminAuth import)
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    const id = req.params.id;
    const interest = await Interest.findByIdAndUpdate(id, { $set: { approved: true } }, { new: true });
    interestsCache = null;
    return res.json({ interest });
  } catch (err) {
    console.error('Approve interest error', err);
    return res.status(500).json({ message: 'Failed to approve' });
  }
});

module.exports = router;