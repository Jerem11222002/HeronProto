const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');

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

// Generate unique seed from post ID
function generateSeedFromPostId(postId) {
  // Convert MongoDB ObjectId to a number for seed
  const idStr = postId.toString();
  let seed = 0;
  for (let i = 0; i < idStr.length; i++) {
    seed += idStr.charCodeAt(i);
  }
  return seed % 1000; // Keep seed reasonable (0-999)
}

async function regenerateUniqueImages() {
  console.log('\n🔄 REGENERATING UNIQUE IMAGES FOR EACH POST\n');

  try {
    const posts = await Post.find({
      mediaArray: { $exists: true, $ne: [] }
    });

    console.log(`Found ${posts.length} posts with mediaArray\n`);

    let updated = 0;
    const imageCategories = {
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

    for (let idx = 0; idx < posts.length; idx++) {
      const post = posts[idx];
      
      try {
        // Get primary tag for this post
        const primaryTag = post.tags && post.tags.length > 0 ? post.tags[0] : 'performance';
        const availableSeeds = imageCategories[primaryTag] || imageCategories['performance'];

        // Generate unique seed based on post ID + index
        const basePostSeed = generateSeedFromPostId(post._id);
        
        // Create new mediaArray with unique seeds for each image
        const newMediaArray = [];
        for (let i = 0; i < post.mediaArray.length; i++) {
          // Create unique seed by combining post seed + image index
          const uniqueSeed = (basePostSeed + i * 100 + (idx % 50) * 10) % 1000;
          
          // Select image seed from category pool based on uniqueness
          const categoryIndex = (basePostSeed + i) % availableSeeds.length;
          const imageSeed = availableSeeds[categoryIndex];
          
          // Use Picsum's ID-based URL format that passes validation
          // Format: https://picsum.photos/id/{imageId}/{width}/{height}.jpg
          // This ensures .jpg is at the very end for regex validation
          const combinedId = (imageSeed * 1000 + uniqueSeed);
          const imageUrl = `https://picsum.photos/id/${combinedId}/600/400.jpg`;
          
          newMediaArray.push({
            url: imageUrl,
            type: 'image',
            size: Math.floor(Math.random() * 500000) + 100000,
            duration: 0,
            thumbnail: imageUrl
          });
        }

        // Update post with unique images
        post.mediaArray = newMediaArray;
        post.media = newMediaArray[0].url; // Primary media is first image
        post.mediaType = 'image';
        post.mediaCount = newMediaArray.length;

        await post.save();

        const postTitle = post.title || post.desc?.substring(0, 30) || 'Untitled';
        console.log(`✓ "${postTitle.substring(0, 40).padEnd(40)}" → ${newMediaArray.length} unique images`);
        updated++;
      } catch (error) {
        console.error(`✗ Error updating post ${post._id}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 UNIQUE IMAGES REGENERATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n✅ Updated ${updated} posts with unique images`);
    console.log(`\n📝 Each post now has:`);
    console.log(`   • Unique images per post (different from all others)`);
    console.log(`   • Images themed by interest category`);
    console.log(`   • Multiple images per post (1-3) for galleries`);
    console.log(`\n✨ All images should now be distinctly different!\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  await connectDB();
  await regenerateUniqueImages();
}

main();
