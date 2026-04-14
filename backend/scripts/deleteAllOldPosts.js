const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

async function connectDB() {
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

async function deleteAllOldPosts() {
  console.log('🗑️  DELETING ALL OLD POSTS FROM NON-SEED USERS\n');
  
  try {
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    console.log(`Found ${seedUsers.length} seed users\n`);
    
    // Delete all posts from non-seed users
    const result = await Post.deleteMany({ userId: { $nin: seedUserIds } });
    
    console.log(`✅ DELETED: ${result.deletedCount} old posts\n`);
    console.log(`📌 Next step: Run the seed scripts to generate fresh posts`);
    console.log(`   Command: node backend/scripts/postGenerator.js`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => deleteAllOldPosts());
