/**
 * Diagnostic Analysis Script
 * Identifies bottlenecks in recommendation system:
 * - Data quality issues
 * - Algorithm tightness problems
 * - User signal gaps
 */

const mongoose = require('mongoose');
const path = require('path');

// Load models
const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');
const RecommendationService = require('../services/recommendations').RecommendationService;

require('dotenv').config();
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/HeronProto';

/**
 * Data Quality Metrics
 */
async function dataQualityCheck() {
  console.log('\n📊 RUNNING DATA QUALITY CHECK...\n');
  
  try {
    const posts = await Post.find().lean();
    const users = await User.find().lean();
    const events = await Event.find().lean();
    
    // Calculate metrics
    const avgTagsPerPost = posts.length > 0 
      ? posts.reduce((sum, p) => sum + ((p.tags && Array.isArray(p.tags)) ? p.tags.length : 0), 0) / posts.length
      : 0;
    
    const avgLikesPerPost = posts.length > 0
      ? posts.reduce((sum, p) => sum + ((p.likes && Array.isArray(p.likes)) ? p.likes.length : 0), 0) / posts.length
      : 0;
    
    const avgInterestsPerUser = users.length > 0
      ? users.reduce((sum, u) => sum + ((u.interests && Array.isArray(u.interests)) ? u.interests.length : 0), 0) / users.length
      : 0;
    
    const avgLikedPerUser = users.length > 0
      ? users.reduce((sum, u) => sum + ((u.liked && Array.isArray(u.liked)) ? u.liked.length : 0), 0) / users.length
      : 0;
    
    const pctPostsWithTags = posts.length > 0
      ? (posts.filter(p => p.tags && Array.isArray(p.tags) && p.tags.length > 0).length / posts.length) * 100
      : 0;
    
    const pctUsersWithInterests = users.length > 0
      ? (users.filter(u => u.interests && Array.isArray(u.interests) && u.interests.length > 0).length / users.length) * 100
      : 0;
    
    const postsWithoutTags = posts.filter(p => !p.tags || !Array.isArray(p.tags) || p.tags.length === 0).length;
    const usersWithoutInterests = users.filter(u => !u.interests || !Array.isArray(u.interests) || u.interests.length === 0).length;
    
    // Events status check
    const eventStatusBreakdown = {
      upcoming: await Event.countDocuments({ status: 'upcoming' }),
      ongoing: await Event.countDocuments({ status: 'ongoing' }),
      completed: await Event.countDocuments({ status: 'completed' }),
      cancelled: await Event.countDocuments({ status: 'cancelled' }),
      null: await Event.countDocuments({ status: { $exists: false } })
    };
    
    const results = {
      posts: {
        total: posts.length,
        avgTagsPerPost: avgTagsPerPost.toFixed(2),
        avgLikesPerPost: avgLikesPerPost.toFixed(2),
        pctWithTags: pctPostsWithTags.toFixed(1),
        withoutTags: postsWithoutTags,
        assessment: pctPostsWithTags >= 95 ? '✅ GOOD' : '⚠️ NEEDS WORK'
      },
      users: {
        total: users.length,
        avgInterestsPerUser: avgInterestsPerUser.toFixed(2),
        avgLikedPerUser: avgLikedPerUser.toFixed(2),
        pctWithInterests: pctUsersWithInterests.toFixed(1),
        withoutInterests: usersWithoutInterests,
        assessment: pctUsersWithInterests >= 90 ? '✅ GOOD' : '⚠️ NEEDS WORK'
      },
      events: {
        total: events.length,
        statusBreakdown: eventStatusBreakdown,
        assessment: (eventStatusBreakdown.null === 0) ? '✅ GOOD' : '⚠️ NEEDS WORK'
      }
    };
    
    return results;
  } catch (error) {
    console.error('Error in dataQualityCheck:', error);
    return null;
  }
}

/**
 * Algorithm Tightness Metrics
 */
async function algorithmTightnessCheck() {
  console.log('\n⚙️ RUNNING ALGORITHM TIGHTNESS CHECK...\n');
  
  try {
    const users = await User.find().lean().limit(5); // Sample 5 users
    const posts = await Post.find().lean();
    const events = await Event.find().lean();
    
    const recommendations = [];
    
    // Generate recommendations for sampled users
    for (const user of users) {
      const userRecommendations = await RecommendationService.getHybridFeed(user._id, {
        limit: 10,
        type: 'all'
      });
      
      if (userRecommendations && Array.isArray(userRecommendations)) {
        userRecommendations.forEach(rec => {
          recommendations.push({
            userId: user._id,
            score: rec.finalScore || 0,
            type: rec.type || 'unknown'
          });
        });
      }
    }
    
    // Score distribution
    const scoreDistribution = {
      '0.0': recommendations.filter(r => r.score === 0).length,
      '0.0-0.1': recommendations.filter(r => r.score > 0 && r.score < 0.1).length,
      '0.1-0.3': recommendations.filter(r => r.score >= 0.1 && r.score < 0.3).length,
      '0.3-0.5': recommendations.filter(r => r.score >= 0.3 && r.score < 0.5).length,
      '0.5-0.7': recommendations.filter(r => r.score >= 0.5 && r.score < 0.7).length,
      '0.7-1.0': recommendations.filter(r => r.score >= 0.7).length
    };
    
    const nonZeroScores = recommendations.filter(r => r.score > 0);
    const avgNonZeroScore = nonZeroScores.length > 0
      ? (nonZeroScores.reduce((sum, r) => sum + r.score, 0) / nonZeroScores.length).toFixed(3)
      : 0;
    
    const pctZeroScores = recommendations.length > 0
      ? ((scoreDistribution['0.0'] / recommendations.length) * 100).toFixed(1)
      : 0;
    
    const pctLowScores = recommendations.length > 0
      ? ((scoreDistribution['0.0'] + scoreDistribution['0.0-0.1']) / recommendations.length) * 100
      : 0;
    
    const results = {
      totalRecommendations: recommendations.length,
      sampledUsers: users.length,
      pctZeroScores: pctZeroScores,
      avgNonZeroScore: avgNonZeroScore,
      pctLowScores: pctLowScores.toFixed(1),
      scoreDistribution: scoreDistribution,
      assessment: pctZeroScores <= 10 ? '✅ GOOD' : '⚠️ ALGORITHM TOO TIGHT'
    };
    
    return results;
  } catch (error) {
    console.error('Error in algorithmTightnessCheck:', error);
    return null;
  }
}

