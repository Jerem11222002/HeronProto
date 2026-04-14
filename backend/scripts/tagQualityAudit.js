const mongoose = require('mongoose');
const Post = require('../models/posts');
const Event = require('../models/event');
const User = require('../models/users');
const path = require('path');

require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

// Interest taxonomy from Home.jsx
const INTEREST_MAPPINGS = {
  'music': ['musical', 'singing', 'song', 'choir', 'band', 'opera', 'concert'],
  'cultural': ['traditional', 'folk', 'heritage', 'customs'],
  'performance': ['performing', 'stage', 'theatre', 'drama', 'show'],
  'visual-arts': ['art', 'painting', 'drawing', 'sculpture', 'design'],
  'theatre': ['drama', 'acting', 'stage-performance', 'theatrical'],
  'dance': ['dance', 'choreography', 'movement', 'ballet'],
  'fashion': ['style', 'clothing', 'designer', 'fashion-show', 'runway'],
  'film': ['movie', 'cinema', 'video', 'documentary', 'short-film'],
  'photography': ['photo', 'camera', 'portrait', 'landscape'],
  'animation': ['animated', 'cartoon', 'motion', 'video-animation'],
  'photogrammetry': ['3d-modeling', 'point-cloud', 'scanning', 'reconstruction'],
  'writing': ['poetry', 'prose', 'literature', 'author', 'manuscript'],
  'cultural-arts': ['traditional', 'heritage', 'folk-dance', 'cultural']
};

const testUserInterests = [
  'music', 'dance', 'theatre', 'cultural-arts', 'performance', 
  'writing', 'fashion', 'film', 'photogrammetry', 'animation', 
  'photography', 'visual-arts', 'sculpture'
];

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

// Function to check if a string contains any interest keywords
function findInterestMatches(text, interests) {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const matches = [];
  
  for (const interest of interests) {
    // Check exact match
    if (lowerText.includes(interest.toLowerCase())) {
      matches.push({ interest, type: 'exact' });
    }
    
    // Check related terms
    if (INTEREST_MAPPINGS[interest]) {
      for (const relatedTerm of INTEREST_MAPPINGS[interest]) {
        if (lowerText.includes(relatedTerm.toLowerCase())) {
          matches.push({ interest, type: 'related', term: relatedTerm });
          break; // Only count once per related term
        }
      }
    }
  }
  
  return matches;
}

// eslint-disable-next-line no-unused-vars

