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
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function checkOriginalMediaUrls() {
  console.log('\n📊 CHECKING ORIGINAL CLOUDINARY URLS\n');
  
  try {
    // Find all seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Find posts from NON-SEED users (old real users)
    const oldPosts = await Post.find({ userId: { $nin: seedUserIds } }).limit(15).lean();
    console.log(`Found ${oldPosts.length} sample posts from old real users\n`);
    console.log('════════════════════════════════════════════════════════════\n');

    for (let i = 0; i < oldPosts.length; i++) {
      const post = oldPosts[i];
      console.log(`Post ${i + 1}: "${post.title || post.desc?.substring(0, 40) || 'Untitled'}"`);
      console.log(`  ID: ${post._id}`);
      console.log(`  Media field RAW VALUE: "${post.media}"`);
      console.log(`  Media field type: ${typeof post.media}`);
      console.log(`  Media starts with http: ${post.media && post.media.startsWith('http') ? 'YES' : 'NO'}`);
      console.log(`  Media is Cloudinary URL: ${post.media && post.media.includes('cloudinary') ? 'YES ✅' : 'NO ❌'}`);
      
      if (post.mediaArray && post.mediaArray.length > 0) {
        console.log(`  MediaArray count: ${post.mediaArray.length}`);
        console.log(`    First URL: ${post.mediaArray[0].url.substring(0, 80)}`);
      } else {
        console.log(`  MediaArray: EMPTY`);
      }
      console.log('');
    }

    console.log('════════════════════════════════════════════════════════════\n');
    
    // Check if ANY old posts have Cloudinary URLs in media field
    const cloudinaryPosts = await Post.find({
      userId: { $nin: seedUserIds },
      media: { $regex: 'cloudinary' }
    }).countDocuments();
    
    const postsWithMediaField = await Post.find({
      userId: { $nin: seedUserIds },
      media: { $exists: true, $ne: null, $ne: '' }
    }).countDocuments();

    console.log(`📊 STATISTICS:`);
    console.log(`  Total old user posts with media field: ${postsWithMediaField}`);
    console.log(`  Posts with Cloudinary URLs: ${cloudinaryPosts}`);
    console.log(`  Posts with broken local paths: ${postsWithMediaField - cloudinaryPosts}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  try {
    await connectDB();
    await checkOriginalMediaUrls();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.\n');
  }
}

main();
