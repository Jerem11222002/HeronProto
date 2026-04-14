const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/HeronProto';

async function check() {
  try {
    console.log('Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(c => console.log('  -', c.name));
    
    const postsCount = await db.collection('posts').countDocuments();
    console.log('\nTotal posts:', postsCount);
    
    const sample = await db.collection('posts').findOne();
    if (sample) {
      console.log('\nSample post keys:', Object.keys(sample));
      console.log('media:', sample.media?.substring?.(0, 100) || sample.media);
      console.log('mediaArray:', sample.mediaArray ? '(exists, length: ' + sample.mediaArray.length + ')' : '(missing)');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
