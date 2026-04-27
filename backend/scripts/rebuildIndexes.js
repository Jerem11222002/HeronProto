require('dotenv').config();
const mongoose = require('mongoose');

async function rebuildIndexes() {
  try {
    console.log('🔧 Rebuilding indexes...\n');
    
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;

    // Drop ALL indexes (except _id) and rebuild from schema
    const collections = ['posts', 'users', 'events', 'comments', 'notifications'];
    
    for (const collName of collections) {
      try {
        const collection = db.collection(collName);
        await collection.dropIndexes(); // Drops all except _id
        console.log(`✅ Dropped all indexes for ${collName}`);
      } catch (err) {
        if (err.code !== 27) { // 27 = no indexes to drop
          console.log(`⚠️  ${collName}: ${err.message}`);
        }
      }
    }

    console.log('\n⏳ Waiting for MongoDB to clear...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Require models to trigger schema index creation
    console.log('\n🔨 Rebuilding indexes from schemas...\n');
    
    const User = require('../models/users');
    const Post = require('../models/posts');
    const Event = require('../models/event');
    const Comment = require('../models/comment');
    const Notification = require('../models/notification');

    // Create indexes from schema definitions
    await Promise.all([
      User.collection.createIndexes(),
      Post.collection.createIndexes(),
      Event.collection.createIndexes(),
      Comment.collection.createIndexes(),
      Notification.collection.createIndexes()
    ]);

    console.log('✅ All indexes rebuilt!\n');

    // Verify
    console.log('📊 New index counts:\n');
    for (const collName of collections) {
      const collection = db.collection(collName);
      const indexes = await collection.getIndexes();
      console.log(`${collName}: ${Object.keys(indexes).length} indexes`);
    }

    console.log('\n✅ Index rebuild complete! Duplicates removed.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

rebuildIndexes();
