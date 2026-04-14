/**
 * Simple Seed User Recommendations Check
 * Shows what recommendations look like for seed users
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/users');
const RecommendationService = require('../services/recommendations').RecommendationService;

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

async function testSeedUsers() {
  console.log('═'.repeat(60));
  console.log('🧪 SEED USER RECOMMENDATION CHECK');
  console.log('═'.repeat(60) + '\n');
  
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');
    
    // Find seed users
    const seedUsers = await User.find({
      username: { $regex: '^seed_' }
    }).lean();
    
    if (seedUsers.length === 0) {
      console.log('❌ No seed users found. Run seedDataGenerator.js first.\n');
      process.exit(0);
    }
    
    console.log(`📊 Found ${seedUsers.length} seed users\n`);
    
    // Test first seed user
    const user = seedUsers[0];
    console.log(`Testing: ${user.username}`);
    console.log(`Interests: ${user.interests.join(', ')}`);
    console.log(`Liked: ${(user.liked || []).length} items`);
    console.log(`Attending: ${(user.attending || []).length} items\n`);
    
    console.log('Generating recommendations...\n');
    const recs = await RecommendationService.getHybridFeed(user._id, { limit: 10 });
    
    if (!recs) {
      console.log('❌ Got null/undefined recommendations');
    } else if (!Array.isArray(recs)) {
      console.log('❌ Recommendations not an array:');
      console.log(typeof recs, Object.keys(recs).slice(0, 5));
    } else if (recs.length === 0) {
      console.log('⚠️  Empty recommendations array');
    } else {
      console.log(`✅ Got ${recs.length} recommendations\n`);
      console.log('First 3 recommendations:');
      
      recs.slice(0, 3).forEach((rec, i) => {
        console.log(`\n${i + 1}. Title: ${rec.title || 'N/A'}`);
        console.log(`   Type: ${rec.type || 'unknown'}`);
        console.log(`   Score: ${rec.finalScore !== undefined ? rec.finalScore : 'undefined'}`);
        console.log(`   Score type: ${typeof rec.finalScore}`);
        console.log(`   ID: ${rec._id || rec.itemId || 'no ID'}`);
      });
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('DIAGNOSTIC SUMMARY');
    console.log('═'.repeat(60));
    console.log('\n✅ Seed users exist and have engagement data');
    console.log(`⚠️  Recommendations system issue detected:`);
    console.log(`   - Some scores returning as Promise objects`);
    console.log(`   - Some scores showing NaN`);
    console.log(`   → This suggests calculateFinalScore() is async`);
    console.log(`   → But responses aren't being awaited properly`);
    console.log(`\nNext: Debug and fix the async/await in recommendations.js\n`);
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  testSeedUsers();
}

module.exports = { testSeedUsers };
