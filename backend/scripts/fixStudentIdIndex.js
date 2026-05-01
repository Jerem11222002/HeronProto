require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

if (!process.env.MONGO_URI) {
  console.error('❌ Error: MONGO_URI not found in environment variables');
  process.exit(1);
}

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas\n');

    console.log('📋 Fixing database indexes...\n');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Drop the problematic studentId index
    console.log('Dropping old studentId index...');
    await collection.dropIndex('studentId_1').catch(err => {
      if (err.message.includes('index not found')) {
        console.log('Index not found (this is okay)');
      } else {
        throw err;
      }
    });

    console.log('✅ Old index dropped successfully');

    // Now create the new index with sparse: true
    console.log('Creating new sparse studentId index...');
    await collection.createIndex({ studentId: 1 }, { sparse: true, unique: true });
    console.log('✅ New sparse index created successfully');

    console.log('\n✨ Index fix completed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

fixIndexes();
