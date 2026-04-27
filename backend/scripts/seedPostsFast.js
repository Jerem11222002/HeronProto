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

const POST_TEMPLATES = {
  writing: ["Just finished writing a new piece about {interest}", "Exploring the intersection of {interest} and creativity", "Thoughts on my latest {interest} project"],
  fashion: ["New {interest} inspired outfit 💃", "Fashion exploration: {interest} aesthetic", "Style experiment with {interest} vibes"],
  film: ["Just watched an amazing {interest} film! 🎬", "Studying {interest} cinematography", "Film inspiration from {interest}"],
  photography: ["Photography series exploring {interest} 📸", "Captured some {interest} moments today", "Visual journey through {interest}"],
  art: ["New art piece inspired by {interest} 🎨", "Experimenting with {interest} themes", "Artistic exploration of {interest}"],
  music: ["Working on a track inspired by {interest} 🎵", "Musical journey through {interest}", "Sound design meets {interest}"],
  dance: ["New choreography inspired by {interest} 💃", "Movement exploration: {interest}", "Dance inspired by {interest} themes"],
  performance: ["Performance piece on {interest} 🎭", "Exploring {interest} through performance", "Stage work inspired by {interest}"],
};

function getRandomTemplate(interest) {
  const category = interest.split('-')[0].toLowerCase();
  const templates = POST_TEMPLATES[category] || POST_TEMPLATES.art;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace('{interest}', interest);
}

async function seedPostsFast() {
  console.log('🌱 SEEDING POSTS (FAST MODE - UP TO 1000 TOTAL)\n');
  
  try {
    const currentCount = await Post.countDocuments();
    const maxTotal = 1000;
    const remainingCapacity = maxTotal - currentCount;
    
    console.log(`📊 Current posts: ${currentCount}`);
    console.log(`📊 Target max: ${maxTotal}`);
    console.log(`📊 Capacity for new posts: ${remainingCapacity}\n`);
    
    if (remainingCapacity <= 0) {
      console.log('✅ Already at or above 1000 posts. No seeding needed.');
      await mongoose.connection.close();
      process.exit(0);
    }

    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = new Set(seedUsers.map(u => u._id.toString()));
    
    const oldUsers = await User.find({ _id: { $nin: Array.from(seedUserIds) } });
    console.log(`Found ${oldUsers.length} users to seed\n`);

    let totalCreated = 0;
    let postsToInsert = [];
    const batchSize = 100;

    for (const user of oldUsers) {
      if (totalCreated >= remainingCapacity) {
        console.log(`✅ Reached capacity!`);
        break;
      }

      const interests = Array.isArray(user.interests) && user.interests.length > 0 
        ? user.interests.slice(0, 3)
        : ['art', 'performance'];

      let numPosts = Math.floor(Math.random() * 3) + 3;
      if (totalCreated + numPosts > remainingCapacity) {
        numPosts = remainingCapacity - totalCreated;
        if (numPosts <= 0) break;
      }

      for (let i = 0; i < numPosts; i++) {
        const interest = interests[i % interests.length];
        const desc = getRandomTemplate(interest);
        
        const numImages = Math.floor(Math.random() * 3) + 1;
        const mediaArray = [];

        for (let j = 0; j < numImages; j++) {
          const seed = Math.floor(Math.random() * 10000);
          mediaArray.push({
            url: generatePicsumUrl(600, 400, seed),
            type: 'image',
            size: Math.floor(Math.random() * 500000) + 100000,
            duration: 0,
            thumbnail: generatePicsumUrl(600, 400, seed)
          });
        }

        postsToInsert.push({
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

        if (postsToInsert.length >= batchSize) {
          await Post.insertMany(postsToInsert);
          totalCreated += postsToInsert.length;
          console.log(`✓ Batch inserted: ${postsToInsert.length} posts (Total: ${totalCreated})`);
          postsToInsert = [];
        }
      }
    }

    if (postsToInsert.length > 0) {
      await Post.insertMany(postsToInsert);
      totalCreated += postsToInsert.length;
      console.log(`✓ Final batch: ${postsToInsert.length} posts (Total: ${totalCreated})`);
    }

    const finalCount = await Post.countDocuments();
    console.log(`\n📊 Posts created: ${totalCreated}`);
    console.log(`📊 Final post count: ${finalCount}`);
    console.log(`\n✅ Seeding complete!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => seedPostsFast());
