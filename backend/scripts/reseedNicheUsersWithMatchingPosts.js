/**
 * Re-seed existing niche interest users with matching posts
 * 1. Find all users with niche interests (photogrammetry, animation, sculpture, film)
 * 2. Delete their old/mismatched posts
 * 3. Create new posts that match their interest category
 */

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

function generatePicsumUrl(width, height, seed) {
  return `${PICSUM_BASE}/${width}/${height}.jpg?random=${seed}`;
}

const NICHE_INTEREST_POST_TEMPLATES = {
  photogrammetry: [
    "Photogrammetry project results 📸 - scanned this interesting object today, 45 photos processed",
    "Exploring photogrammetry: 3D scanning techniques - this is my first attempt",
    "Reality capture: Building a 3D model from photographs using photogrammetry",
    "Photogrammetry workflow breakdown - from capture to final model",
    "New photogrammetry study - testing different lighting conditions",
    "Photogrammetry project update - processing 100+ images for 3D reconstruction",
    "Advanced photogrammetry techniques - exploring point cloud generation"
  ],
  animation: [
    "Animation project: Character rigging and keyframe animation 🎬",
    "Motion graphics exploration - trying new animation techniques",
    "Animated sequence breakdown - process and workflow",
    "3D animation: Character animation principles and practice",
    "Animation study: Testing different animation styles",
    "Motion capture animation project - frame by frame breakdown",
    "Animation workflow update - rendering and post-processing"
  ],
  sculpture: [
    "Sculpture work in progress: Digital sculpture study 🎨",
    "Sculpting techniques exploration - experimenting with new approaches",
    "Studio update: Sculpture project progression from concept to final form",
    "Digital sculpting: Working with different tools and materials",
    "Sculpture study: Form and shape exploration",
    "Sculpting workflow: From initial concept to finished piece",
    "3D sculpture project: Large scale digital composition"
  ],
  film: [
    "Film project: Cinematography and shot composition 🎥",
    "Filmmaking study: Exploring different visual storytelling techniques",
    "Short film production: Behind the scenes and process",
    "Cinematography breakdown - color grading and visual effects",
    "Film editing: Pacing, transitions, and narrative flow",
    "Production update: On location filming and location scouting",
    "Post-production workflow: From raw footage to final cut"
  ]
};

async function reseedUsersWithMatchingPosts() {
  console.log('🔄 RE-SEEDING NICHE INTEREST USERS WITH MATCHING POSTS\n');

  try {
    let totalProcessed = 0;
    let totalPostsDeleted = 0;
    let totalPostsCreated = 0;

    // Process each niche interest
    for (const [interestKey, postTemplates] of Object.entries(NICHE_INTEREST_POST_TEMPLATES)) {
      console.log(`\n📌 Processing: ${interestKey.toUpperCase()}`);

      // Find all users with this interest
      const users = await User.find({
        interests: interestKey
      });

      console.log(`   Found ${users.length} users with ${interestKey} interest\n`);

      for (const user of users) {
        // Delete old posts from this user
        const deleteResult = await Post.deleteMany({ userId: user._id });

        // Create 3-4 new posts matching their interest
        const numPosts = Math.floor(Math.random() * 2) + 3;
        let postsCreatedForUser = 0;

        for (let i = 0; i < numPosts; i++) {
          const desc = postTemplates[Math.floor(Math.random() * postTemplates.length)];

          // Create 2-3 media items per post
          const numImages = Math.floor(Math.random() * 2) + 2;
          const mediaArray = [];

          for (let j = 0; j < numImages; j++) {
            const seed = Math.floor(Math.random() * 10000) + (j * 1000);
            const mediaUrl = generatePicsumUrl(600, 400, seed);
            mediaArray.push({
              url: mediaUrl,
              type: 'image',
              size: Math.floor(Math.random() * 500000) + 200000,
              duration: 0,
              thumbnail: generatePicsumUrl(300, 200, seed)
            });
          }

          // Create post with proper tags matching the user's interests
          const newPost = new Post({
            userId: user._id,
            name: user.name,
            desc: desc,
            mediaArray: mediaArray,
            mediaCount: mediaArray.length,
            tags: [interestKey, ...user.interests.filter(i => i !== interestKey).slice(0, 2)],
            contentType: 'regular',
            visibility: 'public',
            likes: [],
            comments: [],
            engagementMetrics: {
              views: Math.floor(Math.random() * 500) + 20,
              shares: Math.floor(Math.random() * 20),
              commentCount: Math.floor(Math.random() * 15),
              popularity: Math.random() * 0.8 + 0.2,
              recency: 1
            },
            createdAt: new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000) // Recent: 2-6 hours ago
          });

          await newPost.save();
          postsCreatedForUser++;
        }

        totalProcessed++;
        totalPostsDeleted += deleteResult.deletedCount;
        totalPostsCreated += postsCreatedForUser;

        console.log(`   ✓ ${user.name}: Deleted ${deleteResult.deletedCount}, Created ${postsCreatedForUser} posts`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RE-SEEDING COMPLETE:`);
    console.log(`   ✓ Users processed: ${totalProcessed}`);
    console.log(`   ✓ Old posts deleted: ${totalPostsDeleted}`);
    console.log(`   ✓ New posts created: ${totalPostsCreated}`);
    console.log(`${'='.repeat(60)}\n`);

    console.log('✅ All existing niche interest users now have matching posts in their feed!\n');
  } catch (error) {
    console.error('❌ Error during re-seeding:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => reseedUsersWithMatchingPosts());
