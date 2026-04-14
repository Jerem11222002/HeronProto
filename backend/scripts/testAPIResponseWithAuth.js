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
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function testAPIResponseWithAuth() {
  console.log('🧪 TESTING API RESPONSE WITH AUTHENTICATION\n');
  
  try {
    await connectDB();

    // Get a test user to make requests as
    const testUser = await User.findOne({}, { _id: 1 });
    if (!testUser) {
      console.log('❌ No users found in database');
      return;
    }

    // Create a test JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your_secret_key';
    const token = jwt.sign(
      { id: testUser._id.toString() },
      jwtSecret,
      { expiresIn: '24h' }
    );

    console.log(`Created token for user ${testUser._id}\n`);

    // Get first old post from non-seed users with mediaArray
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
    console.log(`  mediaArray count: ${testPost.mediaArray?.length || 0}`);
    console.log(`  First mediaArray URL: ${testPost.mediaArray?.[0]?.url?.substring(0, 60)}...\n`);

    // Test the API endpoint with authentication
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    const testUserId = testPost.userId.toString();
    
    console.log(`🔗 CALLING API: GET /api/posts/user/${testUserId}`);
    console.log(`   With Authorization: Bearer ${token.substring(0, 20)}...\n`);

    try {
      const response = await axios.get(`${apiUrl}/api/posts/user/${testUserId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const returnedPost = response.data.find(p => p._id === testPost._id.toString());
      
      if (!returnedPost) {
        console.log('❌ Post not found in API response');
        console.log('Available posts:', response.data.slice(0, 2).map(p => ({ id: p._id, desc: p.desc?.substring(0, 30) })));
        return;
      }

      console.log('✅ POST FROM API RESPONSE:');
      console.log(`  Post ID: ${returnedPost._id}`);
      console.log(`  mediaArray present: ${!!returnedPost.mediaArray}`);
      console.log(`  mediaArray length: ${returnedPost.mediaArray?.length || 0}`);
      
      if (returnedPost.mediaArray && returnedPost.mediaArray.length > 0) {
        console.log(`\n  First 2 mediaArray items:`);
        returnedPost.mediaArray.slice(0, 2).forEach((item, idx) => {
          console.log(`    [${idx}] url: ${item.url}`);
          console.log(`         type: ${item.type}`);
        });
      }
      
      console.log(`\n  Legacy media field: "${returnedPost.media}"\n`);

      console.log('🔍 VERIFICATION:');
      console.log(`  ✓ API returned mediaArray: ${!!returnedPost.mediaArray}`);
      console.log(`  ✓ mediaArray has items: ${(returnedPost.mediaArray?.length || 0) > 0}`);
      console.log(`  ✓ First URL is Picsum: ${returnedPost.mediaArray?.[0]?.url?.includes('picsum.photos')}`);
      console.log(`  ✓ URLs are absolute (not /uploads/): ${returnedPost.mediaArray?.[0]?.url?.startsWith('http')}`);

    } catch (apiError) {
      console.error('❌ API call failed:');
      console.error(`   Status: ${apiError.response?.status}`);
      console.error(`   Message: ${apiError.message}`);
      if (apiError.response?.data) {
        console.error(`   Response: ${JSON.stringify(apiError.response.data).substring(0, 200)}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPIResponseWithAuth().finally(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  console.log('\n✅ Database connection closed');
});
