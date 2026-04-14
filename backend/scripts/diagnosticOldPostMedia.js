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

async function diagnosticOldPostMedia() {
  console.log('\n📊 DIAGNOSTIC - OLD POST MEDIA STRUCTURE\n');
  
  try {
    // Find all seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Find posts from NON-SEED users (old users)
    const oldPosts = await Post.find({ userId: { $nin: seedUserIds } }).limit(10).lean();
    console.log(`Found ${oldPosts.length} sample posts from old (non-seed) users\n`);
    console.log('═'.repeat(80));

    for (let i = 0; i < oldPosts.length; i++) {
      const post = oldPosts[i];
      console.log(`\nPost ${i + 1}: "${post.title || post.desc?.substring(0, 40) || 'Untitled'}"`);
      console.log(`  ID: ${post._id}`);
      console.log(`  User ID: ${post.userId}`);
      
      // Check media field
      console.log(`\n  [LEGACY media field]`);
      console.log(`    - Exists: ${post.media ? '✅ YES' : '❌ NO'}`);
      if (post.media) {
        console.log(`    - Value: ${post.media.substring(0, 80)}${post.media.length > 80 ? '...' : ''}`);
        console.log(`    - Type: ${post.media.includes('cloudinary') ? '🌥️ Cloudinary' : post.media.startsWith('http') ? '🔗 HTTP URL' : '📁 Local path'}`);
      }
      
      // Check mediaArray field
      console.log(`\n  [NEW mediaArray field]`);
      console.log(`    - Exists: ${post.mediaArray && post.mediaArray.length > 0 ? '✅ YES' : '❌ NO'}`);
      if (post.mediaArray && post.mediaArray.length > 0) {
        console.log(`    - Count: ${post.mediaArray.length}`);
        for (let j = 0; j < post.mediaArray.length; j++) {
          const m = post.mediaArray[j];
          console.log(`      [${j + 1}] Type: ${m.type}, URL: ${m.url.substring(0, 60)}...`);
        }
      }

      // Check mediaType and mediaCount
      console.log(`\n  [OTHER FIELDS]`);
      console.log(`    - mediaType: ${post.mediaType || 'null'}`);
      console.log(`    - mediaCount: ${post.mediaCount || 0}`);
      console.log(`    - Tags: ${post.tags?.join(', ') || 'none'}`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n📋 SUMMARY');
    console.log('═'.repeat(80));
    
    const withMedia = oldPosts.filter(p => p.media).length;
    const withMediaArray = oldPosts.filter(p => p.mediaArray && p.mediaArray.length > 0).length;
    const withBoth = oldPosts.filter(p => p.media && p.mediaArray && p.mediaArray.length > 0).length;
    const withNeither = oldPosts.filter(p => !p.media && (!p.mediaArray || p.mediaArray.length === 0)).length;

    console.log(`\nOut of ${oldPosts.length} posts sampled:`);
    console.log(`  ✅ Have legacy 'media' field: ${withMedia}`);
    console.log(`  ✅ Have 'mediaArray' field: ${withMediaArray}`);
    console.log(`  ✅ Have BOTH: ${withBoth}`);
    console.log(`  ❌ Have NEITHER: ${withNeither}`);

    if (withNeither > 0) {
      console.log(`\n⚠️  WARNING: ${withNeither} posts have NO media storage at all!`);
      console.log(`   These posts need to be populated with images.\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  try {
    await connectDB();
    await diagnosticOldPostMedia();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.\n');
  }
}

main();
