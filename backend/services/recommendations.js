const Post = require('../models/posts');
const Event = require('../models/event');
const User = require('../models/users');
const path = require('path');

console.log('[recommendations.js] module loaded:', __filename);

const DEBUG = process.env.NODE_ENV === 'development';

const debugLog = (type, data) => {
  if (!DEBUG) return;
  console.log(`[Recommendations] ${type}:`, {
    timestamp: new Date().toISOString(),
    ...data
  });
};

const ORG_WEIGHTS = {
  directMatch: 0.5,      // Direct organization match with user interests
  collaborativeMatch: 0.3, // Similar users' engagement with organization
  tagMatch: 0.2         // Content-based tag matching
};

const ORGANIZATION_CATEGORIES = {
  'UTPC': {
    primaryInterest: 'visual-arts',
    secondaryInterests: ['performance'],
    tags: [
      'visual-arts',
      'painting',
      'artwork',
      'canvas',
      'digital-art',
      'technical-production',
      'creatives',
      'multimedia',
      'design',
      'graphics'
    ],
    weight: 1.0
  },
  'CAST': {
    primaryInterest: 'theatre',
    secondaryInterests: ['music'],
    tags: ['drama', 'acting', 'stage-performance', 'theatre'],
    weight: 1.0
  },
  'CULTURA': {
    primaryInterest: 'cultural',
    secondaryInterests: ['music', 'performance'],
    tags: ['dance', 'music', 'cultural', 'traditional'],
    weight: 1.0
  },
  'UMAK Jammers': {
    primaryInterest: 'music',
    secondaryInterests: ['performance'],
    tags: ['band', 'modern-music', 'performance'],
    weight: 1.0
  },
  'UMAK Chorale': {
    primaryInterest: 'music',
    secondaryInterests: ['performance'],
    tags: ['choir', 'vocal-arts', 'singing'],
    weight: 1.0
  },
  'UMAK Dance Extreme': {
    primaryInterest: 'performance',
    secondaryInterests: ['cultural'],
    tags: ['modern-dance', 'choreography', 'dance'],
    weight: 1.0
  },
  'UMAK Siglahi': {
    primaryInterest: 'cultural',
    secondaryInterests: ['performance'],
    tags: ['folk-dance', 'traditional-arts', 'cultural'],
    weight: 1.0
  },
  'UMAK Brass Band': {
    primaryInterest: 'music',
    secondaryInterests: ['performance'],
    tags: ['instruments', 'band', 'orchestra'],
    weight: 1.0
  }
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class RecommendationService {


  static interestMap = {
    // Core interests
    'music': ['song', 'concert', 'performance', 'band', 'instrument', 'orchestra', 'choir', 'vocal', 'singing', 'musical'],
    'dance': ['performance', 'choreography', 'movement', 'stage', 'modern-dance', 'traditional', 'dancing'],
    'theatre': ['drama', 'play', 'performance', 'stage', 'acting', 'production', 'theatrical'],
    'visual-arts': ['art', 'painting', 'drawing', 'design', 'creative', 'digital', 'artwork', 'canvas'],
    'performance': ['show', 'stage', 'live', 'concert', 'presentation', 'production', 'performing'],
    
    // Specialized interests
    'vocal-arts': ['singing', 'choir', 'voice', 'musical', 'song', 'vocal', 'vocals'],
    'modern-music': ['contemporary', 'band', 'popular', 'modern', 'pop', 'current'],
    'traditional-arts': ['cultural', 'folk', 'heritage', 'traditional', 'indigenous', 'ethnic'],
    
    // Technical interests
    'technical-production': ['production', 'technical', 'multimedia', 'audio', 'visual', 'stage'],
    'multimedia': ['digital', 'media', 'audio', 'visual', 'production', 'technical'],
    
    // Additional mappings
    'band': ['music', 'instrument', 'orchestra', 'ensemble', 'group', 'performance'],
    'instruments': ['musical', 'orchestra', 'band', 'music', 'performance'],
    'drama': ['theatre', 'acting', 'performance', 'stage', 'dramatic'],
    'cultural': ['traditional', 'heritage', 'folk', 'cultural-arts', 'indigenous'],
    'choir': ['vocal', 'singing', 'voice', 'music', 'ensemble'],
    
    // General terms
    'creative': ['art', 'design', 'visual', 'artistic', 'creative-arts'],
    'digital': ['multimedia', 'technical', 'digital-art', 'visual', 'technology'],
    'performing': ['performance', 'stage', 'live', 'show', 'act']
  };
  static normalizeLegacyInterests(interests) {
    const LEGACY_MAPPING = {
      1: ['music', 'performance'],
      2: ['dance', 'choreography'], 
      3: ['theatre', 'drama'],
      4: ['visual-arts', 'painting'],
      5: ['digital-art', 'technical-production'],
      6: ['cultural-arts', 'traditional-arts'],
      7: ['vocal-arts', 'modern-music'],
      8: ['instruments', 'band'],
      9: ['multimedia', 'design'],
      10: ['graphics', 'creatives']
    };

    if (!Array.isArray(interests)) return [];

  const normalized = interests.reduce((acc, interest) => {
    // Handle numeric strings
    const numericInterest = parseInt(interest, 10);
    
    if (!isNaN(numericInterest) && LEGACY_MAPPING[numericInterest]) {
      return [...acc, ...LEGACY_MAPPING[numericInterest]];
    }
    
    // Handle direct string interests
    if (typeof interest === 'string') {
      return [...acc, interest];
    }
    
    return acc;
  }, []);
  return [...new Set(normalized)];

  }
  
  static async getHybridFeed(userId, options = {}) {
    console.log('Starting getHybridFeed for user:', userId);
  
    const {
      page = 1,
      limit = 20,
      eventRatio = 0.3,
      friendPostsRatio = 0.4,
      sortBy = 'hybrid',
      includePast = false
    } = options;
  
    try {
      // Get user with null check
      const user = await User.findById(userId)
        .select('interests implicitPreferences following organizations interestsSelected interestsSkipped contentPreferences')
        .lean();
  
      if (!user) {
        throw new Error('User not found');
      }

      // --- compute allowed owners for shared posts (only followings, mutuals, and self) ---
      const followingIds = (user.following || []).map(id =>
        (typeof id === 'object' && id._id) ? String(id._id) : String(id)
      );

      // find followers to detect mutuals
      const followersDocs = await User.find({ following: userId }).select('_id').lean();
      const followerIds = (followersDocs || []).map(d => String(d._id));

      const mutualIds = followingIds.filter(id => followerIds.includes(id));
      const allowedSharedOwners = new Set([ ...followingIds, ...mutualIds, String(userId) ]);
      // --- end allowed owners ---

      // Initialize arrays and normalize interests first
      user.interests = user.interests || [];
      user.following = user.following || [];
      user.organizations = user.organizations || [];

      // Normalize interests before using in queries
      let normalizedInterests = this.normalizeLegacyInterests(user.interests || [])
        .map(i => String(i).toLowerCase().trim())
        .filter(Boolean);

      // build a combined regex from normalized interests for title/desc matching
      const escKeywords = normalizedInterests.map(k => escapeRegex(k));
      const combinedRegex = escKeywords.length ? new RegExp(escKeywords.join('|'), 'i') : null;

      // Fallback: if normalization produced empty array but user.interests exists (defensive).
      if (normalizedInterests.length === 0 && Array.isArray(user.interests) && user.interests.length > 0) {
        normalizedInterests = user.interests.map(i => String(i).toLowerCase().trim()).filter(Boolean);
        debugLog('Fallback normalizedInterests from raw user.interests', { userId, normalizedInterests });
      }

      // Interest check moved after normalization — only require explicit selection when there are no normalized interests
      // If the user hasn't explicitly set interests we mark a cold start but do NOT early-return.
      // This allows the recommender to present fallback/popular content to avoid empty feeds.
      let isColdStart = false;
      if (!user.interestsSelected && !user.interestsSkipped && normalizedInterests.length === 0) {
        debugLog('User Interests Not Set and no normalized interests (cold start). Continuing with fallback content.', { userId });
        isColdStart = true;
      }
  
      // Calculate content limits
      const eventLimit = Math.ceil(limit * eventRatio);
      const postLimit = limit - eventLimit;
      const friendPostsLimit = Math.ceil(postLimit * friendPostsRatio);
      const generalPostsLimit = postLimit - friendPostsLimit;
  
      console.log('Content Limits:', {
        eventLimit,
        friendPostsLimit,
        generalPostsLimit,
        total: limit,
        userStats: {
          interests: user.interests.length,
          following: user.following.length,
          organizations: user.organizations.length
        }
      });
  
      // Get events with expanded criteria and debug
      const eventQuery = {
        $and: [
          { 
            status: { 
              $in: ['upcoming', 'ongoing']
            }
          },
          {
            $or: [
              // Interest-based matching (more lenient)
              { 
                tags: { 
                  $in: [
                    ...normalizedInterests,
                    ...normalizedInterests.map(i => i.toLowerCase()),
                    ...normalizedInterests.map(i => i.replace('-', '')),
                    ...normalizedInterests.map(i => i.replace('-', ' '))
                  ]
                } 
              },
              // Organization category matching
              {
                $or: Object.entries(ORGANIZATION_CATEGORIES)
                  .filter(([_, category]) => 
                    category.tags.some(tag => 
                      normalizedInterests.includes(tag) ||
                      normalizedInterests.some(interest => tag.includes(interest))
                    ) ||
                    normalizedInterests.includes(category.primaryInterest) ||
                    category.secondaryInterests.some(i => normalizedInterests.includes(i))
                  )
                  .map(([org, _]) => ({ organization: org }))
              },
              // Public events fallback
              {
                $and: [
                  { visibility: 'public' },
                  { 
                    $or: [
                      { contentType: { $in: ['announcement', 'highlight'] } },
                      { tags: { $exists: true, $ne: [] } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
  
      debugLog('Event Query Debug:', {
        query: JSON.stringify(eventQuery, null, 2),
        userInterests: normalizedInterests,
        organizationAccess: user.organizations || [],
        matchingOrgs: Object.keys(ORGANIZATION_CATEGORIES).filter(org => {
          const category = ORGANIZATION_CATEGORIES[org];
          return normalizedInterests.some(interest => 
            category.tags.includes(interest) || 
            category.primaryInterest === interest
          );
        })
      });
  
      const events = await Event.find(eventQuery)
        .populate({
          path: 'createdBy',
          select: 'name profilePicture organization'
        })
        .sort({ date: 1 })
        .limit(eventLimit * 2)
        .lean();
 
      // If cold-start and no events found, fetch top public upcoming events as a fallback
      if (!events || events.length < Math.max(1, eventLimit)) {
        debugLog('Cold-start: fetching fallback public events', { userId });
        const fallbackEvents = await Event.find({
          status: { $in: ['upcoming', 'ongoing'] },
          visibility: 'public'
        })
          .sort({ 'engagementMetrics.interested': -1, date: 1 })
          .limit(Math.max(2, eventLimit))
          .lean();
        // merge into events variable used later
        if (fallbackEvents && fallbackEvents.length > 0) {
          events.splice(0, events.length, ...fallbackEvents);
        }
      }
  
      debugLog('Events Debug:', {
        found: events.length,
        organizations: [...new Set(events.map(e => e.organization))],
        upcoming: events.filter(e => e.status === 'upcoming').length,
        ongoing: events.filter(e => e.status === 'ongoing').length,
        sample: events.slice(0, 2).map(e => ({
          id: e._id,
          title: e.title,
          organization: e.organization,
          status: e.status,
          date: e.date
        }))
      });
  
      // Get posts from following
      const followingAndSelfIds = [
        ...user.following.map(id => (typeof id === 'object' && id._id) ? String(id._id) : String(id)),
        String(userId)
      ];

      const followingPostsRaw = await Post.find({
        userId: { $in: followingAndSelfIds }
      })
      .populate('userId', 'name profilePicture organization')
      .populate('sharedPost')
      .sort({ createdAt: -1 })
      .limit(friendPostsLimit * 2)
      .lean();

      // Include all following posts (don't drop them). We'll demote unrelated ones later during scoring.
      // This prevents empty feeds for users who follow people but didn't select many interests.
      const filteredFollowingPosts = followingPostsRaw.filter(Boolean);

      // Get general posts
      // If the user has no or very few interests, broaden the general posts query to include popular/public
      // and recent posts so the feed isn't empty.
      let generalPosts;
      if (!normalizedInterests || normalizedInterests.length === 0) {
        generalPosts = await Post.find({
          visibility: 'public'
        })
        .populate('userId', 'name profilePicture organization')
        .populate('sharedPost')
        .sort({ 'engagementMetrics.views': -1, 'engagementMetrics.popularity': -1, createdAt: -1 })
        .limit(Math.max(generalPostsLimit * 2, 10))
        .lean();
      } else {
        generalPosts = await Post.find({
          userId: { $nin: [...user.following, userId] },
          $and: [
            { $or: [
                { tags: { $in: normalizedInterests } },
                { title: { $regex: combinedRegex } },
                { desc: { $regex: combinedRegex } },
                { 'engagementMetrics.views': { $exists: true } }
              ]
            }
          ]
        })
        .populate('userId', 'name profilePicture organization')
        .populate('sharedPost')
        .sort({ createdAt: -1 })
        .limit(generalPostsLimit * 3)
        .lean();
      }

      // Helper: robustly resolve the original owner id of a shared post (populated or raw)
      const resolveSharedOwnerId = (shared) => {
        if (!shared) return null;
        if (typeof shared === 'object') {
          if (shared.userId) return String(shared.userId._id || shared.userId);
          if (shared.user) return String(shared.user._id || shared.user);
          if (shared._id) return String(shared._id);
        }
        return String(shared);
      };

      // Remove any posts that are shared where the original owner is NOT in allowedSharedOwners
      const filterOutDisallowedShared = (postsList = []) => postsList.filter(p => {
        if (!p || !p.sharedPost) return true;
        const ownerId = resolveSharedOwnerId(p.sharedPost);
        // If owner resolved, require membership in allowedSharedOwners.
        if (ownerId) return allowedSharedOwners.has(String(ownerId));
        // If owner cannot be resolved, be forgiving: allow public/shared posts that are from public visibility
        // or posts whose immediate poster is allowed. This avoids removing valid shared posts due to legacy shapes.
        if (p.visibility === 'public') return true;
        if (p.userId && allowedSharedOwners.has(String(p.userId))) return true;
        return false;
      });
      
      const safeFollowingPosts = filterOutDisallowedShared(filteredFollowingPosts);
      const safeGeneralPosts = filterOutDisallowedShared(generalPosts);

      debugLog('Content Collection Debug:', {
        events: events.length,
        followingPosts: safeFollowingPosts.length,
        generalPosts: safeGeneralPosts.length
      });

      // If no posts matched, fallback to recent/popular/posts-with-media/random posts for new users (use safe lists)
      let fallbackPosts = [];
      if (((safeFollowingPosts.length === 0 && safeGeneralPosts.length === 0) || isColdStart) && page === 1) {
        const desiredFallbackCount = Math.min(limit, 10);
        debugLog('Fallback: starting multi-strategy fill', { userId, desiredFallbackCount });

        // 1) Recent public posts
        try {
          const recent = await Post.find({ visibility: 'public' })
            .sort({ createdAt: -1 })
            .limit(desiredFallbackCount)
            .lean();
          fallbackPosts = filterOutDisallowedShared(recent);
          debugLog('Fallback recent found', { count: fallbackPosts.length });
        } catch (err) {
          debugLog('Fallback recent error', { error: err.message });
        }

        // 2) Popular public posts if still short
        if (fallbackPosts.length < desiredFallbackCount) {
          try {
            const needed = desiredFallbackCount - fallbackPosts.length;
            const popular = await Post.find({ visibility: 'public' })
              .sort({ 'engagementMetrics.views': -1, 'engagementMetrics.popularity': -1, createdAt: -1 })
              .limit(needed * 2)
              .lean();
            const add = filterOutDisallowedShared(popular).filter(p => !fallbackPosts.find(fp => String(fp._id) === String(p._id)));
            fallbackPosts = [...fallbackPosts, ...add].slice(0, desiredFallbackCount);
            debugLog('Fallback popular added', { added: add.length, total: fallbackPosts.length });
          } catch (err) {
            debugLog('Fallback popular error', { error: err.message });
          }
        }

        // 3) Media-rich posts (images/videos) to keep feed lively
        if (fallbackPosts.length < desiredFallbackCount) {
          try {
            const needed = desiredFallbackCount - fallbackPosts.length;
            const mediaPosts = await Post.find({
              visibility: 'public',
              $or: [
                { media: { $exists: true, $ne: null } },
                { img: { $exists: true, $ne: null } }
              ]
            })
            .sort({ createdAt: -1 })
            .limit(needed * 2)
            .lean();
            const add = filterOutDisallowedShared(mediaPosts).filter(p => !fallbackPosts.some(fp => String(fp._id) === String(p._id)));
            fallbackPosts = [...fallbackPosts, ...add].slice(0, desiredFallbackCount);
            debugLog('Fallback media added', { added: add.length, total: fallbackPosts.length });
          } catch (err) {
            debugLog('Fallback media error', { error: err.message });
          }
        }

        // 4) Random public sample as diversity
        if (fallbackPosts.length < desiredFallbackCount) {
          try {
            const needed = desiredFallbackCount - fallbackPosts.length;
            const sample = await Post.aggregate([
              { $match: { visibility: 'public' } },
              { $sample: { size: Math.max(needed, 1) } }
            ]);
            const add = filterOutDisallowedShared(sample).filter(p => !fallbackPosts.some(fp => String(fp._id) === String(p._id)));
            fallbackPosts = [...fallbackPosts, ...add].slice(0, desiredFallbackCount);
            debugLog('Fallback sample added', { added: add.length, total: fallbackPosts.length });
          } catch (err) {
            debugLog('Fallback sample error', { error: err.message });
          }
        }

        // 5) Last resort: any posts (oldest/newest) to ensure non-empty feed
        if (fallbackPosts.length === 0) {
          try {
            const any = await Post.find({})
              .sort({ createdAt: -1 })
              .limit(desiredFallbackCount)
              .lean();
            fallbackPosts = filterOutDisallowedShared(any);
            debugLog('Fallback any posts used', { total: fallbackPosts.length });
          } catch (err) {
            debugLog('Fallback any error', { error: err.message });
          }
        }

        // Final defensive unique/truncate
        const seen = new Set();
        fallbackPosts = fallbackPosts.filter(p => {
          const id = String(p._id || p._id?.toString());
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        }).slice(0, desiredFallbackCount);

        // ADD: If we still don't have enough items to fill a page, top-up with any recent public NON-shared posts
        const totalAvailable = safeFollowingPosts.length + safeGeneralPosts.length + fallbackPosts.length;
        if (totalAvailable < Math.min(limit, desiredFallbackCount) && page === 1) {
          try {
            const need = Math.min(limit, desiredFallbackCount) - totalAvailable;
            const topAny = await Post.find({
              visibility: 'public',
              $or: [{ sharedPost: { $exists: false } }, { sharedPost: null }]
            })
            .sort({ createdAt: -1 })
            .limit(need)
            .lean();
            const add = topAny.filter(p => !fallbackPosts.some(fp => String(fp._id) === String(p._id)));
            fallbackPosts = [...fallbackPosts, ...add].slice(0, desiredFallbackCount);
            debugLog('Fallback top-up with any public non-shared posts', { added: add.length, total: fallbackPosts.length });
          } catch (err) {
            debugLog('Fallback top-up error', { error: err.message });
          }
        }
      }
 
      // Score and combine content
      const scoredContent = this.distributeContent(
        events.map(event => ({
          ...this.normalizeContent(event),
          type: 'event',
          finalScore: this.calculateFinalScore(event, user)
        })),
        [
          // Use safe lists where disallowed shared posts were removed
          ...[...safeFollowingPosts, ...safeGeneralPosts].map(post => ({
            ...this.normalizeContent(post),
            type: 'post',
            fromFollowing:
              (user.following || []).map(f => String(f)).includes(String(post.userId)) ||
              String(post.userId) === String(userId),
            finalScore: this.calculateFinalScore(post, user)
          })),
          // Add fallback posts if needed
          ...fallbackPosts.map(post => ({
            ...this.normalizeContent(post),
            type: 'post',
            fromFollowing: false,
            finalScore: 0.1 // Low score, so they appear last
          }))
        ]
      );
  
      // Sort and add recommendations
      const sortedContent = this.sortContent(scoredContent, sortBy);
      const contentWithReasons = sortedContent.map(item => ({
        ...item,
        recommendationReason: this.getRecommendationReason(item, user)
      }));
  
      // Paginate
      const start = (page - 1) * limit;
      const paginatedContent = contentWithReasons.slice(start, start + limit);
  
      debugLog('Final Content Distribution:', {
        total: paginatedContent.length,
        events: paginatedContent.filter(item => item.type === 'event').length,
        followingPosts: paginatedContent.filter(item => item.fromFollowing).length,
        generalPosts: paginatedContent.filter(item => !item.fromFollowing && item.type === 'post').length,
        scores: {
          max: Math.max(...paginatedContent.map(item => item.finalScore)),
          min: Math.min(...paginatedContent.map(item => item.finalScore)),
          avg: paginatedContent.reduce((acc, item) => acc + item.finalScore, 0) / paginatedContent.length
        }
      });
  
      return {
        items: paginatedContent,
        hasMore: start + limit < sortedContent.length,
        total: sortedContent.length,
        page,
        pageSize: limit,
        debug: {
          followingPostsCount: safeFollowingPosts.length,
          generalPostsCount: safeGeneralPosts.length,
          eventsCount: events.length,
          userFollowingCount: user.following.length,
          userInterestsCount: user.interests.length,
          contentDistribution: {
            events: events.length,
            following: safeFollowingPosts.length,
            general: safeGeneralPosts.length
          }
        }
        // if cold-start, let the caller know we suggested fallback content
        , requiresInterests: isColdStart
       };
 
     } catch (error) {
       debugLog('Error in getHybridFeed:', {
         error: error.message,
         stack: error.stack,
         userId,
         options
       });
       throw error;
     }
   }
  


  static async debugDatabaseState() {
    try {
      const stats = {
        totalPosts: await Post.countDocuments({}),
        recentPosts: await Post.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        postsWithLikes: await Post.countDocuments({ 'likes.0': { $exists: true } }),
        postsWithViews: await Post.countDocuments({ 'engagementMetrics.views': { $exists: true } }),
        postsWithTags: await Post.countDocuments({ 'tags.0': { $exists: true } })
      };

      console.log('Database Stats:', stats);
      return stats;
    } catch (error) {
      debugLog('Error getting database stats:', error);
      throw error;
    }
  }

  static async getRelevantPosts(user, limit) {
    const followingIds = user.following.map(id => id.toString());
    const baseQuery = {
      createdAt: { 
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
      }
    };

    // If user has no interests or follows, get popular content
    if (followingIds.length === 0 && (!user.interests || user.interests.length === 0)) {
      return Post.find({
        ...baseQuery,
        'engagementMetrics.views': { $gt: 10 },
        visibility: 'public'
      })
      .sort({ 'engagementMetrics.views': -1 })
      .limit(limit)
      .populate('userId', 'name profilePicture organization')
      .lean();
    }

    // Otherwise, get personalized content
    return Post.find({
      ...baseQuery,
      $or: [
        { userId: { $in: followingIds } },
        { 
          $and: [
            { tags: { $in: user.interests } },
            { visibility: 'public' }
          ]
        }
      ]
    })
    .populate('userId', 'name profilePicture organization')
    .limit(limit * 2)
    .lean();
  }

  static async getRelevantEvents(user, limit) {
    const now = new Date();
    // Normalize user interests to lowercase
    const normalizedUserInterests = (user.interests || []).map(i => i.toLowerCase());
    // If user.organizations exists, normalize to lowercase too
    const normalizedUserOrgs = (user.organizations || []).map(o => o.toLowerCase());

    return Event.find({
      $or: [
        { status: 'upcoming', date: { $gte: now } },
        { status: 'ongoing' }
      ],
      $and: [
        { visibility: { $in: ['public', 'organization-only'] } },
        {
          $or: [
            // Normalize tags to lowercase in query
            { tags: { $in: normalizedUserInterests } },
            { organization: { $in: normalizedUserOrgs } }
          ]
        }
      ]
    })
    .populate('createdBy', 'name profilePicture organization')
    .limit(limit * 2)
    .lean();
  }

        static async calculateFinalScore(item, user) {
      // Check cache first
      const cacheKey = `${item._id}-${user._id}`;
      if (this.scoreCache?.has(cacheKey)) {
        this.metrics.cacheHits++;
        return this.scoreCache.get(cacheKey);
      }
      this.metrics.calculations++;
    
      try {
        // Handle non-event content (posts)
        if (item.type !== 'event') {
          let baseScore = this.calculateBaseEngagementScore(item);
    
          // Apply content preference boosts
          if (user.contentPreferences) {
            if (user.contentPreferences.likedContent?.includes(item._id)) {
              baseScore *= 1.2; // 20% boost for liked content
            }
            if (user.contentPreferences.savedContent?.includes(item._id)) {
              baseScore *= 1.15; // 15% boost for saved content
            }
            if (user.contentPreferences.sharedContent?.includes(item._id)) {
              baseScore *= 1.25; // 25% boost for shared content
            }
          }
    
          // Explicit interest match check and penalty for unrelated following posts
          if (item.fromFollowing) {
            const normalizedInterests = this.normalizeLegacyInterests(user.interests).map(i => i.toLowerCase());
            const matchesExplicit = (item.tags || []).some(tag => normalizedInterests.includes(tag.toLowerCase()));
            const titleDescText = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase();
            const textMatches = normalizedInterests.some(k => titleDescText.includes(k));
            if (!matchesExplicit && !textMatches) {
              // softer penalty: demote but keep the post visible
              baseScore *= 0.6;
            } else if (!matchesExplicit && textMatches) {
              // keep but slightly demote if only text matches
              baseScore *= 0.9;
            }
          }
    
          // Cache and return
          this.cacheScore(cacheKey, baseScore);
          return baseScore;
        }
    
        // Event scoring
        const orgInfo = ORGANIZATION_CATEGORIES[item.organization];
        const weights = this.getWeights('event', !!user.implicitPreferences);
    
        // Calculate individual scores
        const orgScore = await this.calculateCollaborativeScore(item, user);
        const interestScore = this.calculateInterestScore(item, user.interests);
        const timeScore = this.calculateEventTimeRelevance(item);
        const recencyScore = this.calculateRecencyScore(item);
        const implicitScore = user.implicitPreferences ?
          this.calculateImplicitScore(item, user.implicitPreferences) : 0;
    
        // Calculate weighted base score
        let finalScore = (
          (orgScore * weights.base) +
          (interestScore * weights.explicit) +
          (timeScore * 0.2) +
          (recencyScore * weights.recency) +
          (implicitScore * weights.implicit)
        ) * (orgInfo?.weight || 1.0);
    
        // Apply content preference boosts
        if (user.contentPreferences) {
          if (user.contentPreferences.interestedEvents?.includes(item._id)) {
            finalScore *= 1.3; // 30% boost for interested events
          }
          if (user.contentPreferences.registeredEvents?.includes(item._id)) {
            finalScore *= 1.4; // 40% boost for registered events
          }
          if (user.contentPreferences.sharedEvents?.includes(item._id)) {
            finalScore *= 1.25; // 25% boost for shared events
          }
        }
    
        // Apply content type boost
        finalScore *= this.getContentTypeBoost(item);
    
        // Debug logging
        debugLog('Event Final Score:', {
          eventId: item._id,
          title: item.title,
          organization: item.organization,
          scores: {
            orgScore,
            interestScore,
            timeScore,
            recencyScore,
            implicitScore,
            contentBoosts: {
              interested: user.contentPreferences?.interestedEvents?.includes(item._id),
              registered: user.contentPreferences?.registeredEvents?.includes(item._id),
              shared: user.contentPreferences?.sharedEvents?.includes(item._id)
            }
          },
          weights,
          finalScore
        });
    
        // Normalize and cache
        const normalizedScore = Math.min(Math.max(finalScore, 0.2), 1);
        this.cacheScore(cacheKey, normalizedScore);
    
        return normalizedScore;
      } catch (error) {
        debugLog('Error calculating final score:', {
          error: error.message,
          stack: error.stack,
          item: item._id,
          user: user._id
        });
        this.metrics.errors++;
        return 0;
      }
    }


  // Add to RecommendationService class
static async debugUserEventVisibility(userId) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('User not found');

    const normalizedInterests = this.normalizeLegacyInterests(user.interests);
    
    const events = await Event.find({
      status: { $in: ['upcoming', 'ongoing'] }
    }).lean();

    const matchingEvents = events.filter(event => {
      // Check all matching criteria
      const orgMatch = user.organizations?.includes(event.organization);
      const tagMatch = event.tags?.some(tag => {
        const normalizedTag = tag.toLowerCase();
        return normalizedInterests.some(interest => {
          // Direct match
          if (normalizedTag === interest) return true;
          // Related match from interest map
          if (this.interestMap[interest]?.includes(normalizedTag)) return true;
          // Partial match
          if (normalizedTag.includes(interest) || interest.includes(normalizedTag)) return true;
          return false;
        });
      });
      const orgCategoryMatch = ORGANIZATION_CATEGORIES[event.organization]?.tags
        .some(tag => {
          return normalizedInterests.some(interest => {
            // Direct match
            if (tag === interest) return true;
            // Related match
            if (this.interestMap[interest]?.includes(tag)) return true;
            return false;
          });
        });

      return orgMatch || tagMatch || orgCategoryMatch;
    });

    console.log('Event Visibility Debug:', {
      userId,
      username: user.username,
      interests: normalizedInterests,
      totalEvents: events.length,
      matchingEvents: matchingEvents.length,
      matchingOrganizations: [...new Set(matchingEvents.map(e => e.organization))],
      unmatchedTags: [...new Set(
        events.flatMap(e => e.tags || [])
          .filter(tag => !normalizedInterests.includes(tag))
      )]
    });

    return matchingEvents;
  } catch (error) {
    console.error('Debug Error:', error);
    return [];
  }
}

  static calculateBaseEngagementScore(item) {
    if (item.type === 'event') {
      return (
        (item.engagementMetrics?.views || 0) * 0.2 +
        (item.engagementMetrics?.interested || 0) * 0.3 +
        (item.engagementMetrics?.registrations || 0) * 0.5
      );
    }
    return (
      (item.engagementMetrics?.views || 0) * 0.2 +
      (item.likes?.length || 0) * 0.4 +
      (item.engagementMetrics?.commentCount || 0) * 0.3 +
      (item.engagementMetrics?.shares || 0) * 0.1
    );
  }

    static async calculateCollaborativeScore(event, user) {
    try {
      // Find similar users with expanded criteria
      const similarUsers = await User.find({
        _id: { $ne: user._id },
        $or: [
          { interests: { $in: user.interests } },
          { organizations: { $in: user.organizations || [] } },
          { following: { $in: user.following || [] } }
        ]
      }).select('interests organizations contentPreferences implicitPreferences').lean();
  
      // Calculate organization metrics with time decay
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const orgEngagement = await Event.aggregate([
        {
          $match: {
            organization: event.organization,
            date: { $gte: thirtyDaysAgo },
            'engagementMetrics.interested': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$organization',
            totalInterested: { $sum: '$engagementMetrics.interested' },
            totalRegistrations: { $sum: '$engagementMetrics.registrations' },
            recentEvents: {
              $push: {
                date: '$date',
                interested: '$engagementMetrics.interested',
                registrations: '$engagementMetrics.registrations'
              }
            }
          }
        }
      ]);
  
      // Calculate time-weighted engagement score
      const getTimeWeightedScore = (events) => {
        return events.reduce((score, event) => {
          const daysAgo = (Date.now() - new Date(event.date)) / (1000 * 60 * 60 * 24);
          const timeWeight = Math.exp(-daysAgo / 30); // 30-day decay
          return score + ((event.interested * 0.3 + event.registrations * 0.7) * timeWeight);
        }, 0) / Math.max(events.length, 1);
      };
  
      // Calculate organization popularity with time decay
      const orgInfo = ORGANIZATION_CATEGORIES[event.organization];
      const orgBaseScore = orgInfo ? 
        (user.interests.includes(orgInfo.primaryInterest) ? 0.6 : 0) +
        (orgInfo.secondaryInterests.some(i => user.interests.includes(i)) ? 0.4 : 0)
        : 0;
  
      // Enhanced user similarity calculation
      const calculateUserSimilarity = (similarUser) => {
        const interestOverlap = similarUser.interests?.filter(
          i => user.interests.includes(i)
        ).length || 0;
        
        const orgOverlap = similarUser.organizations?.filter(
          org => user.organizations?.includes(org)
        ).length || 0;
  
        const implicitOverlap = Object.keys(similarUser.implicitPreferences || {})
          .filter(key => user.implicitPreferences?.[key])
          .length;
  
        return (
          (interestOverlap * 0.5) +
          (orgOverlap * 0.3) +
          (implicitOverlap * 0.2)
        ) / Math.max(user.interests.length, 1);
      };
  
      // Calculate final scores
      const engagement = orgEngagement[0] || { recentEvents: [], totalEvents: 0 };
      const timeWeightedEngagement = getTimeWeightedScore(engagement.recentEvents || []);
      
      const similarityScores = similarUsers.map(calculateUserSimilarity);
      const avgSimilarity = similarityScores.reduce((a, b) => a + b, 0) / 
        Math.max(similarityScores.length, 1);
  
      // Combine scores with updated weights
      const finalScore = (
        (orgBaseScore * 0.4) +
        (timeWeightedEngagement * 0.4) +
        (avgSimilarity * 0.2)
      );
  
      debugLog('Enhanced Collaborative Score:', {
        eventId: event._id,
        organization: event.organization,
        scores: {
          orgBaseScore,
          timeWeightedEngagement,
          avgSimilarity
        },
        finalScore: Math.min(finalScore, 1)
      });
  
      return Math.min(finalScore, 1);
    } catch (error) {
      console.error('Error calculating collaborative score:', error);
      return 0;
    }
  }

    static async trackUserEngagement(userId, itemId, type) {
    try {
      const update = {
        $addToSet: {
          [`contentPreferences.${type}Content`]: itemId
        }
      };
      
      await User.findByIdAndUpdate(userId, update, { new: true });
      
      debugLog('Tracked User Engagement:', {
        userId,
        itemId,
        type,
        timestamp: new Date()
      });
    } catch (error) {
      debugLog('Error tracking engagement:', error);
    }
  }

  static calculateRecencyScore(item) {
    const now = new Date();
    const itemDate = new Date(item.createdAt || item.date);
    const hoursSince = (now - itemDate) / (1000 * 60 * 60);
    return Math.exp(-hoursSince / 168); // 168 hours = 1 week
  }

        static calculateInterestScore(item, userInterests) {
      if (!item?.tags || !userInterests?.length) return 0;
    
      // Adjust scoring weights to be more balanced
      const WEIGHTS = {
        EXACT_MATCH: 1.0,          
        PRIMARY_ORG_MATCH: 1.0,    // Increased from 0.9
        SECONDARY_ORG_MATCH: 0.8,  // Increased from 0.7
        MAPPED_MATCH: 0.7,         // Increased from 0.6
        PARTIAL_MATCH: 0.6,        // Increased from 0.4
        RELATED_MATCH: 0.5,        // Increased from 0.3
        TITLE_MATCH: 0.5,          // Increased from 0.4
        DESCRIPTION_MATCH: 0.4     // Increased from 0.3
      };
    
      // Normalize and expand interests for better matching
      const normalizedInterests = this.normalizeLegacyInterests(userInterests)
        .map(interest => interest.toLowerCase());
    
      // Create expanded interests set including related terms
      const expandedInterests = new Set([
        ...normalizedInterests,
        ...normalizedInterests.flatMap(interest => this.interestMap[interest] || [])
      ]);
    
      let totalScore = 0;
      let matchDetails = {
        exact: 0,
        primary: 0,
        secondary: 0,
        mapped: 0,
        partial: 0,
        related: 0,
        title: 0,
        description: 0
      };
    
      // 1. Process organization matches with enhanced matching
      if (item.organization && ORGANIZATION_CATEGORIES[item.organization]) {
        const orgInfo = ORGANIZATION_CATEGORIES[item.organization];
        
        // Enhanced primary interest matching
        if (normalizedInterests.includes(orgInfo.primaryInterest.toLowerCase())) {
          totalScore += WEIGHTS.PRIMARY_ORG_MATCH;
          matchDetails.primary++;
        }
    
        // Enhanced secondary interests matching
        orgInfo.secondaryInterests.forEach(interest => {
          const interestLower = interest.toLowerCase();
          if (expandedInterests.has(interestLower)) {
            totalScore += WEIGHTS.SECONDARY_ORG_MATCH;
            matchDetails.secondary++;
          }
        });
    
        // Enhanced organization tags matching
        orgInfo.tags.forEach(tag => {
          const tagLower = tag.toLowerCase();
          if (expandedInterests.has(tagLower)) {
            totalScore += WEIGHTS.MAPPED_MATCH;
            matchDetails.mapped++;
          }
        });
      }
    
      // 2. Process tags with enhanced matching
      const itemTags = new Set([
        ...(item.tags || []).map(tag => tag.toLowerCase()),
        ...(ORGANIZATION_CATEGORIES[item.organization]?.tags || []).map(tag => tag.toLowerCase())
      ]);
    
      itemTags.forEach(tagLower => {
        // Exact match with expanded interests
        // Partial match checking
        if (normalizedInterests.some(interest => {
          // Check if tag contains interest or vice versa
          if (tagLower.includes(interest) || interest.includes(tagLower)) {
            return true;
          }
          // Check if tag matches any related terms
          return this.interestMap[interest]?.some(related => 
            tagLower.includes(related.toLowerCase()) || 
            related.toLowerCase().includes(tagLower)
          );
        })) {
          totalScore += WEIGHTS.PARTIAL_MATCH;
          matchDetails.partial++;
          return;
        }
    
        // Related terms match with higher weight
        if (this.hasRelatedTermMatch(tagLower, normalizedInterests)) {
          totalScore += WEIGHTS.RELATED_MATCH;
          matchDetails.related++;
        }
      });
    
      // 3. Process title and description
      if (item.title) {
        const titleWords = item.title.toLowerCase().split(/\W+/);
        titleWords.forEach(word => {
          if (expandedInterests.has(word)) {
            totalScore += WEIGHTS.TITLE_MATCH;
            matchDetails.title++;
          } else if (this.hasRelatedTermMatch(word, normalizedInterests)) {
            totalScore += WEIGHTS.TITLE_MATCH * 0.7; // Increased from 0.5
            matchDetails.title++;
          }
        });
      }
    
      if (item.description) {
        const descWords = item.description.toLowerCase().split(/\W+/);
        descWords.forEach(word => {
          if (expandedInterests.has(word)) {
            totalScore += WEIGHTS.DESCRIPTION_MATCH;
            matchDetails.description++;
          } else if (this.hasRelatedTermMatch(word, normalizedInterests)) {
            totalScore += WEIGHTS.DESCRIPTION_MATCH * 0.7; // Increased from 0.5
            matchDetails.description++;
          }
        });
      }
    
      // Apply interest-specific boosts
      normalizedInterests.forEach(interest => {
        if (interest === 'dance') {
          const isDanceEvent = itemTags.has('dance') || 
                              itemTags.has('choreography') || 
                              itemTags.has('performance');
          if (isDanceEvent) {
            totalScore *= 1.3; // 30% boost for dance events
          }
        }
      });
    
      // Apply time-based boost for upcoming events
      if (item.type === 'event' && item.date) {
        const daysUntil = (new Date(item.date) - new Date()) / (1000 * 60 * 60 * 24);
        if (daysUntil <= 7) {
          totalScore *= 1.3;   // 30% boost for week or less
        } else if (daysUntil <= 14) {
          totalScore *= 1.15;  // 15% boost for two weeks
        }
      }
    
      // Ensure minimum score for matching organization
      if (item.organization && 
          ORGANIZATION_CATEGORIES[item.organization] && 
          matchDetails.primary + matchDetails.secondary > 0) {
        totalScore = Math.max(totalScore, 0.3); // Minimum score of 0.3 for matching org
      }
    
      // Debug logging
      debugLog('Interest Score Calculation:', {
        itemId: item._id,
        title: item.title,
        organization: item.organization,
        tags: Array.from(itemTags),
        userInterests: normalizedInterests,
        expandedInterests: Array.from(expandedInterests),
        matchDetails,
        rawScore: totalScore,
        finalScore: Math.min(totalScore, 1)
      });
    
      return Math.min(totalScore, 1);
    }
  
  // Helper methods
  static hasInterestMatch(userInterests, targetInterest) {
    const target = targetInterest.toLowerCase();
    return userInterests.some(interest => {
      const normalized = interest.toLowerCase();
      // Check exact match
      if (normalized === target) return true;
      // Check partial match
      if (normalized.includes(target) || target.includes(normalized)) return true;
      // Check mapped interests
      return this.interestMap[normalized]?.includes(target) || 
             this.interestMap[target]?.includes(normalized);
    });
  }
  
  static hasTagMatch(tag, interests) {
    const tagLower = tag.toLowerCase();
    return interests.some(interest => {
      // Direct match
      if (tagLower === interest) return true;
      // Partial match
      if (tagLower.includes(interest) || interest.includes(tagLower)) return true;
      // Related match through interest map
      return this.interestMap[interest]?.includes(tagLower) ||
             this.interestMap[tagLower]?.includes(interest);
    });
  }
  
    static hasRelatedTermMatch(tag, interests) {
    const relatedTerms = {
      // Core interests
      'music': ['song', 'concert', 'performance', 'band', 'instrument', 'orchestra', 'choir', 'vocal', 'singing', 'musical'],
      'dance': ['performance', 'choreography', 'movement', 'stage', 'modern-dance', 'traditional', 'dancing'],
      'theatre': ['drama', 'play', 'performance', 'stage', 'acting', 'production', 'theatrical'],
      'visual-arts': ['art', 'painting', 'drawing', 'design', 'creative', 'digital', 'artwork', 'canvas'],
      'performance': ['show', 'stage', 'live', 'concert', 'presentation', 'production', 'performing'],
      
      // Specialized interests
      'vocal-arts': ['singing', 'choir', 'voice', 'musical', 'song', 'vocal', 'vocals'],
      'modern-music': ['contemporary', 'band', 'popular', 'modern', 'pop', 'current'],
      'traditional-arts': ['cultural', 'folk', 'heritage', 'traditional', 'indigenous', 'ethnic'],
      
      // Technical interests
      'technical-production': ['production', 'technical', 'multimedia', 'audio', 'visual', 'stage'],
      'multimedia': ['digital', 'media', 'audio', 'visual', 'production', 'technical'],
      
      // Additional mappings
      'band': ['music', 'instrument', 'orchestra', 'ensemble', 'group', 'performance'],
      'instruments': ['musical', 'orchestra', 'band', 'music', 'performance'],
      'drama': ['theatre', 'acting', 'performance', 'stage', 'dramatic'],
      'cultural': ['traditional', 'heritage', 'folk', 'cultural-arts', 'indigenous'],
      'choir': ['vocal', 'singing', 'voice', 'music', 'ensemble'],
      
      // General terms
      'creative': ['art', 'design', 'visual', 'artistic', 'creative-arts'],
      'digital': ['multimedia', 'technical', 'digital-art', 'visual', 'technology'],
      'performing': ['performance', 'stage', 'live', 'show', 'act']
    };
  
    // Normalize inputs
    const normalizedTag = tag.toLowerCase().trim();
    const normalizedInterests = interests.map(i => i.toLowerCase().trim());
  
    try {
      return normalizedInterests.some(interest => {
        // Direct match in relatedTerms
        if (relatedTerms[interest]?.includes(normalizedTag)) return true;
        
        // Reverse match (tag is a key in relatedTerms)
        if (relatedTerms[normalizedTag]?.includes(interest)) return true;
        
        // Check if any related terms of the interest match the tag
        return Object.entries(relatedTerms).some(([key, terms]) => {
          if (terms.includes(interest) && terms.includes(normalizedTag)) return true;
          if (terms.includes(interest) && key === normalizedTag) return true;
          if (terms.includes(normalizedTag) && key === interest) return true;
          return false;
        });
      });
    } catch (error) {
      console.error('Error in hasRelatedTermMatch:', {
        error: error.message,
        tag: normalizedTag,
        interests: normalizedInterests
      });
      return false;
    }
  }

  static calculateImplicitScore(item, implicitPreferences) {
    if (!item.tags || !implicitPreferences) return 0;
    
    let score = 0;
    item.tags.forEach(tag => {
      if (implicitPreferences[tag]) {
        score += implicitPreferences[tag];
      }
    });
    
    return score / Math.max(item.tags.length, 1);
  }

    static calculateEventTimeRelevance(event) {
    if (!event?.date) return 0;
    
    const now = new Date();
    const eventDate = new Date(event.date);
    const daysUntil = (eventDate - now) / (1000 * 60 * 60 * 24);
  
    // Enhanced time relevance scoring
    switch (event.status) {
      case 'ongoing':
        return 1.0; // Maximum score for ongoing events
        
      case 'upcoming':
        if (daysUntil <= 1) return 0.95;  // Tomorrow
        if (daysUntil <= 2) return 0.90;  // Day after tomorrow
        if (daysUntil <= 3) return 0.85;  // Within 3 days
        if (daysUntil <= 5) return 0.80;  // Within 5 days
        if (daysUntil <= 7) return 0.75;  // Within a week
        if (daysUntil <= 14) return 0.65; // Within 2 weeks
        if (daysUntil <= 21) return 0.55; // Within 3 weeks
        if (daysUntil <= 30) return 0.45; // Within a month
        return Math.max(0.2, 1 - (daysUntil / 60)); // Gradually decrease up to 2 months
        
      case 'completed':
        return 0;
        
      default:
        return 0;
    }
  }


  static calculateEventScore(event, user) {
    let score = 0;
    const normalizedInterests = this.normalizeLegacyInterests(user.interests);
    const orgInfo = ORGANIZATION_CATEGORIES[event.organization];
  
    // Base organization score
    if (orgInfo) {
      if (normalizedInterests.includes(orgInfo.primaryInterest)) {
        score += 0.4;
      }
      if (orgInfo.secondaryInterests.some(i => normalizedInterests.includes(i))) {
        score += 0.3;
      }
      if (orgInfo.tags.some(t => normalizedInterests.includes(t))) {
        score += 0.2;
      }
    }
  
    // Tag matching score
    const tagMatchCount = event.tags?.filter(tag => 
      normalizedInterests.includes(tag) ||
      normalizedInterests.some(interest => tag.includes(interest))
    ).length || 0;
    
    score += (tagMatchCount * 0.15);
  
    // Time relevance boost
    const daysUntil = (new Date(event.date) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 7) {
      score *= 1.3;  // 30% boost for upcoming week
    } else if (daysUntil <= 14) {
      score *= 1.15; // 15% boost for upcoming two weeks
    }
  
    return Math.min(score, 1);
  }

  static getWeights(type, hasImplicitPrefs) {
    return type === 'event' ? {
      base: 0.2,
      recency: 0.25,
      explicit: 0.6, // Strong explicit interest
      implicit: hasImplicitPrefs ? 0.05 : 0 // Weak implicit
    } : {
      base: 0.3,
      recency: 0.2,
      explicit: 0.5, // Strong explicit interest
      implicit: hasImplicitPrefs ? 0.1 : 0 // Weak implicit
    };
  }

  static getMetrics() {
    const avgTime = this.metrics.timing.length > 0 
      ? this.metrics.timing.reduce((a, b) => a + b, 0) / this.metrics.timing.length 
      : 0;

    return {
      calculations: this.metrics.calculations,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      errors: this.metrics.errors,
      averageTime: Math.round(avgTime),
      cacheSize: this.scoreCache.size
    };
  }

  static getContentTypeBoost(item) {
    const boosts = {
      announcement: 1.2,
      'event-related': 1.3,
      highlight: 1.4,
      regular: 1.0
    };
    return boosts[item.contentType] || 1.0;
  }

  static scoreCache = new Map();
  static CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  static metrics = {
    calculations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    timing: []
  };

  // Add cache management methods
  static getCachedScore(key) {
    const cached = this.scoreCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.metrics.cacheHits++;
      return cached.score;
    }
    this.metrics.cacheMisses++;
    return null;
  }

  static cacheScore(key, score) {
    this.scoreCache.set(key, {
      score,
      timestamp: Date.now()
    });
    if (this.scoreCache.size > 1000) this.cleanCache();
  }

  static cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.scoreCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.scoreCache.delete(key);
      }
    }
  }

  static normalizeImagePath(imagePath) {
    if (!imagePath) return null;
    return `/uploads/${path.basename(imagePath)}`;
  }

  static getMatchedInterests(item, userInterests) {
    return (item.tags || []).filter(tag => userInterests.includes(tag));
  }

  static normalizeContent(item) {
    if (!item) return null;

  // helper for path normalization inside this service (assumes images already absolute or relative)
  const normalizeImagePath = (p) => {
    if (!p) return null;
    if (typeof p !== 'string') return null;
    return p;
  };

  // prefer media but fallback to img (legacy)
  const rawMedia = item.media || item.img || null;
  const media = rawMedia ? normalizeImagePath(rawMedia) : null;
  const img = item.img ? normalizeImagePath(item.img) : (item.media ? normalizeImagePath(item.media) : null);

  return {
    ...item,
    image: item.image ? normalizeImagePath(item.image) : null,
    media,
    img,
    mediaType: item.mediaType || (rawMedia && /\.(mp4|mov|webm|avi|mkv)$/i.test(rawMedia) ? 'video' : item.mediaType || null),
    profilePicture: item.profilePicture ? normalizeImagePath(item.profilePicture) : (item.profilePic ? normalizeImagePath(item.profilePic) : null),
    userId: item.userId?._id || item.userId,
    createdBy: item.createdBy?._id || item.createdBy,
    sharedPost: item.sharedPost || null
  };
  }

  static getRecommendationReason(item, user) {
    if (user.following.includes(item.userId?.toString())) {
    }
    return 'Popular in your network';
  }

    static distributeContent(events, posts) {
      // Updated configuration for better event visibility
      const DISTRIBUTION_CONFIG = {
        minEventScore: 0.05,
        maxEventsPerBlock: 3,
        // scatter events every N posts (randomized between intervalMin..intervalMax)
        eventIntervalMin: 3,
        eventIntervalMax: 5,
        eventBoostMultiplier: 2.0,
        upcomingEventBoost: 2.5,
        minimumEventsPerPage: 2,
        eventRatio: 0.3,
        // new: cap shared posts ratio in feed to avoid over-saturation
        maxSharedPostRatio: 0.35 // at most 35% of posts should be shared-posts
      };

      // If many posts are shared, demote their scores so they don't dominate
      const totalPosts = posts.length || 1;
      const maxSharedAllowed = Math.ceil(totalPosts * DISTRIBUTION_CONFIG.maxSharedPostRatio);

      // Count shared posts and demote if over threshold
      const sharedPostsCount = posts.filter(p => Boolean(p.sharedPost)).length;
      if (sharedPostsCount > maxSharedAllowed) {
        // Apply demotion factor proportionally
        const demoteFactor = 0.6; // reduce final score for shared posts
        posts = posts.map(p => {
          if (p.sharedPost) {
            return { ...p, finalScore: (p.finalScore || 0) * demoteFactor };
          }
          return p;
        });
        debugLog('Shared posts demoted', { sharedPostsCount, maxSharedAllowed, demoteFactor });
      }

      // Pre-process events with stronger boosting and more lenient filtering
    const validEvents = events
      .filter(e => {
        // Accept events with matching tags or minimum score
        const hasMatchingTags = e.tags?.some(tag => 
          this.interestMap[tag] || 
          Object.values(ORGANIZATION_CATEGORIES).some(cat => 
            cat.tags.includes(tag)
          )
        );
        return hasMatchingTags || e.finalScore >= DISTRIBUTION_CONFIG.minEventScore;
      })
      .map(e => {
        // Enhanced boosting logic
        let boostedScore = e.finalScore * DISTRIBUTION_CONFIG.eventBoostMultiplier;
        
        // Apply status-based boosts
        if (e.status === 'upcoming') {
          const daysUntil = (new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24);
          if (daysUntil <= 7) {
            boostedScore *= DISTRIBUTION_CONFIG.upcomingEventBoost;
          } else if (daysUntil <= 14) {
            boostedScore *= 1.75;
          }
        }
  
        // Additional boost for events with matching tags
        if (e.tags?.length > 0) {
          boostedScore *= 1.5;
        }
  
        return { ...e, finalScore: boostedScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  
    // Sort posts by score
    const sortedPosts = posts.sort((a, b) => b.finalScore - a.finalScore);
  
    debugLog('Initial Content Stats:', {
      totalEvents: events.length,
      validEvents: validEvents.length,
      totalPosts: posts.length,
      topEvents: validEvents.slice(0, 3).map(e => ({
        title: e.title,
        score: e.finalScore,
        status: e.status
      }))
    });
  
    // Initialize result array
    const result = [];
    let eventIndex = 0;
    let postIndex = 0;
  
    // helper: random interval generator between min and max (inclusive)
    const randInterval = (min, max) => {
      if (min >= max) return min;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };
  
    // target number of events to try to place
    const targetEventCount = Math.min(
      validEvents.length,
      Math.max(
        DISTRIBUTION_CONFIG.minimumEventsPerPage,
        Math.round(posts.length * DISTRIBUTION_CONFIG.eventRatio)
      )
    );
  
    // start with a random interval
    let postsUntilNextEvent = randInterval(DISTRIBUTION_CONFIG.eventIntervalMin, DISTRIBUTION_CONFIG.eventIntervalMax);
  
    // Iterate through posts and insert events after randomized intervals
    while (postIndex < sortedPosts.length || eventIndex < Math.min(validEvents.length, targetEventCount)) {
      // push posts until it's time to place an event
      while (postIndex < sortedPosts.length && postsUntilNextEvent > 0) {
        result.push(sortedPosts[postIndex++]);
        postsUntilNextEvent--;
      }
  
      // insert one event if available and we haven't exceeded targetEventCount
      if (eventIndex < Math.min(validEvents.length, targetEventCount)) {
        result.push(validEvents[eventIndex++]);
        // reset interval
        postsUntilNextEvent = randInterval(DISTRIBUTION_CONFIG.eventIntervalMin, DISTRIBUTION_CONFIG.eventIntervalMax);
      } else {
        // no more events to place or reached target — continue adding remaining posts
        while (postIndex < sortedPosts.length) {
          result.push(sortedPosts[postIndex++]);
        }
      }
    }
  
    // If there are leftover events (more than targetEventCount), append them sparsely at the end
    while (eventIndex < validEvents.length) {
      // try inserting an event after every eventIntervalMax posts at end
      const insertAfter = Math.min(result.length, result.length - (postsUntilNextEvent || DISTRIBUTION_CONFIG.eventIntervalMax));
      result.splice(insertAfter, 0, validEvents[eventIndex++]);
    }
  
    // Debug final distribution
    debugLog('Final Distribution:', {
      total: result.length,
      events: result.filter(i => i.type === 'event').length,
      posts: result.filter(i => i.type === 'post').length,
      followingPosts: result.filter(i => i.fromFollowing).length,
      topScores: result.slice(0, 10).map(i => ({
        type: i.type,
        score: i.finalScore,
        title: i.title,
        status: i.type === 'event' ? i.status : undefined
      }))
    });
  
    return result;
  }

    static sortContent(content, sortBy) {
    // Configuration for sorting weights and boosts
    const SORT_CONFIG = {
      typeWeights: {
        event: 1.2,
        post: 1.0
      },
      boosts: {
        following: 1.3,
        upcoming: 1.25,
        trending: 1.15,
        highEngagement: 1.1
      },
      timeDecay: {
        halfLife: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        maxAge: 30 * 24 * 60 * 60 * 1000   // 30 days in milliseconds
      }
    };
  
    const now = new Date();
  
    // Calculate time-based score
    const getTimeScore = (item) => {
      const itemDate = new Date(item.createdAt || item.date);
      const age = now - itemDate;
      if (age > SORT_CONFIG.timeDecay.maxAge) return 0;
      return Math.exp(-Math.log(2) * age / SORT_CONFIG.timeDecay.halfLife);
    };
  
    // Calculate engagement score
    const getEngagementBoost = (item) => {
      if (item.type === 'event') {
        const registrations = item.engagementMetrics?.registrations || 0;
        const interested = item.engagementMetrics?.interested || 0;
        return (registrations > 10 || interested > 20) ? SORT_CONFIG.boosts.highEngagement : 1;
      }
      const likes = item.likes?.length || 0;
      const comments = item.engagementMetrics?.commentCount || 0;
      return (likes > 15 || comments > 5) ? SORT_CONFIG.boosts.highEngagement : 1;
    };
  
    // Calculate final sort score based on sort type
    const calculateSortScore = (item) => {
      const baseScore = item.finalScore * SORT_CONFIG.typeWeights[item.type];
      const timeScore = getTimeScore(item);
      const engagementBoost = getEngagementBoost(item);
      
      let score = baseScore;
  
      switch (sortBy) {
        case 'recent':
          score = timeScore * (baseScore * 0.3 + 0.7);
          break;
        
        case 'relevance':
          score = baseScore * (timeScore * 0.2 + 0.8) * engagementBoost;
          break;
        
        case 'hybrid':
        default:
          // Combine all factors with weights
          score = (
            baseScore * 0.4 +                    // Base relevance (40%)
            timeScore * 0.3 +                    // Recency (30%)
            engagementBoost * 0.3                // Engagement (30%)
          );
          
          // Apply boosts
          if (item.fromFollowing) {
            score *= SORT_CONFIG.boosts.following;
          }
          if (item.type === 'event' && item.status === 'upcoming') {
            const daysUntil = (new Date(item.date) - now) / (1000 * 60 * 60 * 24);
            if (daysUntil <= 7) {
              score *= SORT_CONFIG.boosts.upcoming;
            }
          }
          break;
      }
  
      // Debug sorting details
      debugLog('Sort Score Calculation:', {
        itemId: item._id,
        type: item.type,
        baseScore: item.finalScore,
        timeScore,
        engagementBoost,
        finalScore: score,
        sortBy
      });
  
      return score;
    };
  
    // Sort content with detailed logging
    const sortedContent = content
      .map(item => ({
        ...item,
        sortScore: calculateSortScore(item)
      }))
      .sort((a, b) => b.sortScore - a.sortScore);
  
    // Log distribution statistics
    debugLog('Content Distribution After Sort:', {
      total: sortedContent.length,
      events: sortedContent.filter(i => i.type === 'event').length,
      posts: sortedContent.filter(i => i.type === 'post').length,
      followingPosts: sortedContent.filter(i => i.fromFollowing).length,
      topScores: sortedContent.slice(0, 5).map(i => ({
        type: i.type,
        score: i.sortScore,
        isFollowing: i.fromFollowing,
        status: i.type === 'event' ? i.status : undefined
      }))
    });
  
    return sortedContent;
  }

  // NEW: fetch events that match a user's interests/orgs (does NOT alter hybrid recommender)
  static async getEventsMatchingUser(user = {}, limit = 20) {
    try {
      console.log('[RecommendationService] getEventsMatchingUser called', {
        userId: user?._id || '(none)',
        interests: user?.interests,
        organizations: user?.organizations,
        limit
      });

      const normalizedInterests = (user.interests || []).map(i => String(i).trim()).filter(Boolean);
      const normalizedOrgs = (user.organizations || []).map(o => String(o).trim()).filter(Boolean);

      // build regex arrays so matching is case-insensitive and robust to small differences
      const interestRegexes = normalizedInterests.length
        ? normalizedInterests.map(i => new RegExp(`^${escapeRegex(i)}$`, 'i'))
        : [];
      const orgRegexes = normalizedOrgs.length
        ? normalizedOrgs.map(o => new RegExp(`^${escapeRegex(o)}$`, 'i'))
        : [];

      // If no interests/orgs, return public, upcoming/ongoing events as fallback
      if (!interestRegexes.length && !orgRegexes.length) {
        return await Event.find({
          visibility: 'public',
          status: { $in: ['upcoming', 'ongoing'] }
        })
          .populate('createdBy', 'name profilePicture organization')
          .sort({ date: 1 })
          .limit(limit)
          .lean();
      }

      const query = {
        $and: [
          { visibility: { $in: ['public', 'organization-only'] } },
          {
            $or: [
              ...(interestRegexes.length ? [{ tags: { $in: interestRegexes } }] : []),
              ...(orgRegexes.length ? [{ organization: { $in: orgRegexes } }] : [])
            ]
          }
        ]
      };

      debugLog('getEventsMatchingUser query', { query, normalizedInterests, normalizedOrgs });

      return Event.find(query)
        .populate('createdBy', 'name profilePicture organization')
        .sort({ date: -1 })
        .limit(limit)
        .lean();
    } catch (err) {
      console.error('[RecommendationService] getEventsMatchingUser ERROR:', err && (err.stack || err.message || err));
      // DEV: return empty array so route doesn't 500 and UI falls back to hybrid feed
      return [];
    }
  }
}

module.exports = {
  RecommendationService,
  ORGANIZATION_CATEGORIES,
  trackUserEngagement: RecommendationService.trackUserEngagement
};