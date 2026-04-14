/**
 * Delete old posts from niche interest users
 * These will be replaced with posts that have recent dates
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');
const User = require('../models/users');

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

async function deleteOldPosts() {
  const nicheUserNames = [
    'Alex Chen', 'Maya Patel', 'Jordan Ross',
    'Casey Williams', 'Sam Liu', 'Riley Thompson',
    'Morgan Blake', 'Kenji Nakamura', 'Sophie Laurent',
    'Emma Rodriguez', 'Aditya Kumar', 'Grace Morrison'
  ];

  console.log('🗑️  DELETING OLD POSTS FROM NICHE INTEREST USERS\n');

  try {
    let totalDeleted = 0;

    for (const userName of nicheUserNames) {
      // Find user
      const user = await User.findOne({ name: userName });
      if (!user) {
        console.log(`⚠️  User ${userName} not found, skipping...`);
        continue;
      }

      // Delete posts from this user
      const result = await Post.deleteMany({ userId: user._id });
      
      if (result.deletedCount > 0) {
        console.log(`✓ Deleted ${result.deletedCount} posts from ${userName}`);
        totalDeleted += result.deletedCount;
      }
    }

    console.log(`\n✅ Total posts deleted: ${totalDeleted}`);
    console.log('\n📝 Next step: Run seedNicheInterestUsers.js again to create posts with recent dates\n');
  } catch (error) {
    console.error('❌ Error deleting posts:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => deleteOldPosts());