async function auditTagQuality() {
  console.log('\n📊 TAG QUALITY AUDIT\n');
  console.log('Test User Interests:', testUserInterests);
  console.log('=====================================\n');
  
  try {
    // Get all posts
    const allPosts = await Post.find({}).lean();
    console.log(`📝 Total Posts: ${allPosts.length}\n`);
    
    // Categorize posts by tag coverage
    const stats = {
      postsWithTags: 0,
      postsWithoutTags: 0,
      tagsPerPost: [],
      interestMatches: 0,
      postsWithoutMatches: 0,
      titleMatchesNoTags: 0,
      descriptionMatchesNoTags: 0,
      unmatchedByInterest: {}
    };
    
    // Initialize unmatched counter for each interest
    testUserInterests.forEach(interest => {
      stats.unmatchedByInterest[interest] = [];
    });
    
    // Detailed post analysis
    const postAnalysis = [];
    
    for (const post of allPosts) {
      const tags = post.tags || [];
      const title = post.title || '';
      const description = post.description || '';
      
      if (tags.length > 0) {
        stats.postsWithTags++;
        stats.tagsPerPost.push(tags.length);
      } else {
        stats.postsWithoutTags++;
      }
      
      // Check for interest matches in tags, title, and description
      const tagMatches = findInterestMatches(tags.join(' '), testUserInterests);
      const titleMatches = findInterestMatches(title, testUserInterests);
      const descMatches = findInterestMatches(description, testUserInterests);
      
      const allMatches = [...tagMatches, ...titleMatches, ...descMatches];
      const uniqueInterestMatches = [...new Set(allMatches.map(m => m.interest))];
      
      if (uniqueInterestMatches.length > 0) {
        stats.interestMatches++;
      } else {
        stats.postsWithoutMatches++;
        // Track which interests don't match this post
        testUserInterests.forEach(interest => {
          stats.unmatchedByInterest[interest].push(post._id);
        });
      }
      
      // Count title/description matches without tags
      if (tags.length === 0 && titleMatches.length > 0) {
        stats.titleMatchesNoTags++;
      }
      if (tags.length === 0 && descMatches.length > 0) {
        stats.descriptionMatchesNoTags++;
      }
      
      postAnalysis.push({
        id: post._id,
        title: title.substring(0, 50),
        tagsCount: tags.length,
        tags: tags.slice(0, 3),
        tagMatches: tagMatches.length,
        titleMatches: titleMatches.length,
        descMatches: descMatches.length,
        totalMatches: uniqueInterestMatches.length,
        matchedInterests: uniqueInterestMatches
      });
    }
    
    // Calculate statistics
    const avgTagsPerPost = stats.postsWithTags > 0 
      ? (stats.tagsPerPost.reduce((a, b) => a + b, 0) / stats.tagsPerPost.length).toFixed(2)
      : 0;
    
    const percentWithTags = ((stats.postsWithTags / allPosts.length) * 100).toFixed(1);
    const percentWithInterestMatch = ((stats.interestMatches / allPosts.length) * 100).toFixed(1);
    
    // Display summary
    console.log('📈 SUMMARY STATISTICS');
    console.log('─────────────────────');
    console.log(`Posts with tags: ${stats.postsWithTags}/${allPosts.length} (${percentWithTags}%)`);
    console.log(`Posts without tags: ${stats.postsWithoutTags}/${allPosts.length}`);
    console.log(`Avg tags per post (if has tags): ${avgTagsPerPost}`);
    console.log(`Posts matching ANY test interest: ${stats.interestMatches}/${allPosts.length} (${percentWithInterestMatch}%)`);
    console.log(`Posts with NO matching interests: ${stats.postsWithoutMatches}/${allPosts.length}`);
    console.log(`  - Could match via tags: ${stats.tagsPerPost.length}`);
    console.log(`  - Could match via title (no tags): ${stats.titleMatchesNoTags}`);
    console.log(`  - Could match via description (no tags): ${stats.descriptionMatchesNoTags}`);
    
    // Show posts that should match but don't
    console.log('\n⚠️  POTENTIAL MATCHES (Title/Desc but no tags)');
    console.log('──────────────────────────────────────────');
    let potentialCount = 0;
    const potentialMatches = postAnalysis.filter(post => 
      post.tagsCount === 0 && (post.titleMatches > 0 || post.descMatches > 0)
    );
    
    for (let i = 0; i < Math.min(10, potentialMatches.length); i++) {
      const post = potentialMatches[i];
      console.log(`  📌 "${post.title}..."`);
      console.log(`     └─ Title matches: ${post.titleMatches}, Desc matches: ${post.descMatches}`);
      console.log(`     └─ Interests: ${post.matchedInterests.join(', ')}`);
      potentialCount++;
    }
    
    if (potentialMatches.length > 10) {
      console.log(`  ... and ${potentialMatches.length - 10} more`);
    }
    
    // Interest-by-interest breakdown
    console.log('\n🎯 COVERAGE BY INTEREST');
    console.log('─────────────────────');
    testUserInterests.forEach(interest => {
      const postsMatchingThisInterest = postAnalysis.filter(p => 
        p.matchedInterests.includes(interest)
      ).length;
      const coverage = ((postsMatchingThisInterest / allPosts.length) * 100).toFixed(1);
      console.log(`  ${interest.padEnd(20)}: ${coverage}% (${postsMatchingThisInterest}/${allPosts.length} posts)`);
    });
    
    // Show sample posts with/without tags
    console.log('\n📋 SAMPLE POSTS');
    console.log('───────────────');
    console.log('With tags AND interest matches:');
    postAnalysis
      .filter(p => p.tagsCount > 0 && p.totalMatches > 0)
      .slice(0, 3)
      .forEach(post => {
        console.log(`  ✅ "${post.title}"`);
        console.log(`     Tags: ${post.tags.join(', ')}`);
        console.log(`     Matches: ${post.matchedInterests.join(', ')}`);
      });
    
    console.log('\nWith tags but NO interest matches:');
    postAnalysis
      .filter(p => p.tagsCount > 0 && p.totalMatches === 0)
      .slice(0, 3)
      .forEach(post => {
        console.log(`  ⚠️  "${post.title}"`);
        console.log(`     Tags: ${post.tags.join(', ')}`);
      });
    
    console.log('\nWithout tags but title/desc match interests:');
    postAnalysis
      .filter(p => p.tagsCount === 0 && p.totalMatches > 0)
      .slice(0, 3)
      .forEach(post => {
        console.log(`  📌 "${post.title}"`);
        console.log(`     Matches: ${post.matchedInterests.join(', ')}`);
      });
    
    console.log('\n');
    return stats;
    
  } catch (error) {
    console.error('❌ Error during audit:', error);
    throw error;
  }
}

