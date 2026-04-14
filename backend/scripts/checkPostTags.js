const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');
const User = require('../models/users');

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

async function checkPostTags() {
  console.log('🏷️  CHECKING POST TAGS AND RECOMMENDATION LOGIC\n');

  try {
    // Get recent posts
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentPosts = await Post.find({
      createdAt: { $gt: twoHoursAgo }
    }).limit(10);

    console.log('Sample recent posts tags:');
    recentPosts.slice(0, 5).forEach((p, i) => {
      console.log(`  Post ${i + 1}: tags = [${p.tags?.join(', ') || 'NONE'}]`);
    });

    // Get user interests
    const user = await User.findOne({ name: 'Je' });
    console.log(`\n👤 User Je interests: [${user?.interests?.join(', ') || 'NONE'}]`);

    // Check if post tags match user interests
    console.log('\n🔍 Interest matching test:');
    const userInterests = user?.interests || [];
    
    recentPosts.slice(0, 5).forEach((p, i) => {
      const postTags = p.tags || [];
      const matchingTags = postTags.filter(tag => 
        userInterests.some(interest => 
          tag.toLowerCase() === interest.toLowerCase()
        )
      );
      console.log(`  Post ${i + 1}: Matching tags: [${matchingTags.join(', ')}]`);
    });

    // Check tag data types
    console.log('\n📋 Tag data types in sample posts:');
    recentPosts.slice(0, 3).forEach((p, i) => {
      console.log(`  Post ${i + 1}: tags type = ${Array.isArray(p.tags) ? 'Array' : typeof p.tags}`);
      if (p.tags && p.tags[0]) {
        console.log(`           first tag = "${p.tags[0]}" (type: ${typeof p.tags[0]})`);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => checkPostTags());
