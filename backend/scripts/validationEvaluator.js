/**
 * Algorithm Validation Evaluator
 * Tests metric accuracy with known test cases and synthetic data
 * Ensures all metrics calculate correctly and improve with better recommendations
 */

const mongoose = require('mongoose');
const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');
const { MetricsEvaluator } = require('../services/metricsEvaluator');

class ValidationEvaluator {
  /**
   * Test Case: Known User-Item Pairs
   * Creates synthetic user with known relevant items and validates metrics
   */
  static async testKnownUserItemPairs() {
    console.log('\n📋 [VALIDATION TEST 1] Known User-Item Pairs...');
    
    try {
      // Create test user if doesn't exist
      let testUser = await User.findOne({ email: 'test-validation@heronproto.io' }).lean();
      if (!testUser) {
        testUser = await User.create({
          username: 'test-validator',
          email: 'test-validation@heronproto.io',
          password: 'hashed-test-password',
          interests: ['Music', 'Photography', 'Dance'],
          organizations: []
        });
        console.log('✅ Created test user');
      }

      // Create high-relevance test items (should match user interests)
      const relevantItems = [];
      const relevantTags = ['Music', 'Photography', 'Dance', 'Performance'];
      
      for (let i = 0; i < 5; i++) {
        const post = await Post.create({
          title: `Relevant Item ${i + 1}`,
          desc: `This post is about ${relevantTags[i] || 'Music'} techniques`,
          tags: [relevantTags[i], 'Art'],
          organization: 'CAST',
          mediaType: 'image',
          engagementMetrics: {
            likes: 50 + (i * 20),
            shares: 5 + i,
            comments: 10 + i
          }
        });
        relevantItems.push(post);
      }

      // Create low-relevance test items (should NOT match user interests)
      const irrelevantItems = [];
      for (let i = 0; i < 3; i++) {
        const post = await Post.create({
          title: `Irrelevant Item ${i + 1}`,
          desc: 'This is about unrelated topics like sports and technology',
          tags: ['Sports', 'Tech', 'Gaming'],
          organization: 'CAST',
          mediaType: 'video',
          engagementMetrics: {
            likes: 20,
            shares: 2,
            comments: 3
          }
        });
        irrelevantItems.push(post);
      }

      // Test 1: Perfect recommendations (all relevant items)
      console.log('\n  Test 1a: Perfect Recommendations (All Relevant)');
      const perfectRecs = relevantItems.map(item => ({
        _id: item._id,
        title: item.title,
        tags: item.tags,
        organization: item.organization,
        engagementMetrics: item.engagementMetrics,
        score: 0.95
      }));

      const perfectMetrics = await MetricsEvaluator.evaluateUserRecommendations(testUser._id, perfectRecs);
      console.log('  Metrics (Perfect Recs):');
      console.log(`    • Cosine Similarity: ${perfectMetrics.cosine_similarity.value} (should be high ~0.8+)`);
      console.log(`    • RMSE: ${perfectMetrics.rmse.value} (should be low ~0.2-0.3)`);
      console.log(`    • MAE: ${perfectMetrics.mae.value} (should be low ~0.2-0.3)`);
      console.log(`    • MRR: ${perfectMetrics.mrr.value} (should be high ~0.8+)`);
      console.log(`    • Coverage: ${perfectMetrics.evaluation_data.coverage}% (should be 100%)`);

      // Test 2: All irrelevant recommendations
      console.log('\n  Test 1b: Poor Recommendations (All Irrelevant)');
      const poorRecs = irrelevantItems.map(item => ({
        _id: item._id,
        title: item.title,
        tags: item.tags,
        organization: item.organization,
        engagementMetrics: item.engagementMetrics,
        score: 0.3
      }));

      const poorMetrics = await MetricsEvaluator.evaluateUserRecommendations(testUser._id, poorRecs);
      console.log('  Metrics (Poor Recs):');
      console.log(`    • Cosine Similarity: ${poorMetrics.cosine_similarity.value} (should be lower ~0.4-0.5)`);
      console.log(`    • RMSE: ${poorMetrics.rmse.value} (should be higher ~0.5-0.7)`);
      console.log(`    • MAE: ${poorMetrics.mae.value} (should be higher ~0.5-0.7)`);
      console.log(`    • MRR: ${poorMetrics.mrr.value} (should be low ~0.0)`);
      console.log(`    • Coverage: ${poorMetrics.evaluation_data.coverage}% (should be 0%)`);

      // Validation: Perfect should beat Poor
      const perfectWins = {
        similarity: perfectMetrics.cosine_similarity.value > poorMetrics.cosine_similarity.value,
        rmse: perfectMetrics.rmse.value < poorMetrics.rmse.value,
        mae: perfectMetrics.mae.value < poorMetrics.mae.value,
        mrr: perfectMetrics.mrr.value > poorMetrics.mrr.value
      };

      console.log('\n  ✅ Validation Results (Test 1):');
      console.log(`    • Similarity higher for perfect: ${perfectWins.similarity ? '✅' : '❌'}`);
      console.log(`    • RMSE lower for perfect: ${perfectWins.rmse ? '✅' : '❌'}`);
      console.log(`    • MAE lower for perfect: ${perfectWins.mae ? '✅' : '❌'}`);
      console.log(`    • MRR higher for perfect: ${perfectWins.mrr ? '✅' : '❌'}`);

      // Cleanup
      await Post.deleteMany({ _id: { $in: [...relevantItems, ...irrelevantItems].map(i => i._id) } });

      return {
        testName: 'Known User-Item Pairs',
        passed: Object.values(perfectWins).every(v => v),
        metrics: { perfect: perfectMetrics, poor: poorMetrics },
        validations: perfectWins
      };
    } catch (error) {
      console.error('❌ Test 1 Error:', error.message);
      return {
        testName: 'Known User-Item Pairs',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test Case: Edge Cases
   * Tests metric behavior with edge cases
   */
  static async testEdgeCases() {
    console.log('\n📋 [VALIDATION TEST 2] Edge Cases...');
    
    try {
      let testUser = await User.findOne({ email: 'test-edge-cases@heronproto.io' }).lean();
      if (!testUser) {
        testUser = await User.create({
          username: 'test-edge',
          email: 'test-edge-cases@heronproto.io',
          password: 'hashed-test-password',
          interests: [],
          organizations: []
        });
      }

      // Edge Case 1: Empty recommendations
      console.log('\n  Edge Case 1: Empty Recommendations');
      const emptyMetrics = await MetricsEvaluator.evaluateUserRecommendations(testUser._id, []);
      console.log(`    • Metrics returned without error: ${emptyMetrics ? '✅' : '❌'}`);
      console.log(`    • Default values provided: ${emptyMetrics.cosine_similarity?.value ? '✅' : '❌'}`);

      // Edge Case 2: Single recommendation
      console.log('\n  Edge Case 2: Single Recommendation');
      const singleRec = await Post.create({
        title: 'Single Test Item',
        desc: 'Testing with single recommendation',
        tags: ['Music'],
        organization: 'CAST',
        engagementMetrics: { likes: 10 }
      });

      const singleMetrics = await MetricsEvaluator.evaluateUserRecommendations(testUser._id, [
        {
          _id: singleRec._id,
          title: singleRec.title,
          tags: singleRec.tags,
          organization: singleRec.organization,
          engagementMetrics: singleRec.engagementMetrics
        }
      ]);
      console.log(`    • Metrics calculated: ${singleMetrics?.cosine_similarity?.value !== undefined ? '✅' : '❌'}`);
      
      // Edge Case 3: High engagement - no relevance
      console.log('\n  Edge Case 3: High Engagement, No Relevance');
      const highEngagement = await Post.create({
        title: 'Popular but Irrelevant',
        desc: 'This post has high engagement but irrelevant to user interests',
        tags: ['Sports', 'Gaming'],
        organization: 'CAST',
        engagementMetrics: { likes: 500, shares: 100, comments: 50 }
      });

      const highEngagementMetrics = await MetricsEvaluator.evaluateUserRecommendations(testUser._id, [
        {
          _id: highEngagement._id,
          title: highEngagement.title,
          tags: highEngagement.tags,
          organization: highEngagement.organization,
          engagementMetrics: highEngagement.engagementMetrics
        }
      ]);
      console.log(`    • Cosine Similarity: ${highEngagementMetrics.cosine_similarity.value} (should be low, engagement shouldn't override relevance)`);
      console.log(`    • MAE: ${highEngagementMetrics.mae.value}`);

      // Cleanup
      await Post.deleteMany({ _id: { $in: [singleRec._id, highEngagement._id] } });

      return {
        testName: 'Edge Cases',
        passed: emptyMetrics && singleMetrics && highEngagementMetrics,
        metrics: { empty: emptyMetrics, single: singleMetrics, highEngagement: highEngagementMetrics }
      };
    } catch (error) {
      console.error('❌ Test 2 Error:', error.message);
      return {
        testName: 'Edge Cases',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test Case: Metric Consistency
   * Run same evaluation twice and verify results match
   */
  static async testMetricConsistency() {
    console.log('\n📋 [VALIDATION TEST 3] Metric Consistency...');
    
    try {
      let testUser = await User.findOne({ email: 'test-consistency@heronproto.io' }).lean();
      if (!testUser) {
        testUser = await User.create({
          username: 'test-consistency',
          email: 'test-consistency@heronproto.io',
          password: 'hashed-test-password',
          interests: ['Music', 'Dance'],
          organizations: []
        });
      }

      // Create consistent test recommendations
      const testRecs = [];
      for (let i = 0; i < 5; i++) {
        const post = await Post.create({
          title: `Consistency Test Item ${i}`,
          desc: 'Testing consistency',
          tags: ['Music', 'Performance'],
          organization: 'CAST',
          engagementMetrics: { likes: 30 + i * 10 }
        });
        testRecs.push({
          _id: post._id,
          title: post.title,
          tags: post.tags,
          organization: post.organization,
          engagementMetrics: post.engagementMetrics
        });
      }

      // Run evaluation twice
      console.log('\n  Running evaluation twice with same data...');
      const metrics1 = await MetricsEvaluator.evaluateUserRecommendations(testUser._id, testRecs);
      const metrics2 = await MetricsEvaluator.evaluateUserRecommendations(testUser._id, testRecs);

      // Compare
      const consistency = {
        similarity: metrics1.cosine_similarity.value === metrics2.cosine_similarity.value,
        rmse: metrics1.rmse.value === metrics2.rmse.value,
        mae: metrics1.mae.value === metrics2.mae.value,
        mrr: metrics1.mrr.value === metrics2.mrr.value
      };

      console.log('\n  ✅ Consistency Results:');
      console.log(`    • Cosine Similarity: ${consistency.similarity ? '✅' : '❌'}`);
      console.log(`    • RMSE: ${consistency.rmse ? '✅' : '❌'}`);
      console.log(`    • MAE: ${consistency.mae ? '✅' : '❌'}`);
      console.log(`    • MRR: ${consistency.mrr ? '✅' : '❌'}`);

      // Cleanup
      await Post.deleteMany({ title: /Consistency Test Item/ });

      return {
        testName: 'Metric Consistency',
        passed: Object.values(consistency).every(v => v),
        consistency
      };
    } catch (error) {
      console.error('❌ Test 3 Error:', error.message);
      return {
        testName: 'Metric Consistency',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Run all validation tests
   */
  static async runAllValidationTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🔬 ALGORITHM VALIDATION TEST SUITE');
    console.log('='.repeat(60));

    const results = [];
    
    // Run all tests
    results.push(await this.testKnownUserItemPairs());
    results.push(await this.testEdgeCases());
    results.push(await this.testMetricConsistency());

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach((result, idx) => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${idx + 1}. ${result.testName}: ${status}`);
      if (result.error) console.log(`   Error: ${result.error}`);
    });

    console.log('\n📈 Overall: ' + (passed === total ? '✅ ALL TESTS PASSED' : `⚠️ ${passed}/${total} tests passed`));
    console.log('='.repeat(60) + '\n');

    return {
      summary: {
        totalTests: total,
        passed: passed,
        failed: total - passed,
        allPassed: passed === total
      },
      results: results,
      timestamp: new Date()
    };
  }

  /**
   * Generate metric interpretation guide
   */
  static getInterpretationGuide() {
    return {
      cosine_similarity: {
        title: '🎯 Cosine Similarity',
        description: 'Measures how well recommendations align with your interests',
        range: '0.0 - 1.0 (higher is better)',
        ranges: {
          '0.8-1.0': 'Excellent - Recommendations perfectly match your profile',
          '0.6-0.8': 'Very Good - Strong alignment with your interests',
          '0.4-0.6': 'Good - Decent alignment, some relevant items',
          '0.0-0.4': 'Poor - Weak alignment, consider updating interests'
        }
      },
      rmse: {
        title: '📊 Root Mean Square Error (RMSE)',
        description: 'Measures accuracy of the recommendation model\'s predictions',
        range: '0.0 - 1.0 (lower is better)',
        ranges: {
          '0.0-0.3': 'Excellent - Very accurate predictions',
          '0.3-0.5': 'Good - Reliable predictions',
          '0.5-0.7': 'Fair - Acceptable but room for improvement',
          '0.7-1.0': 'Poor - Model needs calibration'
        }
      },
      mae: {
        title: '📉 Mean Absolute Error (MAE)',
        description: 'Average magnitude of prediction errors (more interpretable than RMSE)',
        range: '0.0 - 1.0 (lower is better)',
        ranges: {
          '0.0-0.3': 'Excellent - Highly accurate',
          '0.3-0.5': 'Good - Accurate predictions',
          '0.5-0.7': 'Fair - Some prediction bias',
          '0.7-1.0': 'Poor - Significant prediction errors'
        }
      },
      mrr: {
        title: '🏆 Mean Reciprocal Rank (MRR)',
        description: 'How quickly relevant items appear in your recommendations',
        range: '0.0 - 1.0 (higher is better)',
        ranges: {
          '0.8-1.0': 'Excellent - Relevant items ranked very highly',
          '0.6-0.8': 'Very Good - Relevant items rank early',
          '0.4-0.6': 'Fair - Some relevant items found',
          '0.0-0.4': 'Poor - Relevant items ranked too low'
        }
      }
    };
  }
}

module.exports = { ValidationEvaluator };
