/**
 * Seed Data Generator
 * Creates realistic test user engagement patterns
 * 
 * Strategy: 5 diverse seed users with 5-10 targeted engagements each
 * ensuring they like content matching their interests
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HeronProto';

/**
 * Find posts matching specific interests
 */
async function findPostsForInterests(interests, limit = 5) {
  try {
    const posts = await Post.find({
      tags: { $in: interests }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
    
    return posts || [];
  } catch (error) {
    console.error('Error finding posts:', error);
    return [];
  }
}

/**
 * Find events matching specific interests
 */
async function findEventsForInterests(interests, limit = 3) {
  try {
    const events = await Event.find({
      $and: [
        { status: { $in: ['upcoming', 'ongoing'] } },
        { tags: { $in: interests } }
      ]
    })
    .sort({ date: 1 })
    .limit(limit)
    .lean();
    
    return events || [];
  } catch (error) {
    console.error('Error finding events:', error);
    return [];
  }
}

/**
 * Create seed users with realistic engagement
 */
const seedUsers = [
  {
    name: 'Theatre Enthusiast',
    interests: ['theatre', 'drama', 'performance', 'acting'],
    targetLikes: 5,
    targetEventAttendance: 1
  },
  {
    name: 'Dance Explorer',
    interests: ['dance', 'modern-dance', 'choreography', 'performance'],
    targetLikes: 6,
    targetEventAttendance: 1
  },
  {
    name: 'Music Lover',
    interests: ['music', 'concert', 'band', 'singing', 'performance'],
    targetLikes: 7,
    targetEventAttendance: 2
  },
  {
    name: 'Cultural Arts Advocate',
    interests: ['cultural-arts', 'traditional-arts', 'folk-dance', 'heritage'],
    targetLikes: 5,
    targetEventAttendance: 1
  },
  {
    name: 'Visual Arts Admirer',
    interests: ['visual-arts', 'painting', 'digital-art', 'design', 'creative'],
    targetLikes: 8,
    targetEventAttendance: 0
  }
];

/**
 * Generate realistic engagement for a seed user
 */
async function generateSeedUserEngagement(seedUserData, index) {
  console.log(`\n📌 Creating seed user #${index + 1}: ${seedUserData.name}`);
  
  try {
    // Create user
    const cleanName = seedUserData.name.toLowerCase().replace(/\s+/g, '_');
    const userData = {
      username: `seed_${cleanName}_${Date.now()}`,
      email: `seed${index + 1}@heronproto.test`,
      password: 'SeedPassword123!', // Would be hashed in real implementation
      name: seedUserData.name,
      studentId: `SEED${index + 1}${Date.now()}`,
      gender: 'prefer-not-to-say',
      interests: seedUserData.interests,
      bio: `Test seed user for ${seedUserData.name} interest profile`,
      liked: [],
      attending: [],
      followers: [],
      following: [],
      created_at: new Date()
    };
    
    let user = await User.findOne({ email: userData.email });
    if (!user) {
      user = new User(userData);
      await user.save();
      console.log(`✅ Created user: ${userData.username}`);
    } else {
      console.log(`↻ User already exists: ${userData.username}`);
    }
    
    // Add likes to matching posts
    const matchingPosts = await findPostsForInterests(seedUserData.interests, seedUserData.targetLikes);
    let likeCount = 0;
    
    for (const post of matchingPosts) {
      if (!user.liked || !user.liked.includes(post._id)) {
        user.liked = user.liked || [];
        user.liked.push(post._id);
        likeCount++;
        
        // Also add like to post
        if (!post.likes) post.likes = [];
        if (!post.likes.includes(user._id)) {
          post.likes.push(user._id);
          await Post.findByIdAndUpdate(post._id, { likes: post.likes });
        }
      }
    }
    
    console.log(`  ✅ Added ${likeCount} likes to matching content`);
    
    // Add event attendance
    const matchingEvents = await findEventsForInterests(seedUserData.interests, seedUserData.targetEventAttendance);
    let attendanceCount = 0;
    
    for (const event of matchingEvents) {
      if (!user.attending || !user.attending.includes(event._id)) {
        user.attending = user.attending || [];
        user.attending.push(event._id);
        attendanceCount++;
        
        // Also add to event registrations
        if (!event.registrations) event.registrations = [];
        if (!event.registrations.includes(user._id)) {
          event.registrations.push(user._id);
          await Event.findByIdAndUpdate(event._id, { registrations: event.registrations });
        }
      }
    }
    
    console.log(`  ✅ Added ${attendanceCount} event registrations`);
    
    // Save user
    await user.save();
    
    return {
      userId: user._id,
      username: user.username,
      likes: likeCount,
      attendance: attendanceCount,
      totalEngagements: likeCount + attendanceCount
    };
  } catch (error) {
    console.error(`❌ Error creating seed user ${index + 1}:`, error);
    return null;
  }
}

/**
 * Main seed data generator
 */
async function generateSeedData() {
  console.log('═'.repeat(60));
  console.log('🌱 SEED DATA GENERATOR - Creating Test User Engagement');
  console.log('═'.repeat(60));
  
  try {
    // Connect
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected');
    
    // Generate seed users
    console.log('\n📊 Generating seed users with realistic engagement...\n');
    const results = [];
    
    for (let i = 0; i < seedUsers.length; i++) {
      const result = await generateSeedUserEngagement(seedUsers[i], i);
      if (result) results.push(result);
    }
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📈 SEED DATA GENERATION SUMMARY');
    console.log('═'.repeat(60));
    
    const summary = {
      seedUsersCreated: results.length,
      totalLikes: results.reduce((sum, r) => sum + r.likes, 0),
      totalAttendances: results.reduce((sum, r) => sum + r.attendance, 0),
      totalEngagements: results.reduce((sum, r) => sum + r.totalEngagements, 0),
      users: results
    };
    
    console.log(JSON.stringify(summary, null, 2));
    
    console.log('\n✅ Seed data generation complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run diagnostics again to verify engagement signals');
    console.log('   2. Test recommendations for seed users');
    console.log('   3. Measure metric improvements (RMSE, MAE, NDCG, MRR)');
    console.log('   4. Compare before/after recommendation quality\n');
    
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
  generateSeedData();
}

module.exports = { generateSeedUserEngagement, seedUsers };
