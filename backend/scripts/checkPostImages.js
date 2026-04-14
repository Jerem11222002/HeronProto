const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function checkPostImages() {
  try {
    // Get recently created posts (those with 'writing', 'fashion', 'film' tags - our new ones)
    const newPosts = await Post.find({
      tags: { $in: ['writing', 'fashion', 'film', 'photogrammetry', 'sculpture'] }
    }).limit(10);

    console.log('\n📋 Checking newly created posts for images:\n');
    
    for (const post of newPosts) {
      console.log(`Post: "${post.title || post.desc?.substring(0, 30)}"`);
      console.log(`  Tags: ${post.tags?.join(', ')}`);
      console.log(`  media field: ${post.media ? '✅ SET' : '❌ EMPTY'} (${post.media})`);
      console.log(`  mediaType field: ${post.mediaType ? '✅ SET' : '❌ EMPTY'} (${post.mediaType})`);
      console.log(`  mediaArray: ${post.mediaArray?.length || 0} images`);
      
      if (post.mediaArray && post.mediaArray.length > 0) {
        console.log(`    First image: ${post.mediaArray[0].url?.substring(0, 60)}...`);
      }
      console.log('');
    }

    // Summary statistics
    const allPosts = await Post.find();
    const postsWithMediaArray = allPosts.filter(p => p.mediaArray && p.mediaArray.length > 0);
    const postsWithMedia = allPosts.filter(p => p.media);

    console.log('\n📊 DATABASE SUMMARY:\n');
    console.log(`Total posts: ${allPosts.length}`);
    console.log(`Posts with mediaArray: ${postsWithMediaArray.length} (${((postsWithMediaArray.length/allPosts.length)*100).toFixed(1)}%)`);
    console.log(`Posts with media field: ${postsWithMedia.length} (${((postsWithMedia.length/allPosts.length)*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  await connectDB();
  await checkPostImages();
}

main();
