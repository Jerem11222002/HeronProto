const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

const templates = {
  art: ["New art piece inspired by {interest} 🎨", "Experimenting with {interest} themes"],
  music: ["Working on a track inspired by {interest} 🎵", "Musical journey through {interest}"],
  dance: ["New choreography inspired by {interest} 💃", "Movement exploration: {interest}"],
  fashion: ["New {interest} inspired outfit 💃", "Fashion exploration: {interest} aesthetic"],
};

function getRandomTemplate(interest) {
  const category = interest.split('-')[0].toLowerCase();
  const tmpl = templates[category] || templates.art;
  return tmpl[Math.floor(Math.random() * tmpl.length)].replace('{interest}', interest);
}

async function seedPosts() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('HeronFusion');
    const usersCol = db.collection('users');
    const postsCol = db.collection('posts');
    
    // Get current post count
    const currentCount = await postsCol.countDocuments();
    const maxTotal = 1000;
    const remainingCapacity = maxTotal - currentCount;
    
    console.log(`📊 Current posts: ${currentCount}`);
    console.log(`📊 Target: ${maxTotal}`);
    console.log(`📊 Capacity: ${remainingCapacity}\n`);
    
    if (remainingCapacity <= 0) {
      console.log('✅ Already at limit');
      return;
    }

    // Get seed user IDs
    const seedUsers = await usersCol.find({ email: { $regex: /@seed\.local$/ } }).toArray();
    const seedIds = seedUsers.map(u => u._id);
    
    // Get regular users
    const regularUsers = await usersCol.find({ _id: { $nin: seedIds } }).toArray();
    console.log(`Found ${regularUsers.length} users\n`);

    let postsCreated = 0;
    const postsToInsert = [];

    for (const user of regularUsers) {
      if (postsCreated >= remainingCapacity) break;

      const interests = (user.interests && user.interests.length) 
        ? user.interests.slice(0, 3) 
        : ['art'];
      
      const numPosts = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < numPosts && postsCreated < remainingCapacity; i++) {
        const interest = interests[i % interests.length];
        
        postsToInsert.push({
          userId: user._id,
          name: user.name,
          desc: getRandomTemplate(interest),
          mediaArray: [{
            url: `https://picsum.photos/600/400?random=${Math.random()}`,
            type: 'image',
            size: 100000,
            duration: 0,
            thumbnail: `https://picsum.photos/600/400?random=${Math.random()}`
          }],
          mediaCount: 1,
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
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        postsCreated++;
        
        if (postsToInsert.length >= 100) {
          await postsCol.insertMany(postsToInsert);
          console.log(`✓ Inserted ${postsToInsert.length} posts (Total: ${postsCreated})`);
          postsToInsert.length = 0;
        }
      }
    }

    if (postsToInsert.length > 0) {
      await postsCol.insertMany(postsToInsert);
      console.log(`✓ Inserted ${postsToInsert.length} posts (Total: ${postsCreated})`);
    }

    const finalCount = await postsCol.countDocuments();
    console.log(`\n📊 Created: ${postsCreated} posts`);
    console.log(`📊 Final count: ${finalCount}`);
    console.log(`✅ Done!`);

  } finally {
    await client.close();
  }
}

seedPosts().catch(console.error);
