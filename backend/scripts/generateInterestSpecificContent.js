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

const INTEREST_TEMPLATES = {
  animation: [
    "Working on a new animation sequence 🎬",
    "Animation study: exploring motion and timing",
    "Character animation project in progress",
    "Attempting a complex animation technique",
    "Animation breakdown of my latest piece"
  ],
  photogrammetry: [
    "Photogrammetry project results 📸",
    "Exploring 3D scanning with photogrammetry",
    "Reality capture: photogrammetry techniques",
    "Building 3D models through photogrammetry",
    "Photogrammetry workflow and results"
  ],
  sculpture: [
    "New sculpture piece completed 🗿",
    "Sculpture workshop: exploring form and space",
    "Working with different sculptural materials",
    "Abstract sculpture study",
    "Contemporary sculpture experimentation"
  ],
  film: [
    "Film project update 🎥",
    "Cinematography studies and techniques",
    "Short film production insights",
    "Exploring film narrative and composition",
    "Behind the scenes: film production"
  ]
};

async function generateInterestSpecificContent() {
  console.log('🎨 GENERATING CONTENT FOR SPECIFIC INTERESTS\n');
  
  try {
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = new Set(seedUsers.map(u => u._id.toString()));
    
    // Get non-seed users
    const nonSeedUsers = await User.find({ _id: { $nin: Array.from(seedUserIds) } }).limit(50);
    
    console.log(`Generating posts for ${nonSeedUsers.length} users with focus interests\n`);
    
    const targetInterests = ['animation', 'photogrammetry', 'sculpture', 'film'];
    let totalCreated = 0;

    for (const user of nonSeedUsers) {
      try {
        // For each target interest, generate 2-3 posts
        for (const interest of targetInterests) {
          const numPosts = Math.floor(Math.random() * 2) + 2;
          const templates = INTEREST_TEMPLATES[interest] || [interest];

          for (let i = 0; i < numPosts; i++) {
            const desc = templates[Math.floor(Math.random() * templates.length)];
            
            const numImages = Math.floor(Math.random() * 2) + 1;
            const mediaArray = [];

            for (let j = 0; j < numImages; j++) {
              const seed = getDeterministicSeedFromPostId(new mongoose.Types.ObjectId(), j);
              mediaArray.push({
                url: generatePicsumUrl(600, 400, seed),
                type: 'image',
                size: Math.floor(Math.random() * 500000) + 100000,
                duration: 0,
                thumbnail: generatePicsumUrl(600, 400, seed)
              });
            }

            const newPost = new Post({
              userId: user._id,
              name: user.name,
              desc: desc,
              mediaArray: mediaArray,
              mediaCount: mediaArray.length,
              tags: [interest],
              contentType: 'regular',
              visibility: 'public',
              likes: [],
              comments: [],
              engagementMetrics: {
                views: 0,
                shares: 0,
                commentCount: 0,
                popularity: 0,
                recency: 1
              }
            });

            await newPost.save();
            totalCreated++;
          }
        }

        console.log(`  ✓ ${user.name}: Created posts for all 4 interests`);

      } catch (error) {
        console.error(`  ✗ Error for ${user.name}:`, error.message);
      }
    }

    console.log(`\n✅ RESULTS:`);
    console.log(`  ✓ Total posts created: ${totalCreated}`);
    console.log(`  ✓ Interests covered: animation, photogrammetry, sculpture, film`);
    console.log(`  ✓ This should improve recommendations for users with these interests!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => generateInterestSpecificContent());
