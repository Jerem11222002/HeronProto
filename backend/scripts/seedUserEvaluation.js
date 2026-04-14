/**
 * Seed User Evaluation Script
 * Tests recommendations quality for seed users with realistic engagement data
 * Measures: RMSE, MAE, Cosine Similarity, MRR, Precision, Recall
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');
const RecommendationService = require('../services/recommendations').RecommendationService;
const MetricsEvaluator = require('../services/metricsEvaluator');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

/**
 * Evaluate recommendations for a seed user
 */
async function evaluateSeedUser(user) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`👤 Evaluating: ${user.username} (${user.interests.join(', ')})`);
  console.log(`${'─'.repeat(60)}`);
  
  try {
    // Get recommendations
    const recommendations = await RecommendationService.getHybridFeed(user._id, {
      limit: 10,
      type: 'all'
    });
    
    if (!recommendations || recommendations.length === 0) {
      console.log('⚠️  No recommendations generated');
      return null;
    }
    
    console.log(`✅ Generated ${recommendations.length} recommendations`);
    
    // Find posts matching user interests
    const relevantPosts = await Post.find({
      tags: { $in: user.interests }
    }).lean();
    
    const relevantEvents = await Event.find({
      $and: [
        { status: { $in: ['upcoming', 'ongoing'] } },
        { tags: { $in: user.interests } }
      ]
    }).lean();
    
    const relevantItems = [...relevantPosts, ...relevantEvents];
    console.log(`📚 Found ${relevantItems.length} items matching interests (${relevantPosts.length} posts, ${relevantEvents.length} events)`);
    
    if (relevantItems.length === 0) {
      console.log('⚠️  No relevant items found for this user\'s interests');
      return null;
    }
    
    // Extract scores from recommendations
    const recScores = recommendations
      .filter(r => r.finalScore !== undefined && r.finalScore !== null)
      .map(r => r.finalScore || 0);
    
    // Calculate predicted engagement (binary relevance)
    const predictions = recommendations.map(rec => {
      const isRelevant = relevantItems.some(item => 
        String(item._id) === String(rec._id || rec.itemId)
      );
      return isRelevant ? 1 : 0;
    });
    
    // Actual engagement (items user liked/attended vs. items they didn't)
    const actual = Array(recommendations.length).fill(0);
    
    recommendations.forEach((rec, idx) => {
      const liked = user.liked && user.liked.some(id => String(id) === String(rec._id || rec.itemId));
      const attending = user.attending && user.attending.some(id => String(id) === String(rec._id || rec.itemId));
      if (liked || attending) actual[idx] = 1;
    });
    
    // Calculate metrics
    const metrics = {
      cosineSimilarity: recScores.length > 0 
        ? MetricsEvaluator.cosineSimilarity(recScores, predictions)
        : 0,
      rmse: recScores.length > 0 
        ? MetricsEvaluator.calculateRMSE(predictions, actual)
        : 0,
      mae: recScores.length > 0 
        ? MetricsEvaluator.calculateMAE(predictions, actual)
        : 0,
      mrr: predictions.some(p => p === 1)
        ? MetricsEvaluator.calculateMRR(recommendations.map((_, i) => i), 
            predictions.map((p, i) => p === 1 ? i : -1).filter(i => i >= 0))
        : 0
    };
    
    // Calculate precision and recall
    const truePositives = predictions.filter((p, i) => p === 1 && actual[i] === 1).length;
    const falsePositives = predictions.filter((p, i) => p === 1 && actual[i] === 0).length;
    const falseNegatives = predictions.filter((p, i) => p === 0 && actual[i] === 1).length;
    
    const precision = (truePositives + falsePositives) > 0 
      ? truePositives / (truePositives + falsePositives)
      : 0;
    const recall = (truePositives + falseNegatives) > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
    
    // Top recommendations
    const topRecs = recommendations.slice(0, 3).map(r => ({
      title: r.title || 'Unknown',
      score: (r.finalScore || 0).toFixed(2),
      isRelevant: relevantItems.some(item => String(item._id) === String(r._id || r.itemId)) ? '✅' : '❌'
    }));
    
    console.log(`\n📊 Metrics:`);
    console.log(`   Cosine Similarity: ${metrics.cosineSimilarity.toFixed(3)} (target > 0.75)`);
    console.log(`   RMSE: ${metrics.rmse.toFixed(3)} (target < 0.35)`);
    console.log(`   MAE: ${metrics.mae.toFixed(3)} (target < 0.30)`);
    console.log(`   MRR: ${metrics.mrr.toFixed(3)} (target > 0.70)`);
    console.log(`   Precision@10: ${(precision * 100).toFixed(1)}%`);
    console.log(`   Recall@10: ${(recall * 100).toFixed(1)}%`);
    
    console.log(`\n🏆 Top 3 Recommendations:`);
    topRecs.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec.title} | Score: ${rec.score} | ${rec.isRelevant}`);
    });
    
    return {
      username: user.username,
      interests: user.interests,
      recommendationsCount: recommendations.length,
      relevantItemsCount: relevantItems.length,
      metrics,
      precision,
      recall
    };
  } catch (error) {
    console.error('❌ Error evaluating user:', error.message);
    return null;
  }
}

/**
 * Main evaluation runner
 */
async function evaluateSeedUsers() {
  console.log('═'.repeat(60));
  console.log('🧪 SEED USER RECOMMENDATION EVALUATION');
  console.log('═'.repeat(60));
  
  try {
    // Connect
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected\n');
    
    // Find seed users
    const seedUsers = await User.find({
      username: { $regex: '^seed_' }
    }).lean();
    
    if (seedUsers.length === 0) {
      console.log('❌ No seed users found. Run seedDataGenerator.js first.');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`📋 Found ${seedUsers.length} seed users\n`);
    
    // Evaluate each seed user
    const results = [];
    for (const user of seedUsers) {
      const result = await evaluateSeedUser(user);
      if (result) results.push(result);
    }
    
    // Summary
    if (results.length > 0) {
      console.log('\n' + '═'.repeat(60));
      console.log('📊 OVERALL SUMMARY');
      console.log('═'.repeat(60));
      
      const avgMetrics = {
        cosine: results.reduce((sum, r) => sum + r.metrics.cosineSimilarity, 0) / results.length,
        rmse: results.reduce((sum, r) => sum + r.metrics.rmse, 0) / results.length,
        mae: results.reduce((sum, r) => sum + r.metrics.mae, 0) / results.length,
        mrr: results.reduce((sum, r) => sum + r.metrics.mrr, 0) / results.length,
        precision: results.reduce((sum, r) => sum + r.precision, 0) / results.length,
        recall: results.reduce((sum, r) => sum + r.recall, 0) / results.length
      };
      
      console.log(`\n📈 Average Metrics Across ${results.length} Seed Users:`);
      console.log(`   Cosine Similarity: ${avgMetrics.cosine.toFixed(3)} ${avgMetrics.cosine > 0.75 ? '✅' : '⚠️'} (target > 0.75)`);
      console.log(`   RMSE: ${avgMetrics.rmse.toFixed(3)} ${avgMetrics.rmse < 0.35 ? '✅' : '⚠️'} (target < 0.35)`);
      console.log(`   MAE: ${avgMetrics.mae.toFixed(3)} ${avgMetrics.mae < 0.30 ? '✅' : '⚠️'} (target < 0.30)`);
      console.log(`   MRR: ${avgMetrics.mrr.toFixed(3)} ${avgMetrics.mrr > 0.70 ? '✅' : '⚠️'} (target > 0.70)`);
      console.log(`   Precision@10: ${(avgMetrics.precision * 100).toFixed(1)}% ✅`);
      console.log(`   Recall@10: ${(avgMetrics.recall * 100).toFixed(1)}% ✅`);
      
      console.log(`\n💡 Interpretation:`);
      const issues = [];
      if (avgMetrics.cosine < 0.75) issues.push('- Cosine Similarity too low (interest alignment weak)');
      if (avgMetrics.rmse > 0.35) issues.push('- RMSE too high (predictions inaccurate)');
      if (avgMetrics.mae > 0.30) issues.push('- MAE too high (average error too large)');
      if (avgMetrics.mrr < 0.70) issues.push('- MRR too low (relevant items ranked too low)');
      
      if (issues.length === 0) {
        console.log('✅ All metrics are in good range!');
      } else {
        console.log('⚠️  Issues detected:');
        issues.forEach(issue => console.log(`   ${issue}`));
      }
    }
    
    console.log('\n✅ Evaluation complete.\n');
    
    // Disconnect
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if main
if (require.main === module) {
  evaluateSeedUsers();
}

module.exports = { evaluateSeedUser };
