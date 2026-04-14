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

const POST_TEMPLATES = {
  writing: [
    "Just finished writing a new piece about {interest}",
    "Exploring the intersection of {interest} and creativity",
    "Thoughts on my latest {interest} project",
    "Working on something special with {interest}",
    "Reflection: The art of {interest}"
  ],
  fashion: [
    "New {interest} inspired outfit 💃",
    "Fashion exploration: {interest} aesthetic",
    "Style experiment with {interest} vibes",
    "Creating looks inspired by {interest}",
    "Fashion meets {interest} 👗"
  ],
  film: [
    "Just watched an amazing {interest} film! 🎬",
    "Studying {interest} cinematography",
    "Film inspiration from {interest}",
    "My take on {interest} in filmmaking",
    "Movie night dedicated to {interest}"
  ],
  photography: [
    "Photography series exploring {interest} 📸",
    "Captured some {interest} moments today",
    "Visual journey through {interest}",
    "Photo project: {interest} perspectives",
    "Behind the lens: {interest}"
  ],
  art: [
    "New art piece inspired by {interest} 🎨",
    "Experimenting with {interest} themes",
    "Artistic exploration of {interest}",
    "Creative interpretation: {interest}",
    "Art series focused on {interest}"
  ],
  music: [
    "Working on a track inspired by {interest} 🎵",
    "Musical journey through {interest}",
    "Sound design meets {interest}",
    "Composition inspired by {interest}",
    "Audio exploration of {interest}"
  ],
  dance: [
    "New choreography inspired by {interest} 💃",
    "Movement exploration: {interest}",
    "Dance inspired by {interest} themes",
    "Choreography workshop on {interest}",
    "Dance interpretation of {interest}"
  ],
  performance: [
    "Performance piece on {interest} 🎭",
    "Exploring {interest} through performance",
    "Stage work inspired by {interest}",
    "Theatrical take on {interest}",
    "Performance art: {interest} edition"
  ],
};

function getRandomTemplate(interest) {
  const category = interest.split('-')[0].toLowerCase();
  const templates = POST_TEMPLATES[category] || POST_TEMPLATES.art;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace('{interest}', interest);
}

async function seedPostsForOldUsers() {
  console.log('🌱 GENERATING POSTS FOR EXISTING USERS BASED ON INTERESTS\n');
  
  try {
    // Find seed users to exclude
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = new Set(seedUsers.map(u => u._id.toString()));
    
    // Find all non-seed users
    const oldUsers = await User.find({ _id: { $nin: Array.from(seedUserIds) } });
    console.log(`Found ${oldUsers.length} existing users to seed with posts\n`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const user of oldUsers) {
      try {
        const interests = Array.isArray(user.interests) && user.interests.length > 0 
          ? user.interests.slice(0, 3)  // Use first 3 interests
          : ['art', 'performance'];  // Default interests

        // Generate 3-5 posts per user
        const numPosts = Math.floor(Math.random() * 3) + 3;

        console.log(`📌 ${user.name} (@${user.username}) - Interests: ${interests.join(', ')}`);

        for (let i = 0; i < numPosts; i++) {
          const interest = interests[i % interests.length];
          const desc = getRandomTemplate(interest);
          
          // Generate 1-3 images per post
          const numImages = (Math.floor(Math.random() * 3) + 1);
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

        console.log(`  ✓ Created ${numPosts} posts\n`);

      } catch (error) {
        console.error(`✗ Error creating posts for ${user.name}:`, error.message);
        totalSkipped++;
      }
    }

    console.log(`\n📊 RESULTS:`);
    console.log(`  ✓ Posts created: ${totalCreated}`);
    if (totalSkipped > 0) console.log(`  ✗ Users skipped: ${totalSkipped}`);
    
    console.log(`\n✅ User posts generation complete!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => seedPostsForOldUsers());
