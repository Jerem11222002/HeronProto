const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

// Picsum.photos base URL - provides random high-quality images, no API key needed
// Format: https://picsum.photos/width/height.jpg?random=seed
// Adding .jpg extension makes it work with the Post model validation

const PICSUM_BASE = 'https://picsum.photos';

// Image keywords/seeds for different interests to get thematically relevant images
const INTEREST_IMAGE_KEYWORDS = {
  'writing': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // Books, desk, creative spaces
  'fashion': [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], // Fashion, clothing, colors
  'film': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30], // Cameras, cinema, visual
  'photogrammetry': [31, 32, 33, 34, 35, 36, 37, 38, 39, 40], // 3D, tech, art
  'sculpture': [41, 42, 43, 44, 45, 46, 47, 48, 49, 50], // Art, statues, installations
  'music': [51, 52, 53, 54, 55, 56, 57, 58, 59, 60], // Instruments, performance
  'theatre': [61, 62, 63, 64, 65, 66, 67, 68, 69, 70], // Stages, drama, lights
  'dance': [71, 72, 73, 74, 75, 76, 77, 78, 79, 80], // Movement, dancers, performance
  'photography': [81, 82, 83, 84, 85, 86, 87, 88, 89, 90], // Cameras, nature, people
  'cultural-arts': [91, 92, 93, 94, 95, 96, 97, 98, 99, 100], // Cultural, diverse, heritage
  'performance': [101, 102, 103, 104, 105, 106, 107, 108, 109, 110], // Live, stages, action
  'visual-arts': [111, 112, 113, 114, 115, 116, 117, 118, 119, 120], // Art, painting, color
  'digital-art': [121, 122, 123, 124, 125, 126, 127, 128, 129, 130] // Tech, digital, modern
};

// Profile picture seeds for users
const PROFILE_PICTURE_SEEDS = [201, 202, 203, 204, 205]; // Unique portrait-style images

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

function getRandomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate deterministic seed from post ID
 * Ensures same image every time post loads, not random on refresh
 */
function getDeterministicSeedFromPostId(postId, imageIndex = 0) {
  // Convert MongoDB ObjectId (24 hex chars) to a number
  // Take first 8 hex chars, convert to int, then use imageIndex for variation
  const hexPart = postId.toString().substring(0, 8);
  const baseSeed = parseInt(hexPart, 16) % 10000; // Keep it reasonable
  return baseSeed + (imageIndex * 1000); // Offset each image in set
}

function generatePicsumUrl(width, height, seed) {
  return `${PICSUM_BASE}/${width}/${height}.jpg?random=${seed}`;
}

async function updateUserProfilePictures() {
  console.log('\n👤 UPDATING USER PROFILE PICTURES\n');
  
  try {
    const users = await User.find({ email: { $regex: 'seed' } });
    console.log(`Found ${users.length} seed users\n`);

    let updated = 0;
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const seed = PROFILE_PICTURE_SEEDS[i % PROFILE_PICTURE_SEEDS.length];
      const profileUrl = generatePicsumUrl(400, 400, seed);
      
      user.profilePic = profileUrl;
      await user.save();
      
      console.log(`  ✓ ${user.name.padEnd(25)} → ${profileUrl.substring(0, 50)}...`);
      updated++;
    }
    
    console.log(`\n✅ Updated ${updated} user profile pictures\n`);
    return updated;
  } catch (error) {
    console.error('❌ Error updating user pictures:', error.message);
    return 0;
  }
}

async function updatePostImages() {
  console.log('🖼️  UPDATING POST IMAGES (Seed Users Only)\n');
  
  try {
    // IMPORTANT: Only find posts created by seed users
    // This prevents modifying old posts from non-seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    console.log(`Found ${seedUsers.length} seed users\n`);
    
    if (seedUsers.length === 0) {
      console.log('⚠️  No seed users found. Skipping image updates.\n');
      return 0;
    }
    
    const seedUserIds = seedUsers.map(u => u._id);
    const posts = await Post.find({ userId: { $in: seedUserIds } });
    console.log(`Found ${posts.length} posts from seed users\n`);

    let updated = 0;
    let skipped = 0;

    for (const post of posts) {
      try {
        // Skip posts without tags
        if (!post.tags || post.tags.length === 0) {
          skipped++;
          continue;
        }

        // Get the primary tag (interest) for this post
        const primaryTag = post.tags[0];
        
        // Get available image seeds for this interest
        const availableSeeds = INTEREST_IMAGE_KEYWORDS[primaryTag] || INTEREST_IMAGE_KEYWORDS['performance'];
        
        if (!availableSeeds || availableSeeds.length === 0) {
          skipped++;
          continue;
        }

        // Generate 1-3 images using DETERMINISTIC seeds based on post ID
        const numImages = (post._id.getTimestamp().getTime() % 3) + 1; // Deterministic based on post creation time
        const mediaArray = [];

        for (let i = 0; i < numImages; i++) {
          // Use deterministic seed from post ID instead of random
          const deterministicSeed = getDeterministicSeedFromPostId(post._id, i);
          const imageUrl = generatePicsumUrl(600, 400, deterministicSeed);
          
          mediaArray.push({
            url: imageUrl,
            type: 'image',
            size: Math.floor(Math.random() * 500000) + 100000, // 100KB - 600KB
            duration: 0,
            thumbnail: imageUrl
          });
        }

        // Update post with deterministic media array
        post.mediaArray = mediaArray;
        post.mediaCount = mediaArray.length;
        
        await post.save();

        const postTitle = post.title || post.desc?.substring(0, 35) || 'Untitled';
        console.log(`  ✓ "${postTitle.substring(0, 35).padEnd(35)}" → ${numImages} image(s) [${primaryTag}]`);
        updated++;
      } catch (error) {
        console.error(`  ✗ Error updating post ${post._id}: ${error.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Updated ${updated} posts with images (seed users only)`);
    if (skipped > 0) console.log(`⚠️  Skipped ${skipped} posts\n`);
    return updated;
  } catch (error) {
    console.error('❌ Error updating post images:', error.message);
    return 0;
  }
}

async function main() {
  try {
    await connectDB();

    console.log('\n' + '='.repeat(70));
    console.log('🎨 SAMPLE IMAGE GENERATOR - Picsum.photos Integration (Seed Users)');
    console.log('='.repeat(70));

    const usersUpdated = await updateUserProfilePictures();
    const postsUpdated = await updatePostImages();

    console.log('='.repeat(70));
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n✅ User profiles updated: ${usersUpdated}`);
    console.log(`✅ Seed user posts with images: ${postsUpdated}`);
    console.log(`\n🔒 Note: Only posts from SEED USERS (@seed.local) are modified`);
    console.log(`   - Old user posts remain untouched`);
    console.log(`   - All images sourced from Picsum.photos (free service)`);
    console.log(`   - Images are deterministic (same seed = same image)\n`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.\n');
  }
}

main();
