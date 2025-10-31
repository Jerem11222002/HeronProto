/**
 * Migration script to recount and set the top-level `shares` field
 * for each post based on how many times it was shared (referenced as `sharedPost`).
 *
 * Usage:
 *   node backend/scripts/recount_post_shares.js
 */

const mongoose = require('mongoose');
const Post = require('../models/posts');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heronproto';

async function recountShares() {
  await mongoose.connect(MONGO_URI);

  const allPosts = await Post.find({}, '_id').lean();
  let updated = 0;

  for (const post of allPosts) {
    // Count how many posts reference this post as sharedPost
    const shareCount = await Post.countDocuments({ sharedPost: post._id });
    // Update the top-level shares field
    await Post.updateOne({ _id: post._id }, { $set: { shares: shareCount } });
    if (shareCount > 0) {
      console.log(`Post ${post._id}: shares set to ${shareCount}`);
      updated++;
    }
  }

  console.log(`Migration complete. Updated ${updated} posts with new share counts.`);
  await mongoose.disconnect();
}

recountShares().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});