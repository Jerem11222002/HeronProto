const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MetricsEvaluator = require('./backend/services/metricsEvaluator');
const { RecommendationService } = require('./backend/services/recommendations');
const User = require('./backend/models/users');

async function test() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    const userId = '674b9dc89ed5aeb9650f3df3'; // cheesecake0101
    
    // Get user
    const user = await User.findById(userId);
    console.log('\n👤 User:', user.username);
    console.log('📌 Interests:', user.interests.join(', '));
    
    // Get recommendations using hybrid feed
    const Post = require('./backend/models/posts');
    const feed = await RecommendationService.getHybridFeed(userId, { limit: 50, page: 1 });
    const recommendations = feed.items || [];
    console.log('📝 Recommendations:', recommendations.length, 'items\n');
    
    // Evaluate with new metrics
    const metrics = await MetricsEvaluator.evaluateUserRecommendations(userId, recommendations);
    
    console.log('📊 UPDATED METRICS (With Trending/Recent as Valid):');
    console.log('─────────────────────────────────────────');
    if (metrics.metrics) {
      console.log('✓ Cosine Similarity:', metrics.metrics.cosine_similarity?.value || metrics.metrics.cosine_similarity);
      console.log('✓ RMSE:', metrics.metrics.rmse?.value || metrics.metrics.rmse);
      console.log('✓ MAE:', metrics.metrics.mae?.value || metrics.metrics.mae);
      console.log('✓ MRR:', metrics.metrics.mrr?.value || metrics.metrics.mrr);
      console.log('✓ Coverage:', metrics.metrics.coverage?.value || metrics.metrics.coverage, '%');
    } else {
      console.log(JSON.stringify(metrics, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

test();
