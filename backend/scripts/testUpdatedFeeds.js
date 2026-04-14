/**
 * Test updated feed methods
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'production';

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

async function testUpdatedFeeds() {
  console.log('✅ TESTING UPDATED FEEDS\n');

  try {
    const user = await User.findOne({ name: 'Je' })
      .select('_id interests implicitPreferences following followers friends organizations interestsSelected interestsSkipped contentPreferences')
      .lean();

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User: Je\n');

    // Test Following Feed
    console.log('📧 FOLLOWING FEED:');
    const followingFeed = await RecommendationService.getFollowingFeed(user, {
      page: 1,
      limit: 20
    });
    console.log('   Items returned:', followingFeed.items?.length || 0);
    console.log('   Total available:', followingFeed.pagination?.totalCount || 0);
    if (followingFeed.items?.length > 0) {
      console.log('   ✓ Following posts now show! Sample:');
      console.log('     - Type:', followingFeed.items[0].type);
      console.log('     - Title:', (followingFeed.items[0].title || followingFeed.items[0].desc)?.substring(0, 40) + '...');
    }

    // Test Friends Feed  
    console.log('\n👫 FRIENDS FEED:');
    const friendsFeed = await RecommendationService.getFriendsFeed(user, {
      page: 1,
      limit: 20
    });
    console.log('   Items returned:', friendsFeed.items?.length || 0);
    console.log('   Total available:', friendsFeed.pagination?.totalCount || 0);
    if (friendsFeed.items?.length > 0) {
      console.log('   ✓ Friend posts now show! Sample:');
      console.log('     - Type:', friendsFeed.items[0].type);
      console.log('     - Title:', (friendsFeed.items[0].title || friendsFeed.items[0].desc)?.substring(0, 40) + '...');
    }

    // Test My Feed
    console.log('\n🎨 MY FEED:');
    const myFeed = await RecommendationService.getMyFeed(user, {
      page: 1,
      limit: 20,
      eventRatio: 0.15
    });
    console.log('   Items returned:', myFeed.items?.length || 0);
    console.log('   Total available:', myFeed.pagination?.totalCount || 0);
    if (myFeed.items?.length > 0) {
      console.log('   ✓ My Feed items:');
      for (let i = 0; i < Math.min(3, myFeed.items.length); i++) {
        console.log(`     ${i+1}. Type: ${myFeed.items[i].type}, Score: ${myFeed.items[i].finalScore?.toFixed(2)}`);
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log('   ✓ Following tab now shows:', followingFeed.pagination?.totalCount || 0, 'posts');
    console.log('   ✓ Friends tab now shows:', friendsFeed.pagination?.totalCount || 0, 'posts');
    console.log('   ✓ My Feed now shows:', myFeed.pagination?.totalCount || 0, 'items');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => testUpdatedFeeds());
