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

async function backfillMediaFields() {
  console.log('\n🔄 BACKFILLING media FIELDS FROM mediaArray\n');

  try {
    // Find all posts with mediaArray but no media field
    const posts = await Post.find({
      mediaArray: { $exists: true, $ne: [] },
      $or: [
        { media: null },
        { media: { $exists: false } }
      ]
    });

    console.log(`Found ${posts.length} posts with mediaArray but empty media field\n`);

    let updated = 0;

    for (const post of posts) {
      try {
        if (post.mediaArray && post.mediaArray.length > 0) {
          // Clean the URL to remove query parameters for validation
          // Picsum still serves reliably without the query params
          let mediaUrl = post.mediaArray[0].url;
          mediaUrl = mediaUrl.split('?')[0]; // Remove query params
          
          // Set media to first image URL (cleaned)
          post.media = mediaUrl;
          
          // Set mediaType to 'image'
          post.mediaType = 'image';
          
          // Ensure mediaCount is set
          if (!post.mediaCount) {
            post.mediaCount = post.mediaArray.length;
          }
          
          // Also clean URLs in mediaArray
          post.mediaArray = post.mediaArray.map(m => ({
            ...m,
            url: m.url.split('?')[0],
            thumbnail: m.thumbnail?.split('?')[0]
          }));
          
          await post.save();
          
          const postTitle = post.title || post.desc?.substring(0, 30) || 'Untitled';
          console.log(`✓ "${postTitle.substring(0, 40).padEnd(40)}" → media set + URLs cleaned`);
          updated++;
        }
      } catch (error) {
        console.error(`✗ Error updating post ${post._id}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n✅ Updated ${updated} posts with media fields`);
    console.log(`\n📝 Posts now have:`);
    console.log(`   • media: URL to first image (cleaned URLs)`);
    console.log(`   • mediaType: 'image'`);
    console.log(`   • mediaArray: Full gallery images (cleaned URLs)`);
    console.log(`\n✨ Images should now display in the UI!\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  await connectDB();
  await backfillMediaFields();
}

main();
