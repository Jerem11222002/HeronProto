const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');

async function reducePostsFromSeedUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔍 Analyzing posts...\n');
    
    // Get seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Get legacy users created in 2024 (keep their posts)
    const year2024Start = new Date('2024-01-01');
    const year2024End = new Date('2024-12-31T23:59:59');
    const users2024 = await User.find({
      email: { $not: { $regex: '@seed\\.local$' } },
      createdAt: { $gte: year2024Start, $lte: year2024End }
    });
    const users2024Ids = users2024.map(u => u._id);
    
    console.log('📊 Seed users found:', seedUserIds.length);
    console.log('📊 Legacy users from 2024 (protected):', users2024Ids.length);
    
    // Count posts from seed users
    const seedPostCount = await Post.countDocuments({ userId: { $in: seedUserIds } });
    console.log('📊 Posts from seed users:', seedPostCount);
    
    // Count posts from 2024 legacy users (protected)
    const posts2024LegacyCount = await Post.countDocuments({ userId: { $in: users2024Ids } });
    console.log('📊 Posts from 2024 legacy users (protected):', posts2024LegacyCount);
    
    // Count posts from pre-2024 legacy users (deletable)
    const prePostCount = await Post.countDocuments({ 
      userId: { $nin: [...seedUserIds, ...users2024Ids] } 
    });
    console.log('📊 Posts from pre-2024 legacy users (deletable):', prePostCount);
    
    const totalPosts = seedPostCount + posts2024LegacyCount + prePostCount;
    console.log('📊 Total posts:', totalPosts);
    
    // Calculate how many posts to delete
    const targetTotal = 1500;
    let postsToDelete = totalPosts - targetTotal;
    
    if (postsToDelete <= 0) {
      console.log('\n✅ Already at or below target of 1500 posts');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    console.log('\n🗑️  Need to delete', postsToDelete, 'posts\n');
    console.log('📝 Protected: All 2024 legacy user posts\n');
    
    let deletedCount = 0;
    
    // First, delete from pre-2024 legacy users
    if (postsToDelete > 0) {
      console.log('🗑️  Deleting from pre-2024 legacy users...');
      const deleteFromPre = await Post.deleteMany({
        userId: { $nin: [...seedUserIds, ...users2024Ids] }
      });
      deletedCount += deleteFromPre.deletedCount;
      postsToDelete -= deleteFromPre.deletedCount;
      console.log('  ✓ Deleted', deleteFromPre.deletedCount, 'posts');
    }
    
    // Then, delete from seed users if still needed
    if (postsToDelete > 0) {
      console.log('🗑️  Deleting from seed users...');
      const deleteFromSeed = await Post.deleteMany({
        userId: { $in: seedUserIds }
      });
      deletedCount += deleteFromSeed.deletedCount;
      postsToDelete -= deleteFromSeed.deletedCount;
      console.log('  ✓ Deleted', deleteFromSeed.deletedCount, 'posts');
    }
    
    console.log('\n✅ Total deleted:', deletedCount);
    
    // Verify final count
    const finalCount = await Post.countDocuments();
    console.log('📊 Final post count:', finalCount);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

reducePostsFromSeedUsers();
