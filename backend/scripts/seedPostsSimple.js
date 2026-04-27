const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

const templates = {
  art: ["New art piece inspired by {interest} 🎨", "Experimenting with {interest} themes"],
  music: ["Working on a track inspired by {interest} 🎵", "Musical journey through {interest}"],
  dance: ["New choreography inspired by {interest} 💃", "Movement exploration: {interest}"],
};

function getTemplate(interest) {
  const cat = interest.split('-')[0].toLowerCase();
  const tmpl = templates[cat] || templates.art;
  return tmpl[Math.floor(Math.random() * tmpl.length)].replace('{interest}', interest);
}

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('✅ Connected\n');
    
    const db = client.db('HeronFusion');
    const users = db.collection('users');
    const posts = db.collection('posts');
    
    const currentCount = await posts.countDocuments();
    const capacity = Math.max(0, 1000 - currentCount);
    
    console.log(`📊 Current: ${currentCount}, Capacity: ${capacity}\n`);
    if (capacity <= 0) return;
    
    let created = 0;
    const batch = [];
    const pageSize = 10;
    let page = 0;

    while (created < capacity) {
      // Get page of users
      const userPage = await users.find({})
        .skip(page * pageSize)
        .limit(pageSize)
        .toArray();
      
      if (userPage.length === 0) break;
      console.log(`📄 Page ${page}: ${userPage.length} users`);

      for (const user of userPage) {
        if (created >= capacity) break;

        const interests = (user.interests && user.interests.length) 
          ? user.interests.slice(0, 3) 
          : ['art'];
        
        const numPosts = Math.min(3, capacity - created);
        
        for (let i = 0; i < numPosts; i++) {
          batch.push({
            userId: user._id,
            name: user.name || 'User',
            desc: getTemplate(interests[i % interests.length]),
            mediaArray: [{
              url: `https://picsum.photos/600/400?random=${Math.random() * 10000}`,
              type: 'image',
              size: 100000,
              duration: 0,
              thumbnail: `https://picsum.photos/100/100?random=${Math.random() * 10000}`
            }],
            mediaCount: 1,
            tags: [interests[i % interests.length]],
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

          created++;

          if (batch.length >= 50) {
            await posts.insertMany(batch);
            console.log(`  ✓ ${batch.length} posts (Total: ${created})`);
            batch.length = 0;
          }
        }
      }

      page++;
    }

    if (batch.length > 0) {
      await posts.insertMany(batch);
      console.log(`  ✓ ${batch.length} posts (Total: ${created})`);
    }

    const final = await posts.countDocuments();
    console.log(`\n✅ Created: ${created}`);
    console.log(`📊 Final: ${final}`);

  } finally {
    await client.close();
  }
}

seed().catch(console.error);
