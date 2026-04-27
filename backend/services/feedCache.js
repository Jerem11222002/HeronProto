/**
 * Feed Cache Service
 * Caches feed recommendations to avoid expensive RecommendationService calculations
 * TTL: 2 minutes - balances freshness and performance
 */

class FeedCache {
  constructor() {
    this.cache = {};
    this.timers = {};
  }

  getKey(userId, feedType = 'my-feed', page = 1) {
    return `feed:${userId}:${feedType}:${page}`;
  }

  get(userId, feedType = 'my-feed', page = 1) {
    const key = this.getKey(userId, feedType, page);
    const cached = this.cache[key];

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      this.invalidate(userId, feedType);
      return null;
    }

    const ageInSeconds = Math.round((Date.now() - cached.timestamp) / 1000);
    console.log(`📦 [CACHE HIT] Feed ${userId} ${feedType} page ${page} (${ageInSeconds}s old)`);
    return cached;
  }

  set(userId, feedType = 'my-feed', page = 1, feedData, ttl = 120000) {
    const key = this.getKey(userId, feedType, page);
    const now = Date.now();

    const feedSize = JSON.stringify(feedData).length;
    
    // Only cache if reasonably sized (prevent memory bloat)
    if (feedSize > 500 * 1024) {
      return;
    }

    this.cache[key] = {
      data: feedData,
      timestamp: now,
      expiresAt: now + ttl,
      size: feedSize
    };

    if (this.timers[key]) {
      clearTimeout(this.timers[key]);
    }

    this.timers[key] = setTimeout(() => {
      delete this.cache[key];
      delete this.timers[key];
    }, ttl);

    console.log(`💾 [CACHE SET] Feed ${userId} ${feedType} page ${page} (TTL: 2m)`);
  }

  invalidate(userId, feedType = null) {
    if (feedType) {
      const keysToDelete = Object.keys(this.cache).filter(
        k => k.startsWith(`feed:${userId}:${feedType}:`)
      );

      keysToDelete.forEach(key => {
        clearTimeout(this.timers[key]);
        delete this.cache[key];
        delete this.timers[key];
      });
    } else {
      const keysToDelete = Object.keys(this.cache).filter(
        k => k.startsWith(`feed:${userId}:`)
      );

      keysToDelete.forEach(key => {
        clearTimeout(this.timers[key]);
        delete this.cache[key];
        delete this.timers[key];
      });
    }
  }

  invalidateAll() {
    Object.keys(this.timers).forEach(key => {
      clearTimeout(this.timers[key]);
    });

    const count = Object.keys(this.cache).length;
    this.cache = {};
    this.timers = {};
    
    if (count > 0) {
      console.log(`🔄 [CACHE INVALIDATE ALL] Cleared ${count} feed entries`);
    }
  }
}

module.exports = new FeedCache();
