const mongoose = require('mongoose');
const Post = require('../models/posts');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/HeronProto';

async function debug() {
  try {
    console.log('Connecting...');
    await mongoose.connect(MONGODB_URI);
    
    // Get a sample post
    const post = await Post.findOne().lean();
    
    if (!post) {
      console.log('No posts found');
      process.exit(0);
    }
    
    console.log('\n📋 Sample Post Structure:');
    console.log('_id:', post._id);
    console.log('title:', post.title);
    console.log('media exists:', !!post.media, 'value:', typeof post.media === 'string' ? post.media.substring(0, 80) : post.media);
    console.log('mediaType:', post.mediaType);
    console.log('mediaArray exists:', !!post.mediaArray);
    console.log('mediaArray length:', Array.isArray(post.mediaArray) ? post.mediaArray.length : 'N/A');
    
    if (post.mediaArray && Array.isArray(post.mediaArray)) {
      console.log('First mediaArray item:', JSON.stringify(post.mediaArray[0], null, 2));
    }
    
    // Count posts by field existence
    const stats = await Post.aggregate([
      {
        $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          withMedia: { $sum: { $cond: [{ $ne: ['$media', null] }, 1, 0] } },
          withMediaArray: { $sum: { $cond: [{ $ne: ['$mediaArray', null] }, 1, 0] } },
          withMediaArrayNotEmpty: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$mediaArray', []] } }, 0] }, 1, 0] } }
        }
      }
    ]);
    
    console.log('\n📊 Database Stats:');
    console.log(JSON.stringify(stats[0], null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

debug();
