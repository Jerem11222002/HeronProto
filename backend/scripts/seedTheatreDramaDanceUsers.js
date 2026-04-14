/**
 * Seed posts for theatre, drama, and dance users
 * This will create posts tagged with these interests for proper recommendation matching
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

const THEATRE_DRAMA_DANCE_TEMPLATES = {
  theatre: [
    "Theatre production: Stage design and lighting setup 🎭",
    "Performance piece: Exploring theatrical expressions and storytelling",
    "Theatre workshop: Exploring character development and scene work",
    "Stage performance: Breakdown of dialogue delivery and blocking",
    "Theatre project update: Set design and costume preparation",
    "Production update: Rehearsal progress and staging technique",
    "Theatre study: Exploring different performance styles"
  ],
  drama: [
    "Drama series study: Scene analysis and emotional intensity 🎬",
    "Dramatic composition: Character interactions and tension building",
    "Drama workshop: Exploring conflict and resolution in storytelling",
    "Performance study: Dramatic pacing and emotional authenticity",
    "Drama production: Script adaptation and character interpretation",
    "Scene breakdown: Analyzing dialogue and subtext in drama",
    "Drama technique: Method acting and character portrayal"
  ],
  dance: [
    "Dance choreography: Movement sequence exploration 💃",
    "Contemporary dance: Exploring expressive movement and improvisation",
    "Dance workshop: Technique practice and skill development",
    "Choreography process: Movement creation and refinement",
    "Dance performance: Staging and technical rehearsal",
    "Movement study: Different dance styles and fusion techniques",
    "Dance production: Collaboration and creative development"
  ]
};

async function seedTheatreDramaDanceUsers() {
  console.log('🎭 SEEDING POSTS FOR THEATRE, DRAMA, AND DANCE USERS\n');

  try {
    let totalProcessed = 0;
    let totalPostsDeleted = 0;
    let totalPostsCreated = 0;

    // Process each interest category
    for (const [interestKey, postTemplates] of Object.entries(THEATRE_DRAMA_DANCE_TEMPLATES)) {
      console.log(`\n📌 Processing: ${interestKey.toUpperCase()}`);

      // Find all users with this interest
      const users = await User.find({
        interests: interestKey
      });

      console.log(`   Found ${users.length} users with ${interestKey} interest\n`);

      for (const user of users) {
        // Delete old posts first
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

        if (user.name === 'Je' || user.username === 'cheesecake0101') {
          console.log(`   ✓ ${user.name} (YOUR ACCOUNT): Deleted ${deleteResult.deletedCount}, Created ${postsCreatedForUser} posts`);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 SEEDING COMPLETE:`);
    console.log(`   ✓ Users processed: ${totalProcessed}`);
    console.log(`   ✓ Old posts deleted: ${totalPostsDeleted}`);
    console.log(`   ✓ New posts created: ${totalPostsCreated}`);
    console.log(`${'='.repeat(60)}\n`);

    console.log('✅ Theatre, drama, and dance users now have interest-matching posts!\n');
    console.log('🔄 Your account (Je/cheesecake0101) now has posts tagged with theatre, drama, dance');
    console.log('💡 Try refreshing your feed and running the recommendation evaluation again!\n');

  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => seedTheatreDramaDanceUsers());
