/**
 * Simple feed test without debug logs
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Suppress recommendation debug logs
process.env.NODE_ENV = 'production';

const User = require('../models/users');
const Post = require('../models/posts');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function simpleTest() {
  console.log('🧪 FEED TEST\n');

  try {
    const user = await User.findOne({ name: 'Je' }).lean();
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User: Je');
    console.log('   Following:', user.following?.length || 0);

    // Test 1: Check posts from following users
    const followingIds = (user.following || []).map(id => 
      typeof id === 'object' && id._id ? String(id._id) : String(id)
    );

    const totalFromFollowing = await Post.countDocuments({
      userId: { $in: followingIds }
    });

    const sharedFromFollowing = await Post.countDocuments({
      userId: { $in: followingIds },
      sharedPost: { $exists: true, $ne: null }
    });

    console.log('\n📧 FOLLOWING FEED (shared posts only):');
    console.log('   Total posts from following:', totalFromFollowing);
    console.log('   Shared posts from following:', sharedFromFollowing);
    console.log('   → Following tab will show:', sharedFromFollowing, 'items');

    // Test 2: Get My Feed using getHybridFeed
    const { RecommendationService } = require('../services/recommendations');
    const hybridFeed = await RecommendationService.getHybridFeed(user._id, {
      limit: 50,
      eventRatio: 0.15
    });

    console.log('\n🎨 MY FEED (before filtering):');
    console.log('   Total items from getHybridFeed:', hybridFeed.items?.length || 0);

    // Count items that would be filtered out
    const followingSet = new Set(followingIds);
    const filtered = (hybridFeed.items || []).filter(item => {
      if (item.type === 'event') return true;
      return !followingSet.has(String(item.userId)) && !item.sharedPost;
    });

    console.log('   After filtering (exclude following + shared):', filtered.length);
    console.log('   → My Feed tab will show:', filtered.length, 'items');

    if (filtered.length > 0) {
      console.log('   Sample item:', {
        type: filtered[0].type,
        score: filtered[0].finalScore
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => simpleTest());
