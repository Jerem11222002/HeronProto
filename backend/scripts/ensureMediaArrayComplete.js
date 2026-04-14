const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';
const PICSUM_BASE = 'https://picsum.photos';

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

function getDeterministicSeedFromPostId(postId, imageIndex = 0) {
  const hexPart = postId.toString().substring(0, 8);
  const baseSeed = parseInt(hexPart, 16) % 10000;
  return baseSeed + (imageIndex * 1000);
}

function generatePicsumUrl(width, height, seed) {
  return `${PICSUM_BASE}/${width}/${height}.jpg?random=${seed}`;
}

async function ensureAllOldPostsHaveMediaArray() {
  console.log('🔧 ENSURING ALL OLD POSTS HAVE MEDIAARRAY\n');
  
  try {
    // Find all seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Find ALL posts from non-seed users (old users)
    const oldPosts = await Post.find({ userId: { $nin: seedUserIds } });
    console.log(`Total old posts from non-seed users: ${oldPosts.length}\n`);

    let stats = {
      alreadyHasMediaArray: 0,
      needsMediaArray: 0,
      generated: 0,
      migratedCloudinary: 0,
      failed: 0
    };

    for (const post of oldPosts) {
      try {
        // Check if already has mediaArray with content
        if (post.mediaArray && post.mediaArray.length > 0) {
          stats.alreadyHasMediaArray++;
          continue;
        }

        stats.needsMediaArray++;

        // If post has legacy Cloudinary URL, migrate it
        if (post.media && (post.media.includes('cloudinary') || post.media.startsWith('http'))) {
          const mediaArray = [{
            url: post.media,
            type: 'image',
            size: 0,
            duration: 0,
            thumbnail: post.media
          }];
          
          post.mediaArray = mediaArray;
          post.mediaCount = 1;
          await post.save();
          stats.migratedCloudinary++;
          continue;
        }

        // For posts with untagged content or no media, generate Picsum URLs
        const postTitle = post.title || post.desc?.substring(0, 40) || 'Untitled';
        
        // Determine number of images (varied by post ID hash)
        const numImages = (post._id.getTimestamp().getTime() % 3) + 1;
        const mediaArray = [];

        for (let i = 0; i < numImages; i++) {
          const seed = getDeterministicSeedFromPostId(post._id, i);
          const imageUrl = generatePicsumUrl(600, 400, seed);
          
          mediaArray.push({
            url: imageUrl,
            type: 'image',
            size: Math.floor(Math.random() * 500000) + 100000,
            duration: 0,
            thumbnail: imageUrl
          });
        }

        post.mediaArray = mediaArray;
        post.mediaCount = mediaArray.length;
        await post.save();
        stats.generated++;

        console.log(`  ✓ Post "${postTitle.substring(0, 30).padEnd(30)}" → Generated ${numImages} image(s)`);

      } catch (error) {
        console.error(`  ✗ Error updating post ${post._id}: ${error.message}`);
        stats.failed++;
      }
    }

    console.log(`\n📊 RESULTS:`);
    console.log(`  ✓ Already had mediaArray: ${stats.alreadyHasMediaArray}`);
    console.log(`  ✓ Posts needing mediaArray: ${stats.needsMediaArray}`);
    console.log(`    ├─ Generated Picsum URLs: ${stats.generated}`);
    console.log(`    ├─ Migrated Cloudinary URLs: ${stats.migratedCloudinary}`);
    console.log(`    └─ Failed: ${stats.failed}`);
    
    if (stats.generated + stats.migratedCloudinary > 0) {
      console.log(`\n✅ Successfully restored media for ${stats.generated + stats.migratedCloudinary} posts!`);
      console.log(`\n🔄 Next step: Clear browser cache and refresh the page to see images`);
    } else {
      console.log(`\n✅ All ${oldPosts.length} old posts already have mediaArray`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

connectDB().then(() => ensureAllOldPostsHaveMediaArray());
