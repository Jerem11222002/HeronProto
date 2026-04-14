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

async function checkOldPostsMediaStatus() {
  console.log('📊 CHECKING OLD POSTS MEDIA STATUS\n');
  
  try {
    // Find all seed users
    const seedUsers = await User.find({ email: { $regex: '@seed\\.local$' } });
    const seedUserIds = seedUsers.map(u => u._id);
    
    // Find posts from NON-SEED users (old users)
    const oldPosts = await Post.find({ userId: { $nin: seedUserIds } });
    console.log(`Total old posts from non-seed users: ${oldPosts.length}\n`);

    let stats = {
      hasMediaArray: 0,
      hasOnlyMedia: 0,
      noMediaAtAll: 0,
      hasCloudinaryUrl: 0,
      hasLocalFileName: 0,
      mediaArrayWithPicsum: 0,
      mediaArrayEmpty: 0
    };

    let samplePosts = {
      withMediaArray: [],
      withLocalFile: [],
      noMedia: []
    };

    for (const post of oldPosts) {
      // Check mediaArray status
      if (post.mediaArray && post.mediaArray.length > 0) {
        stats.hasMediaArray++;
        if (post.mediaArray.some(m => m.url.includes('picsum'))) {
          stats.mediaArrayWithPicsum++;
        }
        if (samplePosts.withMediaArray.length < 2) {
          samplePosts.withMediaArray.push({
            postId: post._id,
            title: post.title || post.desc?.substring(0, 40),
            mediaArray: post.mediaArray.map(m => ({ url: m.url.substring(0, 60), type: m.type }))
          });
        }
      } else if (post.mediaArray && post.mediaArray.length === 0) {
        stats.mediaArrayEmpty++;
      }

      // Check legacy media field
      if (post.media) {
        if (post.media.includes('cloudinary')) {
          stats.hasCloudinaryUrl++;
        } else if (post.media.includes('.jpg') || post.media.includes('.png') || post.media.includes('.gif')) {
          stats.hasLocalFileName++;
          if (samplePosts.withLocalFile.length < 2) {
            samplePosts.withLocalFile.push({
              postId: post._id,
              title: post.title || post.desc?.substring(0, 40),
              media: post.media
            });
          }
        }
      } else {
        stats.noMediaAtAll++;
        if (samplePosts.noMedia.length < 2) {
          samplePosts.noMedia.push({
            postId: post._id,
            title: post.title || post.desc?.substring(0, 40)
          });
        }
      }
    }

    console.log('📈 STATISTICS:');
    console.log(`  ✓ Posts with mediaArray: ${stats.hasMediaArray}`);
    console.log(`    └─ With Picsum URLs: ${stats.mediaArrayWithPicsum}`);
    console.log(`    └─ Empty mediaArray: ${stats.mediaArrayEmpty}`);
    console.log(`  ✓ Posts with legacy media field: ${stats.hasOnlyMedia} (no mediaArray)`);
    console.log(`    └─ Cloudinary URLs: ${stats.hasCloudinaryUrl}`);
    console.log(`    └─ Local filenames: ${stats.hasLocalFileName}`);
    console.log(`  ✓ Posts with NO media at all: ${stats.noMediaAtAll}\n`);

    if (samplePosts.withMediaArray.length > 0) {
      console.log('📸 SAMPLE POSTS WITH MEDIAARRAY:');
      samplePosts.withMediaArray.forEach(p => {
        console.log(`  Post ID: ${p.postId}`);
        console.log(`  Title: ${p.title}`);
        console.log(`  mediaArray:`);
        p.mediaArray.forEach(m => console.log(`    - ${m.url}... [${m.type}]`));
      });
      console.log('');
    }

    if (samplePosts.withLocalFile.length > 0) {
      console.log('📄 SAMPLE POSTS WITH LOCAL FILENAMES (BROKEN):');
      samplePosts.withLocalFile.forEach(p => {
        console.log(`  Post ID: ${p.postId}`);
        console.log(`  Title: ${p.title}`);
        console.log(`  media field: "${p.media}"`);
      });
      console.log('');
    }

    if (samplePosts.noMedia.length > 0) {
      console.log('❌ SAMPLE POSTS WITH NO MEDIA:');
      samplePosts.noMedia.forEach(p => {
        console.log(`  Post ID: ${p.postId}`);
        console.log(`  Title: ${p.title}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error checking posts:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

connectDB().then(() => checkOldPostsMediaStatus());