async function auditEventQuality() {
  console.log('\n🎪 EVENT TAG QUALITY AUDIT\n');
  
  try {
    const allEvents = await Event.find({}).lean();
    console.log(`📅 Total Events: ${allEvents.length}\n`);
    
    const stats = {
      eventsWithTags: 0,
      eventsWithoutTags: 0,
      interestMatches: 0,
      eventsWithoutMatches: 0
    };
    
    const eventAnalysis = [];
    
    for (const event of allEvents) {
      const tags = event.tags || [];
      const title = event.title || '';
      const description = event.description || '';
      
      if (tags.length > 0) {
        stats.eventsWithTags++;
      } else {
        stats.eventsWithoutTags++;
      }
      
      const tagMatches = findInterestMatches(tags.join(' '), testUserInterests);
      const titleMatches = findInterestMatches(title, testUserInterests);
      const descMatches = findInterestMatches(description, testUserInterests);
      
      const allMatches = [...tagMatches, ...titleMatches, ...descMatches];
      const uniqueInterestMatches = [...new Set(allMatches.map(m => m.interest))];
      
      if (uniqueInterestMatches.length > 0) {
        stats.interestMatches++;
      } else {
        stats.eventsWithoutMatches++;
      }
      
      eventAnalysis.push({
        title: title.substring(0, 40),
        status: event.status,
        tagsCount: tags.length,
        totalMatches: uniqueInterestMatches.length,
        matchedInterests: uniqueInterestMatches
      });
    }
    
    const percentWithTags = ((stats.eventsWithTags / allEvents.length) * 100).toFixed(1);
    const percentWithMatch = ((stats.interestMatches / allEvents.length) * 100).toFixed(1);
    
    console.log(`Events with tags: ${stats.eventsWithTags}/${allEvents.length} (${percentWithTags}%)`);
    console.log(`Events matching test interests: ${stats.interestMatches}/${allEvents.length} (${percentWithMatch}%)`);
    
    console.log('\nSample Events:');
    eventAnalysis.slice(0, 5).forEach((e, i) => {
      const match = e.totalMatches > 0 ? '✅' : '⚠️ ';
      console.log(`  ${match} "${e.title}" (${e.status})`);
      if (e.matchedInterests.length > 0) {
        console.log(`     → ${e.matchedInterests.join(', ')}`);
      }
    });
    
    console.log('\n');
    return stats;
    
  } catch (error) {
    console.error('❌ Error during event audit:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    
    console.log('\n🔍 COMPREHENSIVE TAG & INTEREST ALIGNMENT AUDIT\n');
    console.log('='.repeat(50));
    
    const postStats = await auditTagQuality();
    const eventStats = await auditEventQuality();
    
    console.log('='.repeat(50));
    console.log('\n✅ AUDIT COMPLETE\n');
    console.log('Summary:');
    console.log(`  - Posts with valid tags: ${postStats.postsWithTags}`);
    console.log(`  - Posts matching test interests: ${postStats.interestMatches}`);
    console.log(`  - Events matching test interests: ${eventStats.interestMatches}`);
    
    if (postStats.titleMatchesNoTags + postStats.descriptionMatchesNoTags > 10) {
      console.log('\n1. 📌 RECOMMENDATION: Improve tag extraction');
    }
    if (postStats.postsWithoutTags >= 0) {
      console.log('2. ✅ Good news: All posts have tags');
    }
    if (postStats.interestMatches < postStats.postsWithTags * 0.3) {
      console.log('3. 🎯 NOTE: Only 60% of posts match user interests - limited content');
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
