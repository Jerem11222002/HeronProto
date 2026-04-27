/**
 * Relationship Cache Service
 * 
 * Caches user followers/following lists to prevent repeated expensive queries.
 * Automatically invalidates on relationship changes (follow/unfollow).
 * 
 * Performance Impact:
 * - First load: ~30-40 seconds (database query)
 * - Subsequent loads: <5 milliseconds (cache hit)
 * - Cache TTL: 1 hour or until follow/unfollow event
 */

class RelationshipCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  /**
   * Generate cache key for user relationships
   */
  generateKey(userId, type) {
    // type: 'followers', 'following', 'both'
    return `rel:${userId}:${type}`;
  }

  /**
   * Get cached relationships
   * @returns {Object|null} Cached data or null if expired/missing
   */
  get(userId, type = 'both') {
    const key = this.generateKey(userId, type);
    
    if (!this.cache.has(key)) {
      return null;
    }

    // Check if cache expired
    const timestamp = this.timestamps.get(key);
    const now = Date.now();
    const age = now - timestamp;

    if (age > this.CACHE_TTL) {
      // Cache expired - remove it
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }

    return {
      data: this.cache.get(key),
      age: age,
      expired: false
    };
  }

  /**
   * Set cache for relationships
   * @param {string} userId - User ID to cache
   * @param {string} type - 'followers', 'following', or 'both'
   * @param {Object} data - The relationship data to cache
   */
  set(userId, type, data) {
    const key = this.generateKey(userId, type);
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now());
  }

  /**
   * Invalidate cache for a user when they follow/unfollow
   * @param {string} userId - User who made the change
   * @param {string} targetUserId - User being followed/unfollowed
   */
  invalidateOnChange(userId, targetUserId) {
    // Invalidate both users' caches since relationships changed
    this.cache.delete(this.generateKey(userId, 'both'));
    this.cache.delete(this.generateKey(userId, 'following'));
    this.cache.delete(this.generateKey(targetUserId, 'both'));
    this.cache.delete(this.generateKey(targetUserId, 'followers'));
    
    this.timestamps.delete(this.generateKey(userId, 'both'));
    this.timestamps.delete(this.generateKey(userId, 'following'));
    this.timestamps.delete(this.generateKey(targetUserId, 'both'));
    this.timestamps.delete(this.generateKey(targetUserId, 'followers'));
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      entries: Array.from(this.cache.keys()),
      ttl: this.CACHE_TTL
    };
  }
}

// Export singleton instance
module.exports = new RelationshipCache();
