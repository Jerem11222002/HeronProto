/**
 * Data Migration - Fix Missing Tags on Posts
 * Run: node backend/scripts/fixPostTags.js
 * 
 * This script:
 * 1. Finds posts without tags
 * 2. Extracts tags from description, title, or media type
 * 3. Updates database with generated tags
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');
const TagExtractor = require('../utils/tagExtractor');

let fixedCount = 0;
let skippedCount = 0;
let errorCount = 0;

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/heron';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }
}

async function fixPostTags() {
  try {
    console.log('🔍 Finding posts without tags...');
    const postsWithoutTags = await Post.find({
      $or: [
        { tags: { $eq: null } },
        { tags: { $size: 0 } }
      ]
    }).lean();

    console.log(`📝 Found ${postsWithoutTags.length} posts without tags\n`);
    console.log('━'.repeat(70));

    for (let i = 0; i < postsWithoutTags.length; i++) {
      const post = postsWithoutTags[i];
      console.log(`\n[${i + 1}/${postsWithoutTags.length}] Processing post: ${post._id}`);

      try {
        let generatedTags = [];

        // Strategy 1: Extract from description
        if (post.desc && post.desc.trim().length > 0) {
          generatedTags = TagExtractor.extractFromDescription(post.desc);
          console.log(`   📋 Extracted from description: [${generatedTags.slice(0, 3).join(', ')}...]`);
        }

        // Strategy 2: Use fallback if no tags generated
        if (generatedTags.length === 0) {
          generatedTags = TagExtractor.generateFallbackTags({
            organization: post.organization,
            mediaType: post.mediaType,
            contentType: post.contentType
          });
          console.log(`   🔄 Used fallback strategy: [${generatedTags.join(', ')}]`);
        }

        // Strategy 3: If still no tags, use media type or generic
        if (generatedTags.length === 0) {
          if (post.mediaType) {
            generatedTags = [post.mediaType, 'content'];
          } else {
            generatedTags = ['general', 'post'];
          }
          console.log(`   ⚠️  Using minimal tags: [${generatedTags.join(', ')}]`);
        }

        // Update the post
        await Post.findByIdAndUpdate(
          post._id,
          { tags: generatedTags },
          { new: true }
        );

        console.log(`   ✅ Updated with ${generatedTags.length} tags`);
        fixedCount++;

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '━'.repeat(70));
    console.log(`\n✅ MIGRATION COMPLETE:`);
    console.log(`   ✓ Fixed:   ${fixedCount} posts`);
    console.log(`   ✗ Errors:  ${errorCount} posts`);
    console.log(`   ⏭️  Skipped: ${skippedCount} posts\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function main() {
  try {
    await connectDB();
    await fixPostTags();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

main();
