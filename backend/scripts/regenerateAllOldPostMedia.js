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

async function regenerateAllOldPostMedia() {
  console.log('🔄 REGENERATING ALL OLD POST MEDIA WITH FRESH PICSUM URLS\n');
  
  try {
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Get ALL posts from non-seed users (old users)
    const oldPosts = await Post.find({ userId: { $nin: seedUserIds } });
    console.log(`Found ${oldPosts.length} old posts to regenerate\n`);

    let updated = 0;
    let failed = 0;

    for (const post of oldPosts) {
      try {
        const postTitle = post.title || post.desc?.substring(0, 50) || 'Untitled';
        
        // Generate fresh mediaArray with deterministic seeds (same image every load)
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

        // UPDATE: Replace ALL media fields with fresh mediaArray
        // This wipes out the old broken "400.jpg" references completely
        post.mediaArray = mediaArray;
        post.mediaCount = mediaArray.length;
        post.media = null;  // Clear broken reference
        post.img = null;    // Clear old img field
        
        await post.save();

        console.log(`  ✓ "${postTitle.substring(0, 40).padEnd(40)}" → ${numImages} fresh Picsum image(s)`);
        updated++;

      } catch (error) {
        console.error(`  ✗ Error updating post ${post._id}: ${error.message}`);
        failed++;
      }
    }

    console.log(`\n📊 RESULTS:`);
    console.log(`  ✓ Successfully regenerated: ${updated} posts`);
    if (failed > 0) console.log(`  ✗ Failed: ${failed} posts`);
    
    console.log(`\n✅ All old posts now have fresh Picsum URLs!`);
    console.log(`📌 Next: Hard refresh browser (Ctrl+Shift+R) to see the images`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => regenerateAllOldPostMedia());
