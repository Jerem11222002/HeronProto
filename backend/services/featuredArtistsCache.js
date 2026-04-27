/**
 * Featured Artists Cache Service
 * 
 * Provides in-memory caching for featured artists queries with TTL-based expiration.
 * Automatically invalidates when new posts are created or shared.
 * 
 * Performance: First load ~30-50 seconds, subsequent loads <1ms from cache
 */

class FeaturedArtistsCache {
  constructor() {
    this.cache = new Map();
    this.TTL = 5 * 60 * 1000; // 5 minutes (shorter than relationships since new posts are frequent)
  }

  /**
   * Generate cache key for featured artists
   * @param {string} timeFilter - 'day', 'week', 'month', 'year', 'all'
   * @returns {string} Cache key
   */
  generateKey(timeFilter) {
    return `featured:${timeFilter}`;
  }

  /**
   * Get cached featured artists
   * @param {string} timeFilter - Time filter type
   * @returns {object|null} Cached data with metadata or null if not found/expired
   */
  get(timeFilter) {
    const key = this.generateKey(timeFilter);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: cached.data,
      expired: false,
      age: age,
      ttlRemaining: this.TTL - age
    };
  }

  /**
   * Store featured artists in cache
   * @param {string} timeFilter - Time filter type
   * @param {array} artists - Featured artists list
   */
  set(timeFilter, artists) {
    const key = this.generateKey(timeFilter);
    
    this.cache.set(key, {
      data: artists,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache when new post is created
   * Clears all time filters since new posts affect all rankings
   */
  invalidateOnNewPost() {
    const filters = ['day', 'week', 'month', 'year', 'all'];
    filters.forEach(filter => {
      const key = this.generateKey(filter);
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }
    });
    console.log(`📦 [CACHE INVALIDATE] Featured artists cache cleared (new post)`);
  }

  /**
   * Invalidate cache when post is shared
   * Clears all time filters
   */
  invalidateOnShare() {
    const filters = ['day', 'week', 'month', 'year', 'all'];
    filters.forEach(filter => {
      const key = this.generateKey(filter);
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }
    });
    console.log(`📦 [CACHE INVALIDATE] Featured artists cache cleared (shared post)`);
  }

  /**
   * Invalidate cache when post is deleted
   */
  invalidateOnDelete() {
    const filters = ['day', 'week', 'month', 'year', 'all'];
    filters.forEach(filter => {
      const key = this.generateKey(filter);
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Clear entire cache (for testing/maintenance)
   */
  clear() {
    this.cache.clear();
    console.log('📦 [CACHE CLEARED] All featured artists caches cleared');
  }

  /**
   * Get cache statistics
   * @returns {object} Cache info
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      entries: Array.from(this.cache.keys()),
      ttl: this.TTL
    };
  }
}

module.exports = new FeaturedArtistsCache();
