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
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function diagnoseCheesecakeUser() {
  console.log('🔍 DIAGNOSING cheesecake0101 USER\n');

  try {
    // Find cheesecake0101
    const user = await User.findOne({ 
      $or: [
        { name: 'cheesecake0101' }, 
        { username: 'cheesecake0101' },
        { email: /cheesecake/i }
      ] 
    });

    if (!user) {
      console.log('❌ User cheesecake0101 not found');
      await mongoose.connection.close();
      return;
    }

    console.log('✓ User found:', user.name || user.username);
    console.log('✓ Interests:', user.interests);
    console.log('✓ User ID:', user._id);

    // Check their posts
    const userPosts = await Post.find({ userId: user._id });
    console.log('\n📝 User\'s own posts: ' + userPosts.length);

    // Check users with matching interests
    const theatreUsers = await User.find({ interests: 'theatre' });
    const dramaUsers = await User.find({ interests: 'drama' });
    const danceUsers = await User.find({ interests: 'dance' });

    console.log('\n🎭 Database statistics:');
    console.log('   Users with theatre interest: ' + theatreUsers.length);
    console.log('   Users with drama interest: ' + dramaUsers.length);
    console.log('   Users with dance interest: ' + danceUsers.length);

    // Check posts from these users
    const theatreUserIds = theatreUsers.map(u => u._id);
    const dramaUserIds = dramaUsers.map(u => u._id);
    const danceUserIds = danceUsers.map(u => u._id);

    const theatrePosts = await Post.find({ userId: { $in: theatreUserIds } });
    const dramaPosts = await Post.find({ userId: { $in: dramaUserIds } });
    const dancePosts = await Post.find({ userId: { $in: danceUserIds } });

    console.log('\n📸 Posts available:');
    console.log('   Posts from theatre users: ' + theatrePosts.length);
    console.log('   Posts from drama users: ' + dramaPosts.length);
    console.log('   Posts from dance users: ' + dancePosts.length);

    // Check for recent posts
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentTheatrePosts = theatrePosts.filter(p => p.createdAt > twoHoursAgo);
    const recentDramaPosts = dramaPosts.filter(p => p.createdAt > twoHoursAgo);
    const recentDancePosts = dancePosts.filter(p => p.createdAt > twoHoursAgo);

    console.log('\n⏰ Recent posts (last 2 hours):');
    console.log('   Recent theatre posts: ' + recentTheatrePosts.length);
    console.log('   Recent drama posts: ' + recentDramaPosts.length);
    console.log('   Recent dance posts: ' + recentDancePosts.length);

    console.log('\n📊 DIAGNOSIS:');
    if (theatreUsers.length === 0 && dramaUsers.length === 0 && danceUsers.length === 0) {
      console.log('   ❌ NO users with theatre/drama/dance interests found');
      console.log('   💡 Solution: Need to seed users with these interests');
    } else if (theatrePosts.length === 0 && dramaPosts.length === 0 && dancePosts.length === 0) {
      console.log('   ❌ Users exist but have NO posts');
      console.log('   💡 Solution: Need to seed posts for these users');
    } else if (recentTheatrePosts.length === 0 && recentDramaPosts.length === 0 && recentDancePosts.length === 0) {
      console.log('   ⚠️  Posts exist but are TOO OLD (older than 2 hours)');
      console.log('   💡 Solution: Need to create recent posts');
    } else {
      console.log('   ✓ Posts exist and are recent');
      console.log('   💡 Check recommendation algorithm for other issues');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => diagnoseCheesecakeUser());
