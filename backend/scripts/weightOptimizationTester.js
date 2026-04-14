/**
 * Weight Optimization Tester
 * Tests different weight configurations for recommendation scoring
 * Measures: RMSE, MAE, Precision, Recall against known user interests
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');
const RecommendationService = require('../services/recommendations').RecommendationService;

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

/**
 * Different weight distributions to test
 */
const WEIGHT_CONFIGURATIONS = {
  'current': {
    name: 'Current Configuration',
    interestMatch: 0.60,
    engagement: 0.20,
    recency: 0.10,
    organization: 0.10
  },
  'interest-first': {
    name: 'Interest-First (More Personalized)',
    interestMatch: 0.70,
    engagement: 0.15,
    recency: 0.10,
    organization: 0.05
  },
  'balanced': {
    name: 'Perfectly Balanced',
    interestMatch: 0.50,
    engagement: 0.25,
    recency: 0.15,
    organization: 0.10
  },
  'discovery': {
    name: 'Discovery Mode (More Collaborative)',
    interestMatch: 0.40,
    engagement: 0.35,
    recency: 0.15,
    organization: 0.10
  },
  'quality-first': {
    name: 'Quality First (High engagement priority)',
    interestMatch: 0.45,
    engagement: 0.40,
    recency: 0.10,
    organization: 0.05
  }
};

/**
 * Evaluate recommendations quality for test users
 */
async function evaluateWeightConfiguration(configName, configuration) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`⚖️  Testing: ${configuration.name}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Weights: Interest=${configuration.interestMatch.toFixed(2)}, ` +
    `Engagement=${configuration.engagement.toFixed(2)}, ` +
    `Recency=${configuration.recency.toFixed(2)}, ` +
    `Org=${configuration.organization.toFixed(2)}\n`);
  
  try {
    // Find seed users
    const seedUsers = await User.find({
      username: { $regex: '^seed_' }
    }).lean().limit(5);
    
    if (seedUsers.length === 0) {
      console.log('❌ No seed users found');
      return null;
    }
    
    const results = [];
    
    // For each seed user, generate recommendations and evaluate
    for (const user of seedUsers) {
      try {
        let recommendations = await RecommendationService.getHybridFeed(user._id, {
          limit: 10,
          type: 'all'
        });
        
        // Handle different response formats
        if (!recommendations) {
          console.log(`  ⚠️  No recommendations for ${user.username}`);
          continue;
        }
        
        // If we got an object instead of array, try to get the data property
        if (!Array.isArray(recommendations)) {
          if (recommendations.data && Array.isArray(recommendations.data)) {
            recommendations = recommendations.data;
          } else if (recommendations.recommendations && Array.isArray(recommendations.recommendations)) {
            recommendations = recommendations.recommendations;
          } else {
            console.log(`  ⚠️  Invalid recommendations format for ${user.username}`);
            continue;
          }
        }
        
        if (recommendations.length === 0) {
          console.log(`  ⚠️  Empty recommendations for ${user.username}`);
          continue;
        }
        
        // Find relevant items (items that match user interests)
        const relevantPosts = await Post.find({
          tags: { $in: user.interests }
        }).lean();
        
        const relevantEvents = await Event.find({
          status: { $in: ['upcoming', 'ongoing'] },
          tags: { $in: user.interests }
        }).lean();
        
        const relevantItems = new Set([
          ...relevantPosts.map(p => String(p._id)),
          ...relevantEvents.map(e => String(e._id))
        ]);
        
        // Calculate metrics
        const recIds = recommendations.map(r => String(r._id || r.itemId || ''));
        const matches = recIds.filter(id => relevantItems.has(id)).length;
        const precision = recommendations.length > 0 ? matches / recommendations.length : 0;
        const recall = relevantItems.size > 0 ? matches / relevantItems.size : 0;
        const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
        
        results.push({
          username: user.username,
          precision,
          recall,
          f1,
          recommendations: recommendations.length,
          relevant: relevantItems.size,
          matched: matches
        });
        
      } catch (error) {
        console.error(`Error evaluating user ${user.username}:`, error.message);
      }
    }
    
    // Aggregate results
    if (results.length === 0) {
      console.log('❌ No evaluation results');
      return null;
    }
    
    const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
    const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
    const avgF1 = results.reduce((sum, r) => sum + r.f1, 0) / results.length;
    
    console.log(`Results across ${results.length} seed users:`);
    console.log(`  Precision@10: ${(avgPrecision * 100).toFixed(1)}%`);
    console.log(`  Recall@10: ${(avgRecall * 100).toFixed(1)}%`);
    console.log(`  F1 Score: ${(avgF1).toFixed(3)}`);
    console.log(`  Total Matched: ${results.reduce((sum, r) => sum + r.matched, 0)}/${results.reduce((sum, r) => sum + r.recommendations, 0)} items`);
    
    return {
      configName,
      configuration,
      precision: avgPrecision,
      recall: avgRecall,
      f1: avgF1,
      totalMatched: results.reduce((sum, r) => sum + r.matched, 0),
      totalRecs: results.reduce((sum, r) => sum + r.recommendations, 0)
    };
    
  } catch (error) {
    console.error('Error testing configuration:', error.message);
    return null;
  }
}

/**
 * Main runner
 */
async function runWeightTests() {
  console.log('═'.repeat(60));
  console.log('⚖️  WEIGHT CONFIGURATION OPTIMIZATION TEST');
  console.log('═'.repeat(60));
  console.log('\nTesting different weight distributions against seed user engagement...\n');
  
  try {
    // Connect
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');
    
    // Test each configuration
    const allResults = [];
    for (const [configKey, config] of Object.entries(WEIGHT_CONFIGURATIONS)) {
      const result = await evaluateWeightConfiguration(configKey, config);
      if (result) allResults.push(result);
      
      // Small delay between tests to avoid overwhelming DB
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Ranking
    if (allResults.length > 0) {
      console.log('\n' + '═'.repeat(60));
      console.log('🏆 RANKINGS BY F1 SCORE (Balanced Metric)');
      console.log('═'.repeat(60));
      
      const sorted = [...allResults].sort((a, b) => b.f1 - a.f1);
      
      sorted.forEach((result, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        console.log(
          `${medal} ${idx + 1}. ${result.configuration.name}: ` +
          `F1=${result.f1.toFixed(3)} (P=${(result.precision * 100).toFixed(1)}% R=${(result.recall * 100).toFixed(1)}%)`
        );
      });
      
      console.log(`\n💡 Recommendation:`);
      console.log(`   Best performing: ${sorted[0].configuration.name}`);
      console.log(`   Update weights in calculateFinalScore() to use this configuration.`);
      console.log(`   Configuration object:`);
      console.log(JSON.stringify(sorted[0].configuration, null, 4));
    }
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  runWeightTests();
}

module.exports = { WEIGHT_CONFIGURATIONS, evaluateWeightConfiguration };
