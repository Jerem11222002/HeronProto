/**
 * Test Setup Utilities
 * Connects to actual MongoDB and provides helper functions
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');
const Event = require('../models/event');
const User = require('../models/users');

/**
 * Connect to MongoDB using existing connection or create new
 */
async function connectDB() {
  // Reuse existing connection if available
  if (mongoose.connection.readyState === 1) {
    console.log('✅ Using existing MongoDB connection');
    return;
  }

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/heron';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

/**
 * Get sample users from database
 */
async function getSampleUsers(limit = 10) {
  try {
    const users = await User.find()
      .select('_id name interests organizations following contentPreferences viewedPosts')
      .limit(limit)
      .lean();

    console.log(`📊 Found ${users.length} users in database`);
    return users;
  } catch (error) {
    console.error('Error fetching sample users:', error.message);
    return [];
  }
}

/**
 * Get user by ID with full profile
 */
async function getUserProfile(userId) {
  try {
    const user = await User.findById(userId)
      .select('name interests organizations following contentPreferences implicitPreferences')
      .lean();

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Normalize user data
    user.interests = user.interests || [];
    user.organizations = user.organizations || [];
    user.following = user.following || [];
    user.contentPreferences = user.contentPreferences || {
      viewedPosts: [],
      likedPosts: [],
      sharedPosts: []
    };

    return user;
  } catch (error) {
    console.error('Error fetching user profile:', error.message);
    throw error;
  }
}

/**
 * Get all posts and events from database
 */
async function getAllContent() {
  try {
    const [posts, events] = await Promise.all([
      Post.find({ visibility: 'public' })
        .select('_id title desc tags organization userId likes engagementMetrics createdAt mediaType contentType')
        .lean(),
      Event.find({ status: { $in: ['upcoming', 'ongoing'] }, visibility: { $in: ['public', 'organization-only'] } })
        .select('_id title description tags organization date status engagementMetrics interested registrations')
        .lean()
    ]);

    console.log(`📚 Found ${posts.length} posts and ${events.length} events`);

    // Add type field for tracking
    const allContent = [
      ...posts.map(p => ({ ...p, type: 'post' })),
      ...events.map(e => ({ ...e, type: 'event' }))
    ];

    return { posts, events, all: allContent };
  } catch (error) {
    console.error('Error fetching content:', error.message);
    return { posts: [], events: [], all: [] };
  }
}

/**
 * Calculate user engagement for recommendations
 */
async function getUserEngagementData(userId) {
  try {
    const user = await User.findById(userId)
      .select('contentPreferences _id')
      .lean();

    if (!user) return null;

    // Get liked posts and interested events
    const likedPosts = user.contentPreferences?.likedPosts || [];
    const viewedPosts = user.contentPreferences?.viewedPosts || [];

    const [interestedEvents, likedPostDetails] = await Promise.all([
      Event.find({ 'interested.user': userId })
        .select('_id title tags organization')
        .lean(),
      Post.find({ _id: { $in: likedPosts } })
        .select('_id title tags organization')
        .lean()
    ]);

    return {
      userId,
      interestedEvents,
      likedPostDetails,
      engagementMetrics: {
        viewedCount: viewedPosts.length,
        likedCount: likedPostDetails.length,
        interestedInEventsCount: interestedEvents.length
      }
    };
  } catch (error) {
    console.error('Error fetching engagement data:', error.message);
    return null;
  }
}

/**
 * Identify relevant items for a user based on their interests
 */
function identifyRelevantItems(user, items) {
  if (!user.interests || user.interests.length === 0) {
    return items.slice(0, 5); // Return some items if no interests
  }

  const userInterests = new Set(user.interests.map(i => i.toLowerCase()));

  return items.filter(item => {
    // Tag matching
    const tagMatch = (item.tags || []).some(tag =>
      userInterests.has(tag.toLowerCase())
    );

    // Organization matching
    const orgMatch = item.organization && user.organizations?.includes(item.organization);

    // Following-based for posts
    const followingMatch = item.type === 'post' && user.following?.some(
      f => f.toString() === item.userId?.toString()
    );

    return tagMatch || orgMatch || followingMatch;
  });
}

/**
 * Get a comprehensive test report object
 */
function createTestReport() {
  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.MONGO_URI || 'mongodb://localhost:27017/heron',
    tests: [],
    summary: {
      totalUsers: 0,
      totalPosts: 0,
      totalEvents: 0,
      avgPrecision: 0,
      avgRecall: 0,
      avgNDCG: 0,
      passedTests: 0,
      failedTests: 0
    }
  };
}

module.exports = {
  connectDB,
  disconnectDB,
  getSampleUsers,
  getUserProfile,
  getAllContent,
  getUserEngagementData,
  identifyRelevantItems,
  createTestReport,
  models: {
    Post,
    Event,
    User
  }
};
