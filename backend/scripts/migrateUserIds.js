const mongoose = require('mongoose');
const Post = require('../models/posts');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/herondb';

const migrateUserIds = async () => {
  try {
    console.log('Finding posts with string userIds...');
    const posts = await Post.find({ userId: { $type: 'string' } });
    console.log(`Found ${posts.length} posts to migrate`);

    if (posts.length === 0) {
      console.log('No posts need migration');
      return;
    }

    let succeeded = 0;
    let failed = 0;

    for (const post of posts) {
      try {
        await Post.updateOne(
          { _id: post._id },
          { $set: { userId: new mongoose.Types.ObjectId(post.userId) } }
        );
        succeeded++;
        console.log(`Migrated post ${post._id} (${succeeded}/${posts.length})`);
      } catch (error) {
        failed++;
        console.error(`Failed to migrate post ${post._id}:`, error.message);
      }
    }

    console.log('\nMigration Summary:');
    console.log(`Total posts processed: ${posts.length}`);
    console.log(`Successfully migrated: ${succeeded}`);
    console.log(`Failed to migrate: ${failed}`);

  } catch (error) {
    console.error('Migration failed:', error.message);
  }
};

// Remove deprecated options
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    return migrateUserIds();
  })
  .catch(error => {
    console.error('Failed to connect to MongoDB:', error.message);
  })
  .finally(() => {
    mongoose.disconnect();
  });