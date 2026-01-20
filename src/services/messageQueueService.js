// src/services/messageQueueService.js

/**
 * Manages offline message queue
 * Stores messages locally when offline and syncs when online
 */

const MESSAGE_QUEUE_KEY = 'heron_message_queue';

export const messageQueueService = {
  /**
   * Add message to queue
   */
  addToQueue(conversationId, text, recipientId) {
    const queue = this.getQueue();
    const message = {
      id: Date.now().toString(),
      conversationId,
      text,
      recipientId,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    queue.push(message);
    localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(queue));
    return message;
  },

  /**
   * Get all queued messages
   */
  getQueue() {
    try {
      const queue = localStorage.getItem(MESSAGE_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  },

  /**
   * Get messages for a specific conversation
   */
  getConversationQueue(conversationId) {
    return this.getQueue().filter(msg => msg.conversationId === conversationId);
  },

  /**
   * Mark message as sent
   */
  markAsSent(messageId) {
    const queue = this.getQueue();
    const updated = queue.map(msg =>
      msg.id === messageId ? { ...msg, status: 'sent' } : msg
    );
    localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(updated));
  },

  /**
   * Remove message from queue
   */
  removeFromQueue(messageId) {
    const queue = this.getQueue().filter(msg => msg.id !== messageId);
    localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(queue));
  },

  /**
   * Clear all queued messages
   */
  clearQueue() {
    localStorage.removeItem(MESSAGE_QUEUE_KEY);
  },

  /**
   * Get queue size
   */
  getQueueSize() {
    return this.getQueue().length;
  },
};

export default messageQueueService;
