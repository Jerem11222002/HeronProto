const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';
const PICSUM_BASE = 'https://picsum.photos';

// Image keywords/seeds for different interests to get thematically relevant images
const INTEREST_IMAGE_KEYWORDS = {
  'writing': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'fashion': [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  'film': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  'photogrammetry': [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
  'sculpture': [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
  'music': [51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
  'theatre': [61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
  'dance': [71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
  'photography': [81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
  'cultural-arts': [91, 92, 93, 94, 95, 96, 97, 98, 99, 100],
  'performance': [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
  'visual-arts': [111, 112, 113, 114, 115, 116, 117, 118, 119, 120],
  'digital-art': [121, 122, 123, 124, 125, 126, 127, 128, 129, 130]
};

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

/**
 * Generate deterministic seed from post ID
 * Ensures same image every time post loads, not random on refresh
 */
function getDeterministicSeedFromPostId(postId, imageIndex = 0) {
  const hexPart = postId.toString().substring(0, 8);
  const baseSeed = parseInt(hexPart, 16) % 10000;
  return baseSeed + (imageIndex * 1000);
}

function generatePicsumUrl(width, height, seed) {
  return `${PICSUM_BASE}/${width}/${height}.jpg?random=${seed}`;
}

async function restoreOldPostMedia() {
  console.log('\n🔄 RESTORING OLD POST MEDIA (Non-Seed Users)\n');
  
  try {
    // Find all seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Find posts from NON-SEED users (old users)
    const oldPosts = await Post.find({ userId: { $nin: seedUserIds } });
    console.log(`Found ${oldPosts.length} posts from old (non-seed) users\n`);

    let migrated = 0;
    let skipped = 0;
    let alreadyHasMedia = 0;

    for (const post of oldPosts) {
      try {
        // Check if already has mediaArray with content
        if (post.mediaArray && post.mediaArray.length > 0) {
          alreadyHasMedia++;
          continue;
        }

        // If post has legacy 'media' field (Cloudinary URL), migrate it to mediaArray
        if (post.media && (post.media.includes('cloudinary') || post.media.startsWith('http'))) {
          const mediaArray = [{
            url: post.media,
            type: 'image',
            size: 0, // Legacy media doesn't track size
            duration: 0,
            thumbnail: post.media
          }];

          post.mediaArray = mediaArray;
          post.mediaCount = 1;
          await post.save();

          const postTitle = post.title || post.desc?.substring(0, 35) || 'Untitled';
          console.log(`  ✓ "${postTitle.substring(0, 35).padEnd(35)}" → Migrated Cloudinary URL to mediaArray`);
          migrated++;
          continue;
        }

        // Skip posts without tags (can't generate appropriate media)
        if (!post.tags || post.tags.length === 0) {
          skipped++;
          continue;
        }

        // For posts with no media at all, generate with Picsum.photos
        const primaryTag = post.tags[0];
        const availableSeeds = INTEREST_IMAGE_KEYWORDS[primaryTag] || INTEREST_IMAGE_KEYWORDS['performance'];
        
        if (!availableSeeds || availableSeeds.length === 0) {
          skipped++;
          continue;
        }

        const numImages = (post._id.getTimestamp().getTime() % 3) + 1;
        const mediaArray = [];

        for (let i = 0; i < numImages; i++) {
          const deterministicSeed = getDeterministicSeedFromPostId(post._id, i);
          const imageUrl = generatePicsumUrl(600, 400, deterministicSeed);
          
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

        const postTitle = post.title || post.desc?.substring(0, 35) || 'Untitled';
        console.log(`  ✓ "${postTitle.substring(0, 35).padEnd(35)}" → Generated ${numImages} Picsum image(s) [${primaryTag}]`);
        migrated++;
      } catch (error) {
        console.error(`  ✗ Error updating post ${post._id}: ${error.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Migrated/restored ${migrated} posts with media`);
    console.log(`⏭️  Already had mediaArray: ${alreadyHasMedia} posts`);
    if (skipped > 0) console.log(`⚠️  Skipped ${skipped} posts (no tags or media)\n`);
    return migrated;
  } catch (error) {
    console.error('❌ Error restoring post images:', error.message);
    return 0;
  }
}

async function main() {
  try {
    await connectDB();

    console.log('\n' + '='.repeat(70));
    console.log('🔄 RESTORE OLD POST MEDIA - Non-Seed User Posts');
    console.log('='.repeat(70));

    const postsRestored = await restoreOldPostMedia();

    console.log('='.repeat(70));
    console.log('📊 RESTORATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n✅ Old posts migrated/restored: ${postsRestored}`);
    console.log(`   - Cloudinary URLs migrated to mediaArray format`);
    console.log(`   - Missing media filled with Picsum.photos`);
    console.log(`\n🔒 Preservation Strategy:`);
    console.log(`   - Existing Cloudinary URLs: PRESERVED (not overwritten)`);
    console.log(`   - Posts with no media: Get Picsum.photos images`);
    console.log(`   - Seed user posts: Remain untouched`);
    console.log(`   - All images deterministic (same seed = same image)\n`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.\n');
  }
}

main();
