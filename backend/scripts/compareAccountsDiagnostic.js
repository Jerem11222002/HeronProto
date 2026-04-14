/**
 * Comprehensive diagnostic for old accounts vs new accounts
 * Checks interests, following, posts, and recommendation flow
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');

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

async function compareOldVsNewAccounts() {
  console.log('🔍 COMPARING OLD ACCOUNTS VS NEW ACCOUNTS\n');

  try {
    // Old account
    const oldUser = await User.findOne({ name: 'Je' });
    
    // New account (recently created with niche interests)
    const newUser = await User.findOne({ name: 'Alex Chen' });

    if (!oldUser || !newUser) {
      console.log('❌ Could not find both accounts');
      console.log('   Old (Je):', !!oldUser);
      console.log('   New (Alex Chen):', !!newUser);
      return;
    }

    console.log('📊 OLD ACCOUNT (Je - cheesecake0101):');
    console.log('   Interests:', oldUser.interests);
    console.log('   Following count:', oldUser.following?.length || 0);
    console.log('   Followers:', oldUser.followers?.length || 0);
    console.log('   Organizations:', oldUser.organizations?.length || 0);
    console.log('   Interests Selected:', oldUser.interestsSelected);
    console.log('   Account created:', oldUser.createdAt);
    console.log('   Last updated:', oldUser.updatedAt);

    console.log('\n📊 NEW ACCOUNT (Alex Chen - photogrammetry):');
    console.log('   Interests:', newUser.interests);
    console.log('   Following count:', newUser.following?.length || 0);
    console.log('   Followers:', newUser.followers?.length || 0);
    console.log('   Organizations:', newUser.organizations?.length || 0);
    console.log('   Interests Selected:', newUser.interestsSelected);
    console.log('   Account created:', newUser.createdAt);
    console.log('   Last updated:', newUser.updatedAt);

    // Check posts
    const oldUserPosts = await Post.find({ userId: oldUser._id });
    const newUserPosts = await Post.find({ userId: newUser._id });

    console.log('\n📝 POSTS:');
    console.log('   Old account total posts:', oldUserPosts.length);
    console.log('   New account total posts:', newUserPosts.length);

    // Check recent posts (last 7 days - the filter in getRelevantPosts)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldRecentPosts = oldUserPosts.filter(p => p.createdAt >= sevenDaysAgo).length;
    const newRecentPosts = newUserPosts.filter(p => p.createdAt >= sevenDaysAgo).length;

    console.log('   Old account RECENT posts (last 7 days):', oldRecentPosts);
    console.log('   New account RECENT posts (last 7 days):', newRecentPosts);

    // Sample post tags
    if (oldUserPosts.length > 0) {
      console.log('   Old account post tags sample:', oldUserPosts[0].tags);
    }
    if (newUserPosts.length > 0) {
      console.log('   New account post tags sample:', newUserPosts[0].tags);
    }

    // Check if interests match posts
    console.log('\n🎯 INTEREST-TO-POST MATCHING:');
    const oldMatchingPosts = oldUserPosts.filter(p => 
      p.tags && p.tags.some(tag => 
        oldUser.interests?.includes(tag)
      )
    ).length;
    const newMatchingPosts = newUserPosts.filter(p => 
      p.tags && p.tags.some(tag => 
        newUser.interests?.includes(tag)
      )
    ).length;

    console.log('   Old account posts matching interests:', oldMatchingPosts, '/', oldUserPosts.length);
    console.log('   New account posts matching interests:', newMatchingPosts, '/', newUserPosts.length);

    // Check query that getRelevantPosts would use
    console.log('\n⚙️  GETRELEVANTPOSTS QUERY SIMULATION:');
    console.log('   Following count check:');
    console.log('     Old account has following:', oldUser.following?.length || 0, '(need > 0 for personalized)');
    console.log('     New account has following:', newUser.following?.length || 0, '(need > 0 for personalized)');
    
    console.log('   Interests check:');
    console.log('     Old account interests count:', oldUser.interests?.length || 0);
    console.log('     New account interests count:', newUser.interests?.length || 0);

    if ((oldUser.following?.length || 0) === 0 && (oldUser.interests?.length || 0) === 0) {
      console.log('   >>> OLD ACCOUNT: Falls to POPULAR content (no follow + no interests)');
    } else {
      console.log('   >>> OLD ACCOUNT: Gets personalized content');
    }

    if ((newUser.following?.length || 0) === 0 && (newUser.interests?.length || 0) === 0) {
      console.log('   >>> NEW ACCOUNT: Falls to POPULAR content (no follow + no interests)');
    } else {
      console.log('   >>> NEW ACCOUNT: Gets personalized content');
    }

    // Check available posts matching old account's interests
    console.log('\n🔎 AVAILABLE MATCHING POSTS IN DATABASE:');
    const availableForOld = await Post.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      tags: { $in: oldUser.interests || [] },
      visibility: 'public'
    });
    const availableForNew = await Post.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      tags: { $in: newUser.interests || [] },
      visibility: 'public'
    });

    console.log('   Posts matching old account interests (last 7 days):', availableForOld);
    console.log('   Posts matching new account interests (last 7 days):', availableForNew);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => compareOldVsNewAccounts());
