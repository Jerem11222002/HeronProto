const mongoose = require('mongoose');
const Post = require('../models/posts');
const User = require('../models/users');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const {
  calculateEngagementScore,
  calculateRecencyScore,
  calculateInterestScore,
  calculateImplicitScore
} = require('../utils/scoringUtility'); 

// Helper functions
const inferTagsFromContent = (text) => {
  if (!text) return [];
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  return [...new Set(tokens.filter(word => !stopWords.has(word) && word.length > 2))].slice(0, 5);
};

const formatScore = (score) => Number(score).toFixed(2);
const formatDate = (date) => new Date(date).toLocaleString();

// MongoDB connection with timeout
mongoose.connect('mongodb://localhost:27017/herondb', {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

  
  const createTestUser = async () => {
  console.log('Creating test user with sample data...');
  
  // Define preferences as plain object
  const implicitPrefs = {
    'music': 0.8,
    'dance': 0.6,
    'theatre': 0.7,
    'performance': 0.5,
    'arts': 0.4
  };

  const testUserData = {
    username: "testuser",
    email: "test@example.com",
    password: "TestPassword123!",
    name: "Test User",
    gender: "prefer-not-to-say",
    interests: [1, 2, 3], // music, dance, theatre
    implicitPreferences: implicitPrefs,
    following: [],
    likedPosts: [],
    profileSetup: true
  };

  try {
    const user = new User(testUserData);
    await user.save();
    console.log('Debug - Saved User Prefs:', user.implicitPreferences);
    return user;
  } catch (error) {
    console.error('Failed to create test user:', error);
    throw error;
  }
};

const createSamplePosts = async (userId) => {
  const samplePosts = [
    {
      userId,
      name: "Music Showcase Event",
      desc: "Music performance showcase tonight!",
      tags: ["music", "performance", "arts"],
      engagementMetrics: {
        views: 100,
        shares: 20,
        commentCount: 15
      },
      likes: [],
      createdAt: new Date()
    },
    {
      userId,
      name: "Weekend Dance Workshop",
      desc: "Dance workshop this weekend",
      tags: ["dance", "workshop", "performance"],
      engagementMetrics: {
        views: 150,
        shares: 30,
        commentCount: 25
      },
      likes: [],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    },
    {
      userId,
      name: "Theatre Rehearsal",
      desc: "Theatre production rehearsal",
      tags: ["theatre", "performance", "arts"],
      engagementMetrics: {
        views: 80,
        shares: 10,
        commentCount: 12
      },
      likes: [],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    }
  ];

  try {
    await Post.insertMany(samplePosts);
    console.log('Sample posts created successfully');
  } catch (error) {
    console.error('Failed to create sample posts:', error);
    throw error;
  }
};

const ensureTestData = async () => {
  let testUser = await User.findOne({ 
    interests: { $exists: true, $not: { $size: 0 } }
  });

  if (!testUser) {
    testUser = await createTestUser();
  }

  const postsCount = await Post.countDocuments();
  if (postsCount === 0) {
    await createSamplePosts(testUser._id);
  }

  return testUser;
};

const testHybridFiltering = async () => {
  try {
    console.log('\nStarting Hybrid Filtering Test');
    console.log('============================\n');

    // 1. Get or create a test user
    const testUser = await ensureTestData();

    console.log('Test User Profile:', {
      interestsCount: testUser.interests.length,
      interests: testUser.interests,
      implicitPrefsCount: Object.keys(testUser.implicitPreferences || {}).length,
      topImplicitPrefs: Object.entries(testUser.implicitPreferences || {})
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag, score]) => `${tag}: ${formatScore(score)}`),
      followingCount: testUser.following?.length || 0,
      likedPostsCount: testUser.likedPosts?.length || 0
    });

    // 2. Get different types of posts with more context
        const [recentPosts, popularPosts, relevantPosts] = await Promise.all([
      // Recent posts (last 24 hours)
      Post.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    
      // Popular posts (by engagement)
      Post.find({})
      .populate('userId', 'name')
      .sort({ 
        'engagementMetrics.views': -1,
        'likes': -1 
      })
      .limit(5)
      .lean(),
    
      // Relevant posts (matching user interests)
      Post.find({
        tags: { 
          $in: [...testUser.getMappedInterests().tags] 
        }
      })
      .populate('userId', 'name')
      .limit(5)
      .lean()
    ]);

    // 3. Enhanced post analysis
    const analyzePostSet = (posts, label) => {
      if (!posts.length) {
        console.log(`\n${label} Posts: No posts found`);
        return;
      }

      console.log(`\n${label} Posts Analysis:`);
      console.log('------------------------');

      const scores = posts.map(post => {
        const mappedInterests = testUser.getMappedInterests();
        const recencyScore = calculateRecencyScore(post);
        const explicitScore = calculateInterestScore(post, mappedInterests.tags);
        const implicitScore = calculateImplicitScore(post, testUser.implicitPreferences);
        const engagementScore = calculateEngagementScore(post);
        
        const finalScore = (
          (engagementScore * 0.3) +
          (recencyScore * 0.2) +
          (explicitScore * 0.2) +
          (implicitScore * 0.3)
        );

        return {
          id: post._id,
          desc: post.desc?.substring(0, 50) + '...',
          author: post.userId?.name || 'Unknown',
          created: formatDate(post.createdAt),
          tags: post.tags || [],
          scores: {
            final: formatScore(finalScore),
            engagement: formatScore(engagementScore),
            recency: formatScore(recencyScore),
            explicit: formatScore(explicitScore),
            implicit: formatScore(implicitScore)
          },
          metrics: {
            views: post.engagementMetrics?.views || 0,
            likes: post.likes?.length || 0,
            shares: post.engagementMetrics?.shares || 0,
            comments: post.engagementMetrics?.commentCount || 0
          }
        };
      });

      // Sort by final score
      scores.sort((a, b) => b.scores.final - a.scores.final);

      scores.forEach(post => {
        console.log('\nPost Details:');
        console.log(`Description: ${post.desc}`);
        console.log(`Author: ${post.author}`);
        console.log(`Created: ${post.created}`);
        console.log('Tags:', post.tags);
        console.log('Scores:', post.scores);
        console.log('Engagement Metrics:', post.metrics);
      });

      // Calculate average scores
      const avgScores = {
        final: formatScore(scores.reduce((acc, p) => acc + Number(p.scores.final), 0) / scores.length),
        engagement: formatScore(scores.reduce((acc, p) => acc + Number(p.scores.engagement), 0) / scores.length),
        recency: formatScore(scores.reduce((acc, p) => acc + Number(p.scores.recency), 0) / scores.length),
        explicit: formatScore(scores.reduce((acc, p) => acc + Number(p.scores.explicit), 0) / scores.length),
        implicit: formatScore(scores.reduce((acc, p) => acc + Number(p.scores.implicit), 0) / scores.length)
      };

      console.log(`\n${label} Average Scores:`, avgScores);
    };

    analyzePostSet(recentPosts, 'Recent');
    analyzePostSet(popularPosts, 'Popular');
    analyzePostSet(relevantPosts, 'Relevant');

    // 4. Test tag inference on old posts
    const oldPosts = await Post.find({ 
      $or: [
        { tags: { $exists: false } },
        { tags: { $size: 0 } }
      ]
    }).limit(5).lean();

    if (oldPosts.length > 0) {
      console.log('\nTag Inference Analysis:');
      console.log('----------------------');
      oldPosts.forEach(post => {
        const inferredTags = inferTagsFromContent(post.desc);
        console.log(`\nPost: "${post.desc?.substring(0, 50)}..."`);
        console.log('Inferred Tags:', inferredTags);
        if (post.mediaType) {
          console.log('Added Media Tag:', post.mediaType);
          inferredTags.push(post.mediaType);
        }
      });
    }

    console.log('\nTest Summary:');
    console.log('============');
    console.log(`Recent Posts: ${recentPosts.length}`);
    console.log(`Popular Posts: ${popularPosts.length}`);
    console.log(`Relevant Posts: ${relevantPosts.length}`);
    console.log(`Old Posts Analyzed: ${oldPosts.length}`);

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\nTest Complete - MongoDB disconnected');
  }
};

// Run the test
testHybridFiltering().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});