/**
 * Test the exact recommendation evaluation flow for both old and new users
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const { SingleUserRecommendationEvaluator } = require('../scripts/dynamicRecommendationEvaluator');

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

async function testRecommendations() {
  console.log('🧪 TESTING RECOMMENDATION EVALUATION FLOW\n');

  try {
    // Get old user
    const oldUser = await User.findOne({ name: 'Je' });
    if (!oldUser) {
      console.log('❌ Could not find old user (Je)');
      return;
    }

    console.log('📊 OLD USER (Je):');
    console.log('   ID:', oldUser._id);
    console.log('   Interests:', oldUser.interests);
    console.log('   Following:', oldUser.following?.length);

    // Test the evaluation
    const evaluator = new SingleUserRecommendationEvaluator();
    
    console.log('\n🚀 Running evaluator.evaluateUser()...\n');
    const result = await evaluator.evaluateUser(oldUser._id.toString(), 20);

    console.log('\n📈 RESULT:');
    console.log('   User found:', !!result.user);
    console.log('   User interests:', result.user?.interests);
    console.log('   Recommendations count:', result.recommendations?.length);
    console.log('   Metrics:', result.metrics);

    if (result.recommendations && result.recommendations.length > 0) {
      console.log('\n✅ SUCCESS: Recommendations generated');
      console.log('   Top recommendation:', result.recommendations[0].title || result.recommendations[0].desc);
    } else {
      console.log('\n❌ NO RECOMMENDATIONS GENERATED');
      console.log('   This is the problem!');
      console.log('   Checking why...\n');

      // Debug the flow
      console.log('🔍 DEBUGGING FLOW:');
      console.log('   1. User interests check:', !!result.user?.interests && result.user.interests.length > 0);
      console.log('   2. User interests array:', result.user?.interests);
      
      if (result.explanations?.length > 0) {
        console.log('   3. Explanations present:', result.explanations.length);
      } else {
        console.log('   3. NO EXPLANATIONS generated');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
  }
}

connectDB().then(() => testRecommendations());
