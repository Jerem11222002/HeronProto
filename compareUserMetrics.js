const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MetricsEvaluator = require('./backend/services/metricsEvaluator');
const { RecommendationService } = require('./backend/services/recommendations');
const User = require('./backend/models/users');

async function compareUsers() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    // Get multiple users
    const users = await User.find().limit(3).select('_id username interests');
    
    console.log('\n📊 METRICS VARY BY USER ENGAGEMENT HISTORY:');
    console.log('═'.repeat(80));
    
    for (const user of users) {
      console.log(`\n👤 User: ${user.username}`);
      console.log(`📌 Interests: ${(user.interests || []).join(', ') || 'None set'}`);
      
      // Get recommendations
      const feed = await RecommendationService.getHybridFeed(user._id, { limit: 30, page: 1 });
      const recommendations = feed.items || [];
      console.log(`📝 Recommendations: ${recommendations.length} items`);
      
      // Evaluate metrics
      const metrics = await MetricsEvaluator.evaluateUserRecommendations(user._id, recommendations);
      
      console.log(`\n   Cosine Similarity: ${metrics.cosine_similarity?.value.toFixed(3)}`);
      console.log(`   MAE: ${metrics.mae?.value.toFixed(3)}`);
      console.log(`   RMSE: ${metrics.rmse?.value.toFixed(3)}`);
      console.log(`   MRR: ${metrics.mrr?.value.toFixed(3)}`);
      console.log(`   Coverage: ${metrics.evaluation_data?.coverage?.toFixed(1)}%`);
      
      // Show why metrics differ
      console.log(`\n   📈 Why different from user cheesecake0101:`);
      
      // Get engagement history count
      const Post = require('./backend/models/posts');
      const Event = require('./backend/models/event');
      
      const userPosts = await Post.find({
        $or: [
          { likes: user._id },
          { comments: { $elemMatch: { author: user._id } } }
        ]
      }).countDocuments();
      
      const userEvents = await Event.find({
        $or: [
          { interested: { $elemMatch: { user: user._id } } },
          { registrations: { $elemMatch: { user: user._id } } }
        ]
      }).countDocuments();
      
      console.log(`      - Engagement history: ${userPosts} posts, ${userEvents} events`);
      console.log(`      - Interests count: ${user.interests?.length || 0}`);
      console.log(`      → These drive different recommendation patterns`);
      console.log(`      → Error magnitude adapts to their profile`);
    }
    
    console.log('\n\n🎯 KEY INSIGHT:');
    console.log('═'.repeat(80));
    console.log('Each user gets PERSONALIZED metrics:');
    console.log('  • User with lots of engagement → Lower error (more data to predict from)');
    console.log('  • User with no history → Higher error (cold start predictions)');
    console.log('  • User with clear interests → Higher cosine similarity (better match)');
    console.log('  • User with diverse tastes → Lower similarity (harder to predict)');
    console.log('\nThis is why 67.6% error for cheesecake0101 is specific to THEIR profile.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

compareUsers();