/**
 * User Signal Metrics
 */
async function userSignalCheck() {
  console.log('\n👥 RUNNING USER SIGNAL CHECK...\n');
  
  try {
    const users = await User.find().lean();
    
    const usersWithEngagement = users.filter(u => u.liked && Array.isArray(u.liked) && u.liked.length > 0);
    
    const avgInteractionsPerUser = users.length > 0
      ? (usersWithEngagement.reduce((sum, u) => sum + (u.liked ? u.liked.length : 0), 0) / users.length).toFixed(2)
      : 0;
    
    const avgInterestsPerActiveUser = usersWithEngagement.length > 0
      ? (usersWithEngagement.reduce((sum, u) => sum + ((u.interests && Array.isArray(u.interests)) ? u.interests.length : 0), 0) / usersWithEngagement.length).toFixed(2)
      : 0;
    
    const pctUsersWithZeroInteractions = users.length > 0
      ? (((users.length - usersWithEngagement.length) / users.length) * 100).toFixed(1)
      : 0;
    
    const avgEngagedUsers = users.length > 0 ? usersWithEngagement.length : 0;
    
    const results = {
      totalUsers: users.length,
      engagedUsers: avgEngagedUsers,
      avgInteractionsPerUser: avgInteractionsPerUser,
      pctUsersWithZeroInteractions: pctUsersWithZeroInteractions,
      avgInterestsPerActiveUser: avgInterestsPerActiveUser,
      assessment: avgInteractionsPerUser >= 2 ? '✅ GOOD' : '⚠️ SPARSE SIGNALS'
    };
    
    return results;
  } catch (error) {
    console.error('Error in userSignalCheck:', error);
    return null;
  }
}

/**
 * Main diagnostic runner
 */
async function runDiagnostics() {
  console.log('═'.repeat(60));
  console.log('🔍 RECOMMENDATION SYSTEM DIAGNOSTIC ANALYSIS');
  console.log('═'.repeat(60));
  
  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
    
    // Run diagnostics
    const dataQuality = await dataQualityCheck();
    const algorithmTightness = await algorithmTightnessCheck();
    const userSignal = await userSignalCheck();
    
    // Generate report
    console.log('\n' + '═'.repeat(60));
    console.log('📋 DIAGNOSTIC REPORT');
    console.log('═'.repeat(60));
    
    console.log('\n1️⃣ DATA QUALITY ASSESSMENT');
    console.log(JSON.stringify(dataQuality, null, 2));
    
    console.log('\n2️⃣ ALGORITHM TIGHTNESS ASSESSMENT');
    console.log(JSON.stringify(algorithmTightness, null, 2));
    
    console.log('\n3️⃣ USER SIGNAL ASSESSMENT');
    console.log(JSON.stringify(userSignal, null, 2));
    
    // Recommendations
    console.log('\n' + '═'.repeat(60));
    console.log('💡 RECOMMENDED PRIORITIES');
    console.log('═'.repeat(60));
    
    const priorities = [];
    
    if (dataQuality.posts.assessment.includes('NEEDS')) {
      priorities.push('🔴 PRIORITY 1: Fix Post Tags (Week 1 - Data Quality)');
    }
    
    if (dataQuality.users.assessment.includes('NEEDS')) {
      priorities.push('🔴 PRIORITY 1: Enrich User Interests (Week 1 - Data Quality)');
    }
    
    if (userSignal.assessment.includes('SPARSE')) {
      priorities.push('🔴 PRIORITY 1: Increase User Engagement Signals (Week 1 - Data Quality)');
    }
    
    if (algorithmTightness.assessment.includes('TOO TIGHT')) {
      priorities.push('🟠 PRIORITY 2: Loosen Algorithm Constraints (Week 2 - Algorithm)');
    }
    
    if (priorities.length === 0) {
      priorities.push('✅ All diagnostics look good! Consider fine-tuning performance weights.');
    }
    
    priorities.forEach(p => console.log(p));
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Diagnostic complete. See report above for next steps.');
    console.log('═'.repeat(60) + '\n');
    
    // Disconnect
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runDiagnostics();
}

module.exports = {
  dataQualityCheck,
  algorithmTightnessCheck,
  userSignalCheck
};
