require('dotenv').config();
const mongoose = require('mongoose');

async function createEssentialIndexes() {
  try {
    console.log('🔨 Creating essential indexes for performance...\n');
    
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;

    // Essential indexes for queries
    const indexesToCreate = {
      users: [
        { fields: { username: 1 }, options: { unique: true } },
        { fields: { email: 1 }, options: { unique: true } },
        { fields: { followers: 1 }, options: {} },
        { fields: { following: 1 }, options: {} },
        { fields: { interests: 1 }, options: {} },
        { fields: { createdAt: -1 }, options: {} },
      ],
      posts: [
        { fields: { userId: 1 }, options: {} },
        { fields: { createdAt: -1 }, options: {} },
        { fields: { userId: 1, createdAt: -1 }, options: {} },
        { fields: { tags: 1 }, options: {} },
      ],
      events: [
        { fields: { date: 1 }, options: {} },
        { fields: { organization: 1 }, options: {} },
        { fields: { tags: 1 }, options: {} },
        { fields: { status: 1 }, options: {} },
      ],
      comments: [
        { fields: { postId: 1 }, options: {} },
        { fields: { userId: 1 }, options: {} },
        { fields: { postId: 1, createdAt: -1 }, options: {} },
      ],
      notifications: [
        { fields: { userId: 1 }, options: {} },
        { fields: { createdAt: -1 }, options: {} },
        { fields: { userId: 1, read: 1 }, options: {} },
      ]
    };

    for (const [collName, indexes] of Object.entries(indexesToCreate)) {
      console.log(`📍 ${collName.toUpperCase()}:`);
      const collection = db.collection(collName);
      
      for (const {fields, options} of indexes) {
        try {
          const fieldStr = JSON.stringify(fields);
          await collection.createIndex(fields, options);
          console.log(`   ✅ ${fieldStr}`);
        } catch (err) {
          console.log(`   ⚠️  ${fieldStr}: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Essential indexes created!\n');

    // Verify
    console.log('📊 Verify:\n');
    for (const collName of Object.keys(indexesToCreate)) {
      const collection = db.collection(collName);
      const indexes = await collection.getIndexes();
      console.log(`${collName}: ${Object.keys(indexes).length} indexes (should be ~5-8)`);
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createEssentialIndexes();
