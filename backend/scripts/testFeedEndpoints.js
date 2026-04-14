/**
 * Test /feed endpoint logic directly
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const { RecommendationService } = require('../services/recommendations');

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

async function testFeedEndpoints() {
  console.log('🧪 TESTING /FEED ENDPOINT LOGIC\n');

  try {
    // Get old user
    const user = await User.findOne({ name: 'Je' })
      .select('_id interests implicitPreferences following followers friends organizations interestsSelected interestsSkipped contentPreferences')
      .lean();

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 Testing for user: Je');
    console.log('   Following:', user.following?.length || 0);
    console.log('   Followers:', user.followers?.length || 0);

    // Test My Feed
    console.log('\n📌 Testing getMyFeed()...');
    try {
      const myFeed = await RecommendationService.getMyFeed(user, {
        sortBy: 'hybrid',
        page: 1,
        limit: 20,
        maxPostsPerUser: 3
      });
      console.log('   ✓ My Feed returned');
      console.log('   Items:', myFeed.items?.length || 0);
      console.log('   Total count:', myFeed.pagination?.totalCount || 0);
      if (myFeed.items?.length > 0) {
        console.log('   Sample item:', {
          type: myFeed.items[0].type,
          title: myFeed.items[0].title || myFeed.items[0].desc?.substring(0, 30),
          score: myFeed.items[0].finalScore
        });
      }
    } catch (err) {
      console.log('   ❌ Error:', err.message);
    }

    // Test Friends Feed
    console.log('\n📌 Testing getFriendsFeed()...');
    try {
      const friendsFeed = await RecommendationService.getFriendsFeed(user, {
        page: 1,
        limit: 20,
        maxPostsPerUser: 3
      });
      console.log('   ✓ Friends Feed returned');
      console.log('   Items:', friendsFeed.items?.length || 0);
      if (friendsFeed.items?.length > 0) {
        console.log('   Sample item:', {
          type: friendsFeed.items[0].type,
          title: friendsFeed.items[0].title,
          sharedPost: !!friendsFeed.items[0].sharedPost
        });
      } else {
        console.log('   (Empty - only shows shared posts from mutual friends)');
      }
    } catch (err) {
      console.log('   ❌ Error:', err.message);
    }

    // Test Following Feed
    console.log('\n📌 Testing getFollowingFeed()...');
    try {
      const followingFeed = await RecommendationService.getFollowingFeed(user, {
        page: 1,
        limit: 20,
        maxPostsPerUser: 3
      });
      console.log('   ✓ Following Feed returned');
      console.log('   Items:', followingFeed.items?.length || 0);
      if (followingFeed.items?.length > 0) {
        console.log('   Sample item:', {
          type: followingFeed.items[0].type,
          title: followingFeed.items[0].title,
          sharedPost: !!followingFeed.items[0].sharedPost
        });
      } else {
        console.log('   (Empty - only shows shared posts from following users)');
      }
    } catch (err) {
      console.log('   ❌ Error:', err.message);
    }

    console.log('\n📊 SUMMARY:');
    console.log('  Friend Tab: Shows shared posts from mutual friends');
    console.log('  Following Tab: Shows shared posts from followed users');
    console.log('  My Feed Tab: Shows algorithm-recommended personalized content');
    console.log('  → If Friend & Following are empty: No shared posts from those users');
    console.log('  → If My Feed is empty: No recommended personalized content found');

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => testFeedEndpoints());
