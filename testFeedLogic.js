require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./backend/models/users');
const Post = require('./backend/models/posts');

async function testFeedWithDirectLogic() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get the first user with following data
    const testUser = await User.findOne().select('name email following followers _id').lean();
    
    if (!testUser) {
      console.log('❌ No users found');
      return;
    }

    console.log(`\n=== TESTING FEED ENDPOINTS FOR USER: ${testUser.name} ===`);
    console.log(`User ID: ${testUser._id}`);

    // Test 1: getFriendsFeed logic
    console.log('\n--- TEST 1: FRIENDS FEED LOGIC ---');
    const followingIds = (testUser.following || []).map(id =>
      typeof id === 'object' && id._id ? String(id._id) : String(id)
    );
    
    const followersDocs = await User.find({ following: testUser._id }).select('_id').lean();
    const followerIds = (followersDocs || []).map(d => String(d._id));
    
    const mutualIds = followingIds.filter(id => followerIds.includes(id));
    
    console.log(`Following: ${followingIds.length}`);
    console.log(`Followers: ${followerIds.length}`);
    console.log(`Mutual: ${mutualIds.length}`);
    
    if (mutualIds.length === 0) {
      console.log(`❌ No mutual friends - getFriendsFeed will return empty`);
    } else {
      const friendsPosts = await Post.find({ userId: { $in: mutualIds } })
        .select('_id userId title createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      
      console.log(`✅ Found ${friendsPosts.length} posts from mutual friends`);
      friendsPosts.forEach(p => {
        console.log(`   - Post ${p._id} by user ${p.userId} on ${p.createdAt}`);
      });
    }

    // Test 2: getFollowingFeed logic
    console.log('\n--- TEST 2: FOLLOWING FEED LOGIC ---');
    const followingPostCount = await Post.countDocuments({ userId: { $in: followingIds } });
    
    console.log(`Following: ${followingIds.length} users`);
    if (followingIds.length === 0) {
      console.log(`❌ Not following anyone - getFollowingFeed will return empty`);
    } else {
      console.log(`✅ Following feeds available - ${followingPostCount} posts found`);
      
      const followingPosts = await Post.find({ userId: { $in: followingIds } })
        .select('_id userId title createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      
      console.log(`Sample posts:`);
      followingPosts.forEach(p => {
        console.log(`   - Post ${p._id} by user ${p.userId} on ${p.createdAt}`);
      });
    }

    // Test 3: getMyFeed logic (optional)
    console.log('\n--- TEST 3: MY FEED LOGIC (REFERENCE) ---');
    console.log('Checking if user has interests set...');
    const userWithInterests = await User.findById(testUser._id)
      .select('interests implicitPreferences')
      .lean();
    
    if (!userWithInterests.interests || userWithInterests.interests.length === 0) {
      console.log('⚠️  User has no interests set - may get default feed');
    } else {
      console.log(`✅ User has ${userWithInterests.interests.length} interests`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testFeedWithDirectLogic();
