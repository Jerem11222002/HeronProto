require('dotenv').config(); // <-- Add this line at the very top

const mongoose = require('mongoose');
const Post = require('../models/posts');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heronproto';

async function fixSharedPosts() {
  await mongoose.connect(MONGO_URI);

  const posts = await Post.find({ sharedPost: { $type: 'object' } });
  let updated = 0;

  for (const post of posts) {
    if (post.sharedPost && post.sharedPost._id) {
      post.sharedPost = post.sharedPost._id;
      await post.save();
      updated++;
      console.log(`Fixed post ${post._id}: set sharedPost to ${post.sharedPost}`);
    }
  }

  console.log(`Migration complete. Updated ${updated} posts.`);
  await mongoose.disconnect();
}

fixSharedPosts().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});