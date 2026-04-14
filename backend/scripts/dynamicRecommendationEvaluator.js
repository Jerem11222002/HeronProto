/**
 * Single User Recommendation Evaluator
 * Generates recommendations for a specific user with ISO 25010 metrics
 */

const mongoose = require('mongoose');
const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');
const { RecommendationService } = require('../services/recommendations');
const db = require('../config/db');

// ISO 25010 Functional Suitability Metrics Calculator
class ISO25010FunctionalSuitability {
  /**
   * Calculate Functional Completeness
   * Degree to which all user interests are covered in recommendations
   */
  static calculateCompleteness(userInterests, recommendedItems) {
    if (!userInterests || userInterests.length === 0) return 0;

    const coveredInterests = new Set();
    
    recommendedItems.forEach(item => {
      const itemTags = item.tags || [];
      const itemOrg = item.organization || '';
      
      userInterests.forEach(interest => {
        const interestLower = interest.toLowerCase();
        if (
          itemTags.some(t => t.toLowerCase().includes(interestLower)) ||
          interestLower.includes(itemOrg.toLowerCase())
        ) {
          coveredInterests.add(interest);
        }
      });
    });

    return (coveredInterests.size / userInterests.length) * 100;
  }

  /**
   * Calculate Functional Correctness
   * Degree to which recommended items are actually relevant to user
   */
  static calculateCorrectness(userInterests, recommendedItems) {
    if (recommendedItems.length === 0) return 0;

    let correctCount = 0;

    recommendedItems.forEach(item => {
      const itemTags = item.tags || [];
      const itemOrg = item.organization || '';

      const isCorrect = userInterests.some(interest => {
        const interestLower = interest.toLowerCase();
        return (
          itemTags.some(t => t.toLowerCase().includes(interestLower)) ||
          interestLower.includes(itemOrg.toLowerCase())
        );
      });

      if (isCorrect) correctCount++;
    });

    return (correctCount / recommendedItems.length) * 100;
  }

  /**
   * Calculate Functional Appropriateness
   * Degree to which functions facilitate accomplishment of user's goals
   * Based on engagement potential and content quality
   */
  static calculateAppropriateness(recommendedItems) {
    if (recommendedItems.length === 0) return 0;

    let appropriatenessScore = 0;

    recommendedItems.forEach(item => {
      const hasEngagement = item.engagementMetrics && 
                           (item.engagementMetrics.likes > 0 || 
                            item.engagementMetrics.views > 0);
      const hasMedia = item.mediaType || item.type;
      const hasDescription = item.desc || item.description;

      let score = 0;
      if (hasEngagement) score += 30; // Engagement signals quality
      if (hasMedia) score += 35; // Media content is more engaging
      if (hasDescription) score += 35; // Good documentation

      appropriatenessScore += score;
    });

    return appropriatenessScore / (recommendedItems.length * 100);
  }

  /**
   * Run complete ISO 25010 evaluation
   */
  static evaluateRecommendations(userInterests, recommendedItems) {
    const completeness = this.calculateCompleteness(userInterests, recommendedItems);
    const correctness = this.calculateCorrectness(userInterests, recommendedItems);
    const appropriateness = this.calculateAppropriateness(recommendedItems);
    
    return {
      functional_completeness: parseFloat(Number(completeness).toFixed(2)),
      functional_correctness: parseFloat(Number(correctness).toFixed(2)),
      functional_appropriateness: parseFloat(Number(appropriateness).toFixed(2)),
      total_items_recommended: recommendedItems.length,
      timestamp: new Date()
    };
  }
}

class SingleUserRecommendationEvaluator {
  constructor() {
    this.result = {
      user: null,
      recommendations: [],
      explanations: [],
      metrics: {},
      timestamp: null
    };
  }

  /**
   * Connect to database
   */
  async connectDB() {
    try {
      // Don't try to connect - server handles this
      // Just verify connection is active
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB not connected');
      }
      return true;
    } catch (error) {
      console.log('❌ MongoDB Connection Error:', error.message);
      return false;
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    try {
      const user = await User.findById(userId)
        .select('_id username email interests organizations')
        .lean();

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      console.log(`👤 Found user: ${user.username}`);
      return user;
    } catch (error) {
      console.log('❌ Error fetching user:', error.message);
      return null;
    }
  }

  /**
   * Get all content
   */
  async getContent() {
    try {
      // Filter posts to recent ones (last 7 days) AND match user interests or high engagement
      // This prevents the evaluator from processing millions of old posts
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const posts = await Post.find({
        createdAt: { $gte: sevenDaysAgo },
        visibility: { $in: ['public', 'organization-only'] }
      })
        .select('_id title desc tags organization likes engagementMetrics mediaType createdAt userId')
        .lean()
        .limit(5000) // Reasonable limit to prevent timeouts
        .sort({ createdAt: -1 }); // Most recent first for better recommendations

      const events = await Event.find({
        $or: [
          { status: 'upcoming', date: { $gte: new Date() } },
          { status: 'ongoing' }
        ]
      })
        .select('_id title description date tags organization status engagementMetrics createdAt')
        .lean()
        .limit(500)
        .sort({ date: -1 });

      console.log(`📚 Found ${posts.length} recent posts, ${events.length} events`);
      return { posts, events };
    } catch (error) {
      console.log('❌ Error fetching content:', error.message);
      return { posts: [], events: [] };
    }
  }

  /**
   * Generate recommendations with explanations
   */
  async generateRecommendationsWithExplanations(user, allContent, limit = 20) {
    try {
      if (!user.interests || user.interests.length === 0) {
        return { recommendations: [], explanations: [] };
      }

      // Get recommendations (will be split into posts and events on frontend)
      const recommendations = await RecommendationService.getRecommendations(
        user._id,
        limit,
        { posts: allContent.posts, events: allContent.events }
      );

      const explanations = recommendations.map(rec => {
        // Ensure relevanceScore is always a number
        const scoreValue = typeof rec.score === 'number' ? rec.score : (Number(rec.score) || 0);
        
        return {
          itemId: rec._id,
          itemTitle: rec.title || rec.desc || 'Untitled',
          itemType: rec.type || 'post',
          reasons: this.explainRecommendation(rec, user.interests),
          relevanceScore: parseFloat(scoreValue.toFixed(2)) // Ensure it's a proper number
        };
      });

      return { recommendations, explanations };
    } catch (error) {
      console.log('❌ Error generating recommendations:', error.message);
      return { recommendations: [], explanations: [] };
    }
  }

  /**
   * Explain WHY an item was recommended
   */
  explainRecommendation(item, userInterests) {
    const reasons = [];
    const itemTags = item.tags || [];
    const itemOrg = item.organization || '';

    // Check tag matches
    const matchedTags = itemTags.filter(tag => {
      return userInterests.some(interest => 
        tag.toLowerCase().includes(interest.toLowerCase())
      );
    });

    if (matchedTags.length > 0) {
      reasons.push({
        type: 'tag_match',
        label: 'Interest Tags',
        value: matchedTags.join(', '),
        weight: 'High'
      });
    }

    // Check organization match
    if (itemOrg && userInterests.some(i => i.toLowerCase().includes(itemOrg.toLowerCase()))) {
      reasons.push({
        type: 'org_match',
        label: 'Organization Match',
        value: itemOrg,
        weight: 'High'
      });
    }

    // Check engagement
    if (item.engagementMetrics) {
      const { likes = 0, views = 0 } = item.engagementMetrics;
      if (likes > 0 || views > 0) {
        reasons.push({
          type: 'engagement',
          label: 'Popular Content',
          value: `${likes} likes, ${views} views`,
          weight: 'Medium'
        });
      }
    }

    // Check recency
    if (item.createdAt) {
      const daysSince = (new Date() - new Date(item.createdAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        reasons.push({
          type: 'recency',
          label: 'Recently Posted',
          value: `${Math.floor(daysSince)} days ago`,
          weight: 'Medium'
        });
      }
    }

    // Check media type
    if (item.mediaType) {
      reasons.push({
        type: 'media',
        label: 'Media Type',
        value: item.mediaType,
        weight: 'Low'
      });
    }

    return reasons;
  }

  /**
   * Run complete evaluation for single user
   */
  async evaluateUser(userId, limit = 20) {
    console.log(`\n🚀 Starting User Recommendation Evaluation for ${userId} (limit: ${limit})`);

    const connected = await this.connectDB();
    if (!connected) return this.result;

    try {
      // Get user
      const user = await this.getUser(userId);
      if (!user) throw new Error('User not found');

      this.result.user = user;

      // Get content
      const content = await this.getContent();

      // Generate recommendations with explanations
      const { recommendations, explanations } = await this.generateRecommendationsWithExplanations(user, content, limit);

      this.result.recommendations = recommendations;
      this.result.explanations = explanations;

      // Calculate ISO 25010 metrics
      this.result.metrics = ISO25010FunctionalSuitability.evaluateRecommendations(
        user.interests,
        recommendations
      );

      this.result.timestamp = new Date();

      console.log(`\n✅ Evaluation Complete`);
      console.log(`📊 Metrics:`);
      console.log(`   Completeness: ${this.result.metrics.functional_completeness?.toFixed(2)}%`);
      console.log(`   Correctness: ${this.result.metrics.functional_correctness?.toFixed(2)}%`);
      console.log(`   Appropriateness: ${this.result.metrics.functional_appropriateness?.toFixed(2)}%`);

      return this.result;
    } catch (error) {
      console.log('❌ Fatal Error:', error.message);
      console.error(error);
      return this.result;
    }
  }
}

module.exports = { SingleUserRecommendationEvaluator, ISO25010FunctionalSuitability };

// CLI execution
if (require.main === module) {
  const userId = process.argv[2];
  if (!userId) {
    console.log('Usage: node dynamicRecommendationEvaluator.js <userId>');
    process.exit(1);
  }

  (async () => {
    const evaluator = new SingleUserRecommendationEvaluator();
    const result = await evaluator.evaluateUser(userId);
    console.log('\n=== EVALUATION RESULT ===\n');
    console.log(JSON.stringify(result, null, 2));
  })();
}

// CLI execution
if (require.main === module) {
  (async () => {
    const evaluator = new DynamicRecommendationEvaluator();
    const results = await evaluator.runCompleteEvaluation();
    console.log('\n=== EVALUATION RESULTS ===\n');
    console.log(JSON.stringify(results, null, 2));
  })();
}
