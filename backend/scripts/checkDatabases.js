const mongoose = require('mongoose');
const MongoClient = require('mongodb').MongoClient;

async function check() {
  try {
    console.log('Attempting direct MongoDB connection...');
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log('\n📊 Available databases:');
    dbs.databases.forEach(db => console.log(`  - ${db.name}`));
    
    // Check each database for posts
    for (const db of dbs.databases) {
      const database = client.db(db.name);
      try {
        const postCount = await database.collection('posts').countDocuments();
        if (postCount > 0) {
          console.log(`\n✅ Found ${postCount} posts in database: ${db.name}`);
        }
      } catch (err) {
        // Collection doesn't exist, skip
      }
    }
    
    client.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
