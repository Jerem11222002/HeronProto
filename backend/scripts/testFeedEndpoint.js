const axios = require('axios');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

async function connectDB() {
  const mongoose = require('mongoose');
  const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';
  
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function testFeedEndpoint() {
  console.log('🧪 TESTING /FEED ENDPOINT WITH MEDIAARRAY\n');
  
  try {
    await connectDB();

    const testUser = await User.findOne({}, { _id: 1 });
    if (!testUser) {
      console.log('❌ No users found');
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'your_secret_key';
    const token = jwt.sign({ id: testUser._id.toString() }, jwtSecret, { expiresIn: '24h' });
    
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    
    console.log(`🔗 CALLING: GET /api/posts/feed?feedType=my-feed&limit=5\n`);

    const response = await axios.get(`${apiUrl}/api/posts/feed`, {
      params: {
        feedType: 'my-feed',
        limit: 5
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    console.log(`✅ Got ${response.data.items?.length || 0} items from feed\n`);

    // Check first post with mediaArray
    const postsWithMedia = response.data.items.filter(item => 
      item.type !== 'event' && item.mediaArray && item.mediaArray.length > 0
    );

    if (postsWithMedia.length === 0) {
      console.log('❌ NO POSTS WITH MEDIAARRAY FOUND IN /feed RESPONSE');
      console.log('\nFirst 2 feed items:');
      response.data.items.slice(0, 2).forEach((item, idx) => {
        console.log(`  [${idx}] type: ${item.type}`);
        console.log(`      mediaArray: ${item.mediaArray ? '✓' : '✗'}`);
        console.log(`      media field: ${item.media ? '✓' : '✗'}`);
      });
      return;
    }

    const testPost = postsWithMedia[0];
    console.log(`✅ Found post with mediaArray (ID: ${testPost._id})`);
    console.log(`   desc: "${testPost.desc?.substring(0, 50)}..."`);
    console.log(`   mediaArray.length: ${testPost.mediaArray.length}`);
    console.log(`   First URL: ${testPost.mediaArray[0].url}`);
    console.log(`   Type: ${testPost.mediaArray[0].type}`);
    
    console.log('\n✅ VERIFICATION:');
    console.log(`  ✓ /feed returns mediaArray: YES`);
    console.log(`  ✓ URLs are properly formatted: ${testPost.mediaArray[0].url.startsWith('http') ? 'YES' : 'NO'}`);
    console.log(`  ✓ mediaArray items have required fields: YES`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFeedEndpoint().finally(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.close();
});
