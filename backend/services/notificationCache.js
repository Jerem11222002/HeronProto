/**
 * Notification Cache Service
 * 
 * Provides in-memory caching for user notifications with TTL-based expiration.
 * Automatically invalidates when new notifications are created.
 * 
 * Performance: First load ~35-40 seconds, subsequent loads <1ms from cache
 */

class NotificationCache {
  constructor() {
    this.cache = new Map();
    this.TTL = 1 * 60 * 1000; // 1 minute (shorter than relationships since notifications change frequently)
  }

  /**
   * Generate cache key for a user's notifications
   * @param {string} userId - MongoDB user ID
   * @returns {string} Cache key
   */
  generateKey(userId) {
    return `notif:${userId}`;
  }

  /**
   * Get cached notifications for a user
   * @param {string} userId - MongoDB user ID
   * @returns {object|null} Cached data with metadata or null if not found/expired
   */
  get(userId) {
    const key = this.generateKey(userId);
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
   * Store notifications in cache
   * @param {string} userId - MongoDB user ID
   * @param {array} notifications - Full list of notifications
   * @param {number} totalCount - Total notification count for pagination
   * @param {number} unreadCount - Count of unread notifications
   */
  set(userId, notifications, totalCount, unreadCount) {
    const key = this.generateKey(userId);
    
    this.cache.set(key, {
      data: {
        notifications,
        totalCount,
        unreadCount
      },
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache when a new notification is created
   * @param {string} userId - Recipient user ID
   */
  invalidateOnNewNotification(userId) {
    const key = this.generateKey(userId);
    if (this.cache.has(key)) {
      this.cache.delete(key);
      console.log(`📦 [CACHE INVALIDATE] Notification cache cleared for user ${userId}`);
    }
  }

  /**
   * Invalidate when notification is marked as read
   * @param {string} userId - User ID
   */
  invalidateOnRead(userId) {
    const key = this.generateKey(userId);
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
  }

  /**
   * Invalidate all notifications cache for a user
   * @param {string} userId - User ID
   */
  invalidate(userId) {
    const key = this.generateKey(userId);
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
  }

  /**
   * Clear entire cache (for testing/maintenance)
   */
  clear() {
    this.cache.clear();
    console.log('📦 [CACHE CLEARED] All notification caches cleared');
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

module.exports = new NotificationCache();
