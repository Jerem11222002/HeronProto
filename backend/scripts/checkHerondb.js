const MongoClient = require('mongodb').MongoClient;

async function check() {
  try {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    const db = client.db('herondb');
    const postCount = await db.collection('posts').countDocuments();
    console.log('📊 Posts in herondb:', postCount);
    
    // Get sample post
    const sample = await db.collection('posts').findOne();
    if (sample) {
      console.log('\n📋 Sample post structure:');
      console.log('  _id:', sample._id);
      console.log('  title:', sample.title?.substring?.(0, 50));
      console.log('  media:', sample.media?.substring?.(0, 80) || '(missing)');
      console.log('  mediaType:', sample.mediaType || '(missing)');
      console.log('  mediaArray:', sample.mediaArray ? `(${sample.mediaArray.length} items)` : '(missing)');
      
      if (sample.mediaArray && sample.mediaArray[0]) {
        console.log('  First media URL:', sample.mediaArray[0].url?.substring?.(0, 80));
      }
    }
    
    // Stats
    const stats = await db.collection('posts').aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withMedia: { $sum: { $cond: [{ $ne: ['$media', null] }, 1, 0] } },
          withMediaArray: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$mediaArray', []] } }, 0] }, 1, 0] } }
        }
      }
    ]).toArray();
    
    console.log('\n📊 Stats:');
    console.log(JSON.stringify(stats[0], null, 2));
    
    client.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
