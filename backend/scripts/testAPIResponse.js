const axios = require('axios');
const path = require('path');
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
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function testAPIResponse() {
  console.log('🧪 TESTING API RESPONSE FOR OLD POSTS\n');
  
  try {
    await connectDB();

    // Get first old post from non-seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    const oldPosts = await Post.find({ userId: { $nin: seedUserIds }, mediaArray: { $exists: true, $ne: [] } })
      .limit(1);

    if (oldPosts.length === 0) {
      console.log('❌ No old posts with mediaArray found');
      return;
    }

    const testPost = oldPosts[0];
    console.log('📧 TEST POST FROM DATABASE:');
    console.log(`  Post ID: ${testPost._id}`);
    console.log(`  Title: ${testPost.title || testPost.desc?.substring(0, 40)}`);
    console.log(`  mediaArray: ${JSON.stringify(testPost.mediaArray, null, 2)}`);
    console.log(`  media field: "${testPost.media}"\n`);

    // Test the API endpoint
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    const testUserId = testPost.userId.toString();
    
    console.log(`🔗 CALLING API: ${apiUrl}/api/posts/user/${testUserId}`);

    try {
      const response = await axios.get(`${apiUrl}/api/posts/user/${testUserId}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      const returnedPost = response.data.find(p => p._id === testPost._id.toString());
      
      if (!returnedPost) {
        console.log('❌ Post not found in API response\n');
        console.log('Available posts:', response.data.map(p => ({ id: p._id, desc: p.desc?.substring(0, 30) })));
        return;
      }

      console.log('\n✅ POST FROM API RESPONSE:');
      console.log(`  Post ID: ${returnedPost._id}`);
      console.log(`  Title/Desc: ${returnedPost.desc?.substring(0, 40)}`);
      console.log('  mediaArray field present:', !!returnedPost.mediaArray);
      console.log('  mediaArray length:', returnedPost.mediaArray?.length || 0);
      if (returnedPost.mediaArray && returnedPost.mediaArray.length > 0) {
        console.log('  mediaArray content:');
        returnedPost.mediaArray.slice(0, 2).forEach((item, idx) => {
          console.log(`    [${idx}] url: ${item.url?.substring(0, 60)}...`);
        });
      }
      console.log(`  media field: "${returnedPost.media}"\n`);

      console.log('🔍 COMPARISON:');
      console.log(`  DB mediaArray length: ${testPost.mediaArray?.length || 0}`);
      console.log(`  API mediaArray length: ${returnedPost.mediaArray?.length || 0}`);
      console.log(`  mediaArray matches: ${JSON.stringify(testPost.mediaArray) === JSON.stringify(returnedPost.mediaArray) ? '✓' : '✗'}`);

    } catch (apiError) {
      console.error('❌ API call failed:', apiError.message);
      if (apiError.response?.status === 500) {
        console.log('Response:', apiError.response.data);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPIResponse().finally(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  console.log('✅ Database connection closed');
});
