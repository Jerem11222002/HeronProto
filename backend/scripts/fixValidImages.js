const MongoClient = require('mongodb').MongoClient;

async function fixImages() {
  try {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    const db = client.db('herondb');
    const collection = db.collection('posts');
    
    // Valid Picsum ID range
    const VALID_IDS = Array.from({ length: 344 }, (_, i) => i);
    
    // Get all posts
    const posts = await collection.find({}).toArray();
    console.log(`\n📋 Found ${posts.length} posts in herondb`);
    
    let updated = 0;
    
    for (let idx = 0; idx < posts.length; idx++) {
      const post = posts[idx];
      
      // Generate new media array with valid IDs
      const newMediaArray = (post.mediaArray || []).map((item, imgIdx) => {
        // Use post index + image index to get ID from valid range
        const idIndex = (idx * 5 + imgIdx) % VALID_IDS.length;
        const validId = VALID_IDS[idIndex];
        
        return {
          url: `https://picsum.photos/id/${validId}/600/400.jpg`,
          type: 'image',
          size: null,
          duration: null,
          thumbnail: null
        };
      });
      
      // Update the post
      await collection.updateOne(
        { _id: post._id },
        {
          $set: {
            mediaArray: newMediaArray,
            media: newMediaArray[0]?.url || null,
            mediaType: newMediaArray.length > 0 ? 'image' : null
          }
        }
      );
      
      updated++;
      if (updated % 5 === 0) {
        console.log(`✅ Updated ${updated}/${posts.length}...`);
      }
    }
    
    console.log(`\n✨ FIXED! Updated ${updated} posts with valid Picsum IDs (0-343 range)`);
    
    client.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixImages();
