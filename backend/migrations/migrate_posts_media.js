/**
 * Migration Script: Normalize media fields for all posts and shared posts.
 * - Ensures every post has both `img` and `media` fields set to the filename (not a full path).
 * - Fixes legacy paths like `/uploads/filename` or `/backend/uploads/filename`.
 * - Also updates shared posts so that their referenced post has normalized media fields.
 * 
 * Usage:
 *   node migrate_posts_media.js
 */

const mongoose = require('mongoose');
const path = require('path');

// Update this to your actual MongoDB connection string
const MONGO_URI = 'mongodb://localhost:27017/YOUR_DB_NAME';

// Import your Post model
const Post = require('../models/posts');

function getFilename(val) {
  if (!val) return null;
  // Handles /uploads/filename, /backend/uploads/filename, or just filename
  return val.split(/[\/\\]/).pop();
}

async function migrate() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const posts = await Post.find({});
  let updated = 0;
  let sharedUpdated = 0;

  // First, normalize all posts' own media fields
  for (const post of posts) {
    let changed = false;

    // Normalize img and media fields to just the filename
    const imgFilename = getFilename(post.img);
    const mediaFilename = getFilename(post.media);

    // If media is missing but img exists
    if (!post.media && imgFilename) {
      post.media = imgFilename;
      changed = true;
    }
    // If img is missing but media exists
    if (!post.img && mediaFilename) {
      post.img = mediaFilename;
      changed = true;
    }
    // If img exists but is a path, normalize to filename
    if (post.img && post.img !== imgFilename) {
      post.img = imgFilename;
      changed = true;
    }
    // If media exists but is a path, normalize to filename
    if (post.media && post.media !== mediaFilename) {
      post.media = mediaFilename;
      changed = true;
    }

    // Optionally, handle other legacy fields (e.g., post.image)
    if (!post.img && post.image) {
      post.img = getFilename(post.image);
      changed = true;
    }
    if (!post.media && post.image) {
      post.media = getFilename(post.image);
      changed = true;
    }

    if (changed) {
      await post.save();
      updated++;
      console.log(`Updated post ${post._id}: img=${post.img}, media=${post.media}`);
    }
  }

  // Second, for posts with sharedPost, ensure the referenced post has normalized media fields
  for (const post of posts) {
    if (post.sharedPost) {
      let sharedChanged = false;
      const shared = await Post.findById(post.sharedPost);
      if (shared) {
        const imgFilename = getFilename(shared.img);
        const mediaFilename = getFilename(shared.media);

        if (!shared.media && imgFilename) {
          shared.media = imgFilename;
          sharedChanged = true;
        }
        if (!shared.img && mediaFilename) {
          shared.img = mediaFilename;
          sharedChanged = true;
        }
        if (shared.img && shared.img !== imgFilename) {
          shared.img = imgFilename;
          sharedChanged = true;
        }
        if (shared.media && shared.media !== mediaFilename) {
          shared.media = mediaFilename;
          sharedChanged = true;
        }
        if (!shared.img && shared.image) {
          shared.img = getFilename(shared.image);
          sharedChanged = true;
        }
        if (!shared.media && shared.image) {
          shared.media = getFilename(shared.image);
          sharedChanged = true;
        }
        if (sharedChanged) {
          await shared.save();
          sharedUpdated++;
          console.log(`Updated shared post ${shared._id}: img=${shared.img}, media=${shared.media}`);
        }
      }
    }
  }

  console.log(`Migration complete. Updated ${updated} posts and ${sharedUpdated} shared posts.`);
  await mongoose.disconnect();
  process.exit();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});