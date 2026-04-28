# Hybrid Feed Recommendation Algorithm (Condensed)

## Algorithm Overview

```javascript
class RecommendationService {
  
  // Main recommendation algorithm combining events and posts
  static async getHybridFeed(userId, options = {}) {
    const { page = 1, limit = 50, eventRatio = 0.15, sortBy = 'hybrid' } = options;
    
    const user = await User.findById(userId)
      .select('interests organizations following')
      .lean();
    
    // Normalize user interests for consistent matching
    let normalizedInterests = this.normalizeLegacyInterests(user.interests || [])
      .map(i => String(i).toLowerCase().trim())
      .filter(Boolean);
    
    const isColdStart = normalizedInterests.length === 0;
    
    // ===== CONTENT FETCHING =====
    
    // 1. Fetch Events (15% of feed)
    const eventQuery = {
      $and: [
        { status: { $in: ['upcoming', 'ongoing'] } },
        { $or: [
            { tags: { $in: normalizedInterests } },
            { organization: { $in: user.organizations || [] } },
            { visibility: 'public' }
          ]}
      ]
    };
    const events = await Event.find(eventQuery).limit(eventLimit * 2).lean();
    
    // 2. Fetch Following Posts (30% of feed)
    const followingIds = (user.following || []).map(id => String(id._id || id));
    const followingPosts = await Post.find({ userId: { $in: followingIds } })
      .limit(Math.max(200, limit * 15))
      .lean();
    
    // 3. Fetch General Posts (55% of feed) - Interest or popularity based
    let generalPosts;
    if (isColdStart) {
      generalPosts = await Post.find({ visibility: 'public' })
        .sort({ 'engagementMetrics.popularity': -1 })
        .limit(Math.max(250, limit * 15))
        .lean();
    } else {
      generalPosts = await Post.find({
        userId: { $nin: [...followingIds, userId] },
        $or: [
          { tags: { $in: normalizedInterests } },
          { title: { $regex: combinedRegex } }
        ]
      }).limit(Math.max(250, limit * 15)).lean();
    }
    
    // ===== CONTENT SCORING =====
    
    // Score all content items
    const scoredContent = [
      ...events.map(event => ({
        ...event,
        type: 'event',
        finalScore: this.calculateFinalScore(event, user)
      })),
      ...followingPosts.map(post => ({
        ...post,
        type: 'post',
        fromFollowing: true,
        finalScore: this.calculateFinalScore(post, user)
      })),
      ...generalPosts.map(post => ({
        ...post,
        type: 'post',
        fromFollowing: false,
        finalScore: this.calculateFinalScore(post, user)
      }))
    ];
    
    // Distribute and sort content
    const distributed = this.distributeContent(events, posts);
    const sorted = this.sortContent(distributed, sortBy);
    
    // Paginate results
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      hasMore: start + limit < sorted.length,
      total: sorted.length,
      debug: { followingPostsCount: followingPosts.length, eventsCount: events.length }
    };
  }
  
  // ===== SCORING FUNCTIONS =====
  
  // Calculate final score for any content item (event or post)
  static async calculateFinalScore(item, user) {
    const weights = this.getWeights(item.type, !!user.implicitPreferences);
    
    if (item.type === 'event') {
      const orgScore = await this.calculateCollaborativeScore(item, user);
      const interestScore = this.calculateInterestScore(item, user.interests);
      const timeScore = this.calculateEventTimeRelevance(item);
      const recencyScore = this.calculateRecencyScore(item);
      
      const finalScore = (
        (orgScore * weights.base) +
        (interestScore * weights.explicit * 0.97) +
        (timeScore * 0.2) +
        (recencyScore * weights.recency)
      );
      return Math.min(Math.max(finalScore, 0.2), 1);
    } else {
      // Post scoring
      const interestScore = this.calculateInterestScore(item, user.interests);
      const recencyScore = this.calculateRecencyScore(item);
      const popularityScore = this.normalizePopularityScore(
        item.engagementMetrics?.views || 0, 'post'
      );
      
      const finalScore = (
        (interestScore * weights.explicit) +
        (recencyScore * weights.recency) +
        (popularityScore * 0.1)
      );
      return Math.min(Math.max(finalScore, 0.2), 1);
    }
  }
  
  // Calculate interest match score (primary relevance signal)
  static calculateInterestScore(item, userInterests) {
    const itemTags = item.tags || TagExtractor.extractFromDescription(item.desc || '');
    
    if (!itemTags?.length || !userInterests?.length) return 0.0;
    
    const WEIGHTS = {
      EXACT_MATCH: 1.0,
      PRIMARY_ORG_MATCH: 0.9,
      SECONDARY_ORG_MATCH: 0.7,
      PARTIAL_MATCH: 0.5,
      RELATED_MATCH: 0.3
    };
    
    const normalizedInterests = this.normalizeLegacyInterests(userInterests)
      .map(i => i.toLowerCase());
    
    let totalScore = 0;
    let matchFound = false;
    
    // Check organization primary/secondary matches
    const orgInfo = ORGANIZATION_CATEGORIES[item.organization];
    if (orgInfo) {
      if (normalizedInterests.includes(orgInfo.primaryInterest)) {
        totalScore += WEIGHTS.PRIMARY_ORG_MATCH;
        matchFound = true;
      }
      if (orgInfo.secondaryInterests.some(i => normalizedInterests.includes(i))) {
        totalScore += WEIGHTS.SECONDARY_ORG_MATCH;
        matchFound = true;
      }
    }
    
    // Check tag matches against user interests
    itemTags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (normalizedInterests.includes(tagLower)) {
        totalScore += WEIGHTS.EXACT_MATCH;
        matchFound = true;
      } else if (normalizedInterests.some(interest => 
        tagLower.includes(interest) || interest.includes(tagLower))) {
        totalScore += WEIGHTS.PARTIAL_MATCH;
        matchFound = true;
      }
    });
    
    // Normalize to 0-1 scale
    let normalizedScore = totalScore / Math.max(itemTags.length, normalizedInterests.length);
    
    if (matchFound && normalizedScore < 0.3) {
      normalizedScore = 0.3; // Minimum for any match
    }
    
    return Math.min(normalizedScore, 1);
  }
  
  // Collaborative filtering: events popular with similar users
  static async calculateCollaborativeScore(event, user) {
    // Find users with similar interests/organizations
    const similarUsers = await User.find({
      _id: { $ne: user._id },
      $or: [
        { interests: { $in: user.interests } },
        { organizations: { $in: user.organizations || [] } }
      ]
    }).lean();
    
    // Get engagement metrics for this organization (30-day window)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const orgEngagement = await Event.aggregate([
      {
        $match: {
          organization: event.organization,
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$organization',
          totalInterested: { $sum: '$engagementMetrics.interested' },
          totalRegistrations: { $sum: '$engagementMetrics.registrations' }
        }
      }
    ]);
    
    const orgInfo = ORGANIZATION_CATEGORIES[event.organization] || {};
    const orgBaseScore = (user.interests.includes(orgInfo.primaryInterest) ? 0.6 : 0) +
                        (orgInfo.secondaryInterests?.some(i => user.interests.includes(i)) ? 0.4 : 0);
    
    const engagementScore = Math.min(
      (orgEngagement[0]?.totalInterested || 0) / 100, 1
    );
    
    return (orgBaseScore * 0.6) + (engagementScore * 0.4);
  }
  
  // Time-based relevance for events
  static calculateEventTimeRelevance(event) {
    const now = new Date();
    const eventDate = new Date(event.date);
    const daysUntil = (eventDate - now) / (1000 * 60 * 60 * 24);
    
    if (event.status === 'ongoing') return 1.0;
    if (event.status === 'upcoming') {
      if (daysUntil <= 7) return 1.0;
      if (daysUntil <= 14) return 0.8;
      if (daysUntil <= 30) return 0.5;
      if (daysUntil <= 60) return 0.3;
      return 0.1;
    }
    return 0;
  }
  
  // Recency decay: content older than 1 week gradually loses visibility
  static calculateRecencyScore(item) {
    const now = new Date();
    const itemDate = new Date(item.createdAt || item.date);
    const hoursSince = (now - itemDate) / (1000 * 60 * 60);
    return Math.exp(-hoursSince / 168); // 168 hours = 1 week half-life
  }
  
  // ===== DISTRIBUTION & RANKING =====
  
  // Distribute events and posts for balanced feed diversity
  static distributeContent(events, posts) {
    const DISTRIBUTION_CONFIG = {
      eventRatio: 0.3,
      eventIntervalMin: 3,
      eventIntervalMax: 5,
      maxSharedPostRatio: 0.35
    };
    
    const validEvents = events
      .filter(e => e.finalScore >= 0.05)
      .map(e => ({ ...e, finalScore: e.finalScore * 2.0 })) // Boost events
      .sort((a, b) => b.finalScore - a.finalScore);
    
    const sortedPosts = posts.sort((a, b) => b.finalScore - a.finalScore);
    
    const result = [];
    let eventIndex = 0, postIndex = 0;
    let postsUntilNextEvent = Math.floor(Math.random() * 2) + 3; // Random 3-5
    
    // Interleave events and posts
    while (postIndex < sortedPosts.length || eventIndex < validEvents.length) {
      while (postIndex < sortedPosts.length && postsUntilNextEvent > 0) {
        result.push(sortedPosts[postIndex++]);
        postsUntilNextEvent--;
      }
      
      if (eventIndex < validEvents.length) {
        result.push(validEvents[eventIndex++]);
        postsUntilNextEvent = Math.floor(Math.random() * 2) + 3;
      } else {
        while (postIndex < sortedPosts.length) {
          result.push(sortedPosts[postIndex++]);
        }
      }
    }
    
    return result;
  }
  
  // Sort content by relevance (Mean Reciprocal Rank optimization)
  static sortContent(content, sortBy = 'hybrid') {
    const now = new Date();
    const getTimeDecay = (item) => {
      const age = now - new Date(item.createdAt || item.date);
      const halfLife = 7 * 24 * 60 * 60 * 1000; // 7 days
      return Math.exp(-Math.log(2) * age / halfLife);
    };
    
    const getEngagementBoost = (item) => {
      if (item.finalScore > 0.65) return 1.3;
      if (item.finalScore > 0.50) return 1.15;
      if (item.finalScore > 0.30) return 1.05;
      return 1.0;
    };
    
    return content
      .map(item => {
        let score = item.finalScore;
        
        if (sortBy === 'hybrid' || sortBy === 'relevance') {
          score = score * getTimeDecay(item) * getEngagementBoost(item);
        } else if (sortBy === 'recent') {
          score = getTimeDecay(item);
        }
        
        return { ...item, sortScore: score };
      })
      .sort((a, b) => b.sortScore - a.sortScore);
  }
  
  // ===== SUPPORTING DATA =====
  
  static ORGANIZATION_CATEGORIES = {
    'UTPC': { primaryInterest: 'visual-arts', secondaryInterests: ['performance'] },
    'CAST': { primaryInterest: 'theatre', secondaryInterests: ['music'] },
    'CULTURA': { primaryInterest: 'cultural', secondaryInterests: ['music', 'performance'] },
    'UMAK Jammers': { primaryInterest: 'music', secondaryInterests: ['performance'] },
    'UMAK Chorale': { primaryInterest: 'music', secondaryInterests: ['performance'] },
    'UMAK Dance Extreme': { primaryInterest: 'performance', secondaryInterests: ['cultural'] },
    'UMAK Siglahi': { primaryInterest: 'cultural', secondaryInterests: ['performance'] },
    'UMAK Brass Band': { primaryInterest: 'music', secondaryInterests: ['performance'] }
  };
  
  static getWeights(type, hasImplicitPrefs) {
    return type === 'event' ? {
      base: 0.05,
      recency: 0.05,
      explicit: 0.80,     // Primary: Interest matching
      implicit: 0.10
    } : {
      base: 0.00,
      recency: 0.10,
      explicit: 0.80,
      implicit: 0.10
    };
  }
}
```

## Algorithm Flow Diagram

```
User Request → Fetch User Profile
                ↓
        Normalize User Interests
                ↓
    ┌───────────┼───────────┐
    ↓           ↓           ↓
  Events      Following   General
              Posts       Posts
    ↓           ↓           ↓
    └───────────┼───────────┘
                ↓
        Score Each Item:
        - Interest Match (80%)
        - Recency (5-10%)
        - Collaborative Signal (5%)
                ↓
        Distribute Content
        (Interleave events & posts)
                ↓
        Sort by Relevance Score
        (MRR-optimized ranking)
                ↓
        Paginate & Return Results
```

## Key Components

| Component | Purpose | Weight |
|-----------|---------|--------|
| **Interest Matching** | Match item tags/content to user interests | 80% |
| **Recency Scoring** | Exponential decay favoring recent content | 5-10% |
| **Collaborative Filtering** | Boost events popular with similar users | 5% |
| **Time Relevance** | Prioritize upcoming events (7-day window) | 20% (events) |
| **Engagement Boost** | Separate high-confidence matches | Variable |

## Interest Matching Weights

```
Exact Tag Match:              1.0 (100%)
Primary Organization Match:   0.9 (90%)
Secondary Organization Match: 0.7 (70%)
Partial Tag Match:            0.5 (50%)
Related Term Match:           0.3 (30%)
```

## Cold-Start Handling

For users with no interests:
- Return popular public posts (sorted by views/engagement)
- Return all public upcoming events
- Minimum visibility floor ensures content discovery

## Performance Optimizations

- **Score Caching**: 5-minute TTL cache prevents redundant calculations
- **Lazy Loading**: Fetch 10-15x limit to support pagination
- **Per-User Limits**: Max 3 posts per user ensures feed diversity
- **Fallback Content**: 5-stage cascading fetch for insufficient results
