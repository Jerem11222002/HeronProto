/**
 * Message Cache Service
 * Caches conversation messages and conversation lists
 * TTL: 30 seconds (shorter due to real-time chat nature)
 */

class MessageCache {
  constructor() {
    this.cache = {};
  }

  /**
   * Get cached messages for a conversation
   * @param {string} conversationId
   * @returns {object|null} { data, expired }
   */
  get(conversationId) {
    const key = `messages:${conversationId}`;
    if (!this.cache[key]) return null;

    const cached = this.cache[key];
    const now = Date.now();
    const age = now - cached.timestamp;

    // Expire after 30 seconds for real-time messaging
    if (age > 30000) {
      delete this.cache[key];
      return null;
    }

    return {
      data: cached.data,
      expired: false,
      age: age,
      expiresAt: cached.expiresAt
    };
  }

  /**
   * Store messages in cache
   * @param {string} conversationId
   * @param {array} messages
   * @param {number} totalCount - Total number of messages (for pagination metadata)
   */
  set(conversationId, messages, totalCount = null) {
    const key = `messages:${conversationId}`;
    const now = Date.now();
    
    this.cache[key] = {
      data: messages,
      totalCount: totalCount || messages.length,
      timestamp: now,
      expiresAt: now + 30000
    };

    console.log(`💾 [CACHE SET] Messages for conversation ${conversationId} (${messages.length} messages, total: ${totalCount || messages.length})`);
  }

  /**
   * Invalidate messages for a conversation
   * @param {string} conversationId
   */
  invalidate(conversationId) {
    const key = `messages:${conversationId}`;
    if (this.cache[key]) {
      delete this.cache[key];
      console.log(`🔄 [CACHE INVALIDATE] Messages for conversation ${conversationId}`);
    }
  }

  /**
   * Invalidate all conversations list
   */
  invalidateConversations() {
    const conversationKeys = Object.keys(this.cache).filter(k => k.startsWith('conversations:'));
    conversationKeys.forEach(key => delete this.cache[key]);
    
    if (conversationKeys.length > 0) {
      console.log(`🔄 [CACHE INVALIDATE] All conversations (${conversationKeys.length} caches cleared)`);
    }
  }

  /**
   * Cache for conversations list
   * @param {string} userId
   * @returns {object|null}
   */
  getConversations(userId) {
    const key = `conversations:${userId}`;
    if (!this.cache[key]) return null;

    const cached = this.cache[key];
    const now = Date.now();
    const age = now - cached.timestamp;

    // Expire after 1 minute
    if (age > 60000) {
      delete this.cache[key];
      return null;
    }

    return {
      data: cached.data,
      expired: false,
      age: age,
      expiresAt: cached.expiresAt
    };
  }

  /**
   * Store conversations in cache
   * @param {string} userId
   * @param {array} conversations
   */
  setConversations(userId, conversations) {
    const key = `conversations:${userId}`;
    const now = Date.now();
    
    this.cache[key] = {
      data: conversations,
      timestamp: now,
      expiresAt: now + 60000
    };

    console.log(`💾 [CACHE SET] Conversations for user ${userId} (${conversations.length} conversations)`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const keys = Object.keys(this.cache);
    const messageKeys = keys.filter(k => k.startsWith('messages:'));
    const conversationKeys = keys.filter(k => k.startsWith('conversations:'));

    return {
      totalCached: keys.length,
      messageCaches: messageKeys.length,
      conversationCaches: conversationKeys.length,
      keys: keys
    };
  }

  /**
   * Clear all cache
   */
  clear() {
    const count = Object.keys(this.cache).length;
    this.cache = {};
    console.log(`🧹 [CACHE CLEAR] Cleared ${count} cache entries`);
  }
}

module.exports = new MessageCache();
