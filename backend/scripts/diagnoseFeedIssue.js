/**
 * Diagnose feed issues for old account
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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

async function diagnoseFeed() {
  console.log('🔍 DIAGNOSING FEED ISSUES\n');

  try {
    // Get old user
    const user = await User.findOne({ name: 'Je' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 USER (Je):');
    console.log('   Following IDs:', user.following?.length || 0);
    console.log('   Following array:', user.following?.slice(0, 3), '...');
    console.log('   Followers:', user.followers?.length || 0);

    // Get following user IDs
    const followingIds = (user.following || []).map(id =>
      typeof id === 'object' && id._id ? String(id._id) : String(id)
    );

    console.log('\n📝 FOLLOWING POSTS QUERY:');
    console.log('   Looking for posts from', followingIds.length, 'following users');

    // Test the query that feed would use
    const followingPosts = await Post.find({
      userId: { $in: followingIds }
    }).select('_id userId desc createdAt tags').lean();

    console.log('   Posts found from following:', followingPosts.length);

    if (followingPosts.length > 0) {
      console.log('   Sample following post:');
      console.log('     User:', followingPosts[0].userId);
      console.log('     Tags:', followingPosts[0].tags);
    }

    // Check if following users exist and have posts
    console.log('\n👥 FOLLOWING USERS CHECK:');
    const followingUsers = await User.find({ _id: { $in: followingIds } }).lean();
    console.log('   Following users found in DB:', followingUsers.length);

    for (let i = 0; i < Math.min(3, followingUsers.length); i++) {
      const fUser = followingUsers[i];
      const userPosts = await Post.countDocuments({ userId: fUser._id });
      console.log(`   - ${fUser.name}: ${userPosts} posts`);
    }

    // Check recent posts from following (what feed query would typically filter)
    console.log('\n⏰ RECENT FOLLOWING POSTS (Last 7 days):');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFollowingPosts = await Post.find({
      userId: { $in: followingIds },
      createdAt: { $gte: sevenDaysAgo }
    }).lean();

    console.log('   Recent posts:', recentFollowingPosts.length);

    // Check user's own posts
    console.log('\n📝 USER OWN POSTS:');
    const userPosts = await Post.find({ userId: user._id }).select('_id createdAt tags').lean();
    console.log('   Total posts:', userPosts.length);
    
    const recentUserPosts = userPosts.filter(p => p.createdAt >= sevenDaysAgo).length;
    console.log('   Recent posts (7 days):', recentUserPosts);

    console.log('\n📊 SUMMARY:');
    console.log('   ✓ User has', followingIds.length, 'following');
    console.log('   ✓ Posts from following:', followingPosts.length);
    console.log('   ✓ Recent posts (7 days):', recentFollowingPosts.length);
    console.log('   ✓ User has', userPosts.length, 'posts');

    if (followingPosts.length === 0) {
      console.log('\n   ❌ ISSUE: No posts from following users');
      console.log('   Possible causes:');
      console.log('      - Following IDs are object IDs but need string conversion');
      console.log('      - Following list contains invalid user IDs');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => diagnoseFeed());
