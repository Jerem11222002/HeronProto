const Event = require('../models/event');
const User = require('../models/users');
const EventRegistration = require('../models/eventRegistration');

class EventService {
  static async updateEventStatus() {
    const now = new Date();
    
    try {
      // Update to ongoing
      await Event.updateMany(
        {
          status: 'upcoming',
          date: { $lte: now }
        },
        { $set: { status: 'ongoing' } }
      );

      // Update to completed
      await Event.updateMany(
        {
          status: 'ongoing',
          date: { $lt: new Date(now - 24 * 60 * 60 * 1000) }
        },
        { $set: { status: 'completed' } }
      );
    } catch (error) {
      console.error('Error updating event statuses:', error);
      throw error;
    }
  }

  // helper: compute fraction of sampled participants that share >=1 interest with user
  static async computeCollaborativeScore(userInterests = [], participantIds = [], maxSample = 50) {
    try {
      if (!Array.isArray(participantIds) || participantIds.length === 0) return 0;
      const sample = participantIds.slice(0, maxSample);
      const participants = await User.find({ _id: { $in: sample } }).select('interests').lean();
      if (!participants || participants.length === 0) return 0;
      const userSet = new Set((userInterests || []).map(i => String(i).toLowerCase().trim()).filter(Boolean));
      if (userSet.size === 0) return 0;
      let matchCount = 0;
      participants.forEach(p => {
        const pInterests = (p.interests || []).map(i => String(i).toLowerCase().trim());
        if (pInterests.some(pi => userSet.has(pi))) matchCount++;
      });
      return matchCount / participants.length; // 0..1
    } catch (err) {
      console.warn('computeCollaborativeScore error:', err && err.message);
      return 0;
    }
  }

  static async getRecommendedEvents(userId, options = {}) {
    const {
      limit = 10,
      excludeIds = [],
      status = ['upcoming', 'ongoing'],
      collabSample = 50
    } = options;

    try {
      const user = await User.findById(userId)
        .select('interests implicitPreferences')
        .lean();

      const events = await Event.find({
        _id: { $nin: excludeIds },
        status: { $in: status }
      })
      .lean();

      // compute collaborative score for each event (sample participants), then sort by collabScore desc, then base recommendationScore
      const scoredEvents = await Promise.all(events.map(async (ev) => {
        // collect participant ids from interested + registrations
        const participantsSet = new Set();
        if (Array.isArray(ev.interested)) {
          ev.interested.forEach(id => { if (id) participantsSet.add(String(id)); });
        }
        if (Array.isArray(ev.registrations)) {
          ev.registrations.forEach(r => {
            if (r && r.user) participantsSet.add(String(r.user));
          });
        }

        // NEW: also include registrations stored in EventRegistration collection
        try {
          const regs = await EventRegistration.find({ eventId: ev._id }).select('userId').lean();
          if (Array.isArray(regs)) {
            regs.forEach(r => { if (r && r.userId) participantsSet.add(String(r.userId)); });
          }
        } catch (e) {
          console.warn('Failed to read EventRegistration for event', ev._id, e && e.message);
        }

        const participantIds = Array.from(participantsSet);

        const collabScore = await EventService.computeCollaborativeScore(user?.interests || [], participantIds, collabSample);
        const base = Number(ev.recommendationScore || 0);
        const combinedScore = base * (1 + collabScore) + collabScore;

        return {
          ...ev,
          _collabScore: collabScore,
          _baseScore: base,
          _combinedScore: combinedScore
        };
      }));

      // sort: collaborative first (desc), then base score (desc)
      scoredEvents.sort((a, b) => {
        if (b._collabScore !== a._collabScore) return b._collabScore - a._collabScore;
        if (b._baseScore !== a._baseScore) return b._baseScore - a._baseScore;
        return 0;
      });

      return scoredEvents.slice(0, limit);
    } catch (error) {
      console.error('Error getting recommended events:', error);
      throw error;
    }
  }

  static async trackInteraction(eventId, userId, type) {
    try {
      const event = await Event.findById(eventId);
      if (!event) throw new Error('Event not found');

      // Update engagement metrics
      event.engagementMetrics[type] = (event.engagementMetrics[type] || 0) + 1;

      // Add to social proof
      event.socialProof.recentInteractions.push({
        userId,
        type,
        timestamp: new Date()
      });

      // Keep only recent interactions (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      event.socialProof.recentInteractions = 
        event.socialProof.recentInteractions.filter(i => 
          i.timestamp > oneDayAgo
        );

      await event.save();
      return event;
    } catch (error) {
      console.error('Error tracking interaction:', error);
      throw error;
    }
  }
}

module.exports = EventService;