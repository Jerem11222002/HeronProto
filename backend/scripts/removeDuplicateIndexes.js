require('dotenv').config();
const mongoose = require('mongoose');

async function removeDuplicateIndexes() {
  try {
    console.log('🔧 Removing duplicate indexes...\n');
    
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;

    // Get all indexes for users collection
    const usersCollection = db.collection('users');
    const usersIndexes = await usersCollection.getIndexes();
    
    console.log('📋 USERS Collection - Removing duplicates:\n');
    
    // Count occurrences of each index key pattern
    const indexCounts = {};
    Object.entries(usersIndexes).forEach(([name, spec]) => {
      const key = JSON.stringify(spec.key);
      indexCounts[key] = (indexCounts[key] || 0) + 1;
    });

    // Drop duplicate indexes (keep one of each, drop the rest)
    const seen = new Set();
    
    for (const [name, spec] of Object.entries(usersIndexes)) {
      const key = JSON.stringify(spec.key);
      
      if (name === '_id_') {
        console.log(`✅ Keeping: _id (primary key)`);
        continue;
      }
      
      if (seen.has(key)) {
        console.log(`🗑️  Dropping duplicate: ${name} (${key})`);
        try {
          await usersCollection.dropIndex(name);
        } catch (err) {
          console.log(`⚠️ Could not drop ${name}: ${err.message}`);
        }
      } else {
        console.log(`✅ Keeping: ${name} (${key})`);
        seen.add(key);
      }
    }

    console.log('\n✅ Duplicate index removal complete!');
    console.log('\n📊 Final indexes after cleanup:');
    const finalIndexes = await usersCollection.getIndexes();
    console.log(`Total indexes: ${Object.keys(finalIndexes).length}`);
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeDuplicateIndexes();
