require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./backend/models/users');
const Post = require('./backend/models/posts');

async function debugFollowingData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get first 3 users
    const users = await User.find().select('name email following followers').limit(3).lean();
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    console.log('\n=== USER FOLLOWING/FOLLOWERS DATA ===');
    for (const user of users) {
      console.log(`\nUser: ${user.name} (${user.email})`);
      console.log(`  Following count: ${(user.following || []).length}`);
      console.log(`  Followers count: ${(user.followers || []).length}`);
      
      if (user.following && user.following.length > 0) {
        console.log(`  Following IDs: ${user.following.join(', ')}`);
      }
      if (user.followers && user.followers.length > 0) {
        console.log(`  Follower IDs: ${user.followers.join(', ')}`);
      }
    }

    // Check mutual friends
    console.log('\n=== MUTUAL FRIENDS CHECK ===');
    if (users.length > 0) {
      const testUser = users[0];
      console.log(`\nChecking mutual friends for: ${testUser.name}`);
      
      const followingIds = (testUser.following || []).map(id => String(id));
      console.log(`  User is following: ${followingIds.length} people`);
      
      // Find followers
      const followers = await User.find({ following: testUser._id }).select('_id').lean();
      const followerIds = followers.map(f => String(f._id));
      console.log(`  User is followed by: ${followerIds.length} people`);
      
      const mutualIds = followingIds.filter(id => followerIds.includes(id));
      console.log(`  Mutual friends: ${mutualIds.length}`);
      if (mutualIds.length > 0) {
        console.log(`  Mutual friend IDs: ${mutualIds.join(', ')}`);
      }

      // Check posts from mutual friends
      if (mutualIds.length > 0) {
        const mutualPosts = await Post.countDocuments({ userId: { $in: mutualIds } });
        console.log(`  Posts from mutual friends: ${mutualPosts}`);
      }

      // Check posts from all following
      if (followingIds.length > 0) {
        const followingPosts = await Post.countDocuments({ userId: { $in: followingIds } });
        console.log(`  Posts from all following: ${followingPosts}`);
      }
    }

    console.log('\n=== DISCONNECTING ===');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

debugFollowingData();
