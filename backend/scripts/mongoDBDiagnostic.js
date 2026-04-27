require('dotenv').config();
const mongoose = require('mongoose');

async function runDiagnostics() {
  try {
    console.log('🔍 MongoDB Diagnostic Starting...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    const startConnect = Date.now();
    await mongoose.connect(process.env.MONGO_URI);
    const connectTime = Date.now() - startConnect;
    console.log(`✅ Connected in ${connectTime}ms\n`);

    const db = mongoose.connection;
    const collections = ['posts', 'users', 'events', 'comments', 'notifications'];

    console.log('📊 INDEXES CHECK:\n');
    
    for (const col of collections) {
      try {
        const indexes = await db.collection(col).getIndexes();
        console.log(`📋 ${col.toUpperCase()}:`);
        console.log(`   Total indexes: ${Object.keys(indexes).length}`);
        Object.entries(indexes).forEach(([name, spec]) => {
          console.log(`   - ${name}: ${JSON.stringify(spec.key)}`);
        });
        console.log('');
      } catch (err) {
        console.log(`❌ ${col}: Collection not found or error\n`);
      }
    }

    console.log('📈 COLLECTION STATISTICS:\n');
    
    for (const col of collections) {
      try {
        const collection = db.collection(col);
        const count = await collection.countDocuments();
        const stats = await db.collection(col).stats();
        
        const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
        const avgDocSize = Math.round(stats.size / count);
        
        console.log(`📊 ${col.toUpperCase()}:`);
        console.log(`   Documents: ${count}`);
        console.log(`   Size: ${sizeInMB} MB`);
        console.log(`   Avg doc size: ${avgDocSize} bytes`);
        console.log(`   Storage size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
        console.log('');
      } catch (err) {
        console.log(`⚠️ ${col}: Could not get stats\n`);
      }
    }

    console.log('🔧 CONNECTION POOL INFO:\n');
    console.log(`Connection State: ${mongoose.connection.readyState}`);
    console.log(`Connection URL: ${process.env.MONGO_URI ? '✅ Set' : '❌ Not set'}\n`);

    console.log('⚡ SAMPLE QUERIES (measuring performance):\n');
    
    // Test a few common queries
    const Post = require('../models/posts');
    const User = require('../models/users');
    
    try {
      const t1 = Date.now();
      const userCount = await User.countDocuments();
      console.log(`✅ User count query: ${Date.now() - t1}ms (${userCount} users)`);
    } catch (err) {
      console.log(`❌ User count query failed: ${err.message}`);
    }

    try {
      const t2 = Date.now();
      const postCount = await Post.countDocuments();
      console.log(`✅ Post count query: ${Date.now() - t2}ms (${postCount} posts)`);
    } catch (err) {
      console.log(`❌ Post count query failed: ${err.message}`);
    }

    try {
      const t3 = Date.now();
      const recentPosts = await Post.find().sort({ createdAt: -1 }).limit(10).lean();
      console.log(`✅ Recent posts query: ${Date.now() - t3}ms (${recentPosts.length} posts)`);
    } catch (err) {
      console.log(`❌ Recent posts query failed: ${err.message}`);
    }

    console.log('\n✅ Diagnostic complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Diagnostic Error:', error.message);
    process.exit(1);
  }
}

runDiagnostics();
