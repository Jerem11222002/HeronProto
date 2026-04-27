/**
 * Ensures critical indexes exist on MongoDB collections
 * This dramatically improves query performance and reduces connection pool strain
 * 
 * Problem: Without indexes, queries scan entire collections, holding connections
 * until complete. With proper indexes, queries return quickly, freeing connections.
 */

const Notification = require('../models/notification');
const Message = require('../models/message');
const Conversation = require('../models/conversation');
const User = require('../models/users');

async function ensureIndexes() {
  try {
    console.log('🔍 Creating critical indexes...');

    // NOTIFICATIONS INDEXES
    // Get notifications for a user (primary query in /api/notifications)
    await Notification.collection.createIndex({ userId: 1, createdAt: -1 });
    console.log('✅ Created index: Notification (userId, createdAt)');

    // Count unread notifications quickly
    await Notification.collection.createIndex({ userId: 1, read: 1 });
    console.log('✅ Created index: Notification (userId, read)');

    // MESSAGES INDEXES
    // Get messages for a conversation (primary query)
    await Message.collection.createIndex({ conversationId: 1, createdAt: 1 });
    console.log('✅ Created index: Message (conversationId, createdAt)');

    // Find messages sent by a user
    await Message.collection.createIndex({ sender: 1, createdAt: -1 });
    console.log('✅ Created index: Message (sender, createdAt)');

    // CONVERSATION INDEXES
    // Get conversations for a user (heavy query for messages endpoint)
    await Conversation.collection.createIndex({ participants: 1, updatedAt: -1 });
    console.log('✅ Created index: Conversation (participants, updatedAt)');

    // USER INDEXES (if not already present)
    // Profile lookups in $lookup stages
    await User.collection.createIndex({ _id: 1 });
    console.log('✅ Verified index: User (_id)');

    console.log('✨ All critical indexes created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    // Don't fail - indexes might already exist or be in progress
    return false;
  }
}

// Run indexes on startup after DB connection
async function initializeIndexes() {
  try {
    const db = require('../config/db'); // Ensure DB is connected first
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for connection
    await ensureIndexes();
  } catch (error) {
    console.error('Error initializing indexes:', error.message);
  }
}

module.exports = { ensureIndexes, initializeIndexes };
