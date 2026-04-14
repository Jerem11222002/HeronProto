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

async function fixMissingMediaArrayDirect() {
  console.log('🔧 FIXING POSTS WITH MISSING MEDIAARRAY (Direct Update)\n');
  
  try {
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Find posts WITHOUT mediaArray
    const postsWithoutMediaArray = await Post.find({
      userId: { $nin: seedUserIds },
      $or: [
        { mediaArray: { $exists: false } },
        { mediaArray: { $eq: [] } }
      ]
    }).select('_id desc title mediaArray tags');

    console.log(`Found ${postsWithoutMediaArray.length} posts without mediaArray\n`);

    let updated = 0;
    let failed = 0;

    for (const post of postsWithoutMediaArray) {
      try {
        const postTitle = post.title || post.desc?.substring(0, 40) || 'Untitled';
        
        // Generate media array with deterministic seeds
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

        // Use updateOne to bypass document validation
        await Post.updateOne(
          { _id: post._id },
          {
            $set: {
              mediaArray: mediaArray,
              mediaCount: mediaArray.length
            }
          }
        );

        console.log(`  ✓ "${postTitle.substring(0, 40).padEnd(40)}" → Added ${numImages} Picsum image(s)`);
        updated++;

      } catch (error) {
        console.error(`  ✗ Error updating post ${post._id}: ${error.message}`);
        failed++;
      }
    }

    console.log(`\n📊 RESULTS:`);
    console.log(`  ✓ Successfully updated: ${updated} posts`);
    console.log(`  ✗ Failed: ${failed} posts\n`);
    
    if (updated > 0) {
      console.log(`✅ Fixed ${updated} old posts! Browser cache clear and refresh needed.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => fixMissingMediaArrayDirect());
