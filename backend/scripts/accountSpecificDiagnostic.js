/**
 * Account-Specific Performance Diagnostic
 * 
 * Profiles slow queries for a specific user account vs another user
 * to identify why @cheesecake0101 is 2x slower than other accounts.
 * 
 * Key queries analyzed:
 * - Featured artists endpoint
 * - Notifications fetch
 * - Profile relationships (followers/following)
 * - Profile page data
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');
const Post = require('../models/posts');
const Notification = require('../models/notification');
const Event = require('../models/event');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  dim: '\x1b[90m'
};

const log = {
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}═══ ${msg} ═══${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.dim}  ${msg}${colors.reset}`),
  metric: (label, value, unit = '') => console.log(`  ${label}: ${colors.bright}${value}${colors.reset} ${unit}`)
};

// Timer helper
class Timer {
  constructor(name) {
    this.name = name;
    this.start = Date.now();
  }

  end() {
    const duration = Date.now() - this.start;
    return duration;
  }
}

// Diagnostic runner
async function runDiagnostics() {
  try {
    // Connect to database
    log.header('Connecting to Database');
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/heronproto';
    await mongoose.connect(mongoUri);
    log.success('Connected to MongoDB');

    // Step 1: Find target user
    log.header('Step 1: Locating Test Accounts');
    
    const targetUser = await User.findOne({ username: 'cheesecake0101' })
      .select('_id username followers following')
      .lean();

    if (!targetUser) {
      log.error('User @cheesecake0101 not found');
      log.info('Available users:');
      const sampleUsers = await User.find({}).select('username followers following').limit(5).lean();
      sampleUsers.forEach(u => {
        console.log(`  - @${u.username}: ${u.followers?.length || 0} followers, ${u.following?.length || 0} following`);
      });
      process.exit(1);
    }

    log.success(`Found @${targetUser.username}`);
    log.metric('Followers', targetUser.followers?.length || 0);
    log.metric('Following', targetUser.following?.length || 0);

    // Find a comparison user (first user with fewer followers)
    const comparisonUser = await User.findOne(
      { _id: { $ne: targetUser._id } },
      '_id username followers following'
    ).sort({ 'followers': 1 }).limit(1).lean();

    if (comparisonUser) {
      log.section(`\nComparison User: @${comparisonUser.username}`);
      log.metric('Followers', comparisonUser.followers?.length || 0);
      log.metric('Following', comparisonUser.following?.length || 0);
    }

    // Step 2: Analyze data volume
    log.header('Step 2: Data Volume Analysis');

    const targetNotifCount = await Notification.countDocuments({ userId: targetUser._id });
    const targetPostCount = await Post.countDocuments({ userId: targetUser._id });
    const targetEventCount = await Event.countDocuments({ userId: targetUser._id });

    log.metric('Posts', targetPostCount);
    log.metric('Notifications', targetNotifCount);
    log.metric('Events created', targetEventCount);

    if (comparisonUser) {
      const comparisonNotifCount = await Notification.countDocuments({ userId: comparisonUser._id });
      const comparisonPostCount = await Post.countDocuments({ userId: comparisonUser._id });
      
      log.info(`\nComparison - Posts: ${comparisonPostCount}, Notifications: ${comparisonNotifCount}`);
      
      const followerDiff = (targetUser.followers?.length || 0) - (comparisonUser.followers?.length || 0);
      const notifDiff = targetNotifCount - comparisonNotifCount;
      
      if (followerDiff > 0) {
        log.warn(`Target user has ${followerDiff} more followers`);
      }
      if (notifDiff > 100) {
        log.warn(`Target user has ${notifDiff} more notifications`);
      }
    }

    // Step 3: Profile slow queries
    log.header('Step 3: Query Performance Profile');

    // 3A: Notifications fetch
    log.section('\n3A: Notifications Fetch');
    const notifTimer = new Timer('Notifications');
    const notifications = await Notification.find({ userId: targetUser._id })
      .sort({ createdAt: -1 })
      .skip(0)
      .limit(20)
      .populate('senderId', 'name profilePic gender')
      .lean();
    const notifTime = notifTimer.end();
    log.metric('Query time', notifTime, 'ms');
    log.metric('Records returned', notifications.length);
    if (notifTime > 500) {
      log.warn('Notification fetch is slow');
    } else {
      log.success('Notification fetch is acceptable');
    }

    // 3B: Followers/Following counts (relationship query)
    log.section('\n3B: Followers/Following Populate');
    const relTimer = new Timer('Relationships');
    const userWithRels = await User.findById(targetUser._id)
      .populate("followers", "_id name username profilePic profilePicture sex")
      .populate("following", "_id name username profilePic profilePicture sex")
      .lean();
    const relTime = relTimer.end();
    log.metric('Query time', relTime, 'ms');
    log.metric('Followers loaded', userWithRels.followers?.length || 0);
    log.metric('Following loaded', userWithRels.following?.length || 0);
    if (relTime > 1000) {
      log.error('Relationship populate is SLOW - this is likely the culprit');
    } else if (relTime > 500) {
      log.warn('Relationship populate could be optimized');
    } else {
      log.success('Relationship populate is acceptable');
    }

    // 3C: Featured artists query (simplified version)
    log.section('\n3C: Featured Artists Query');
    const featuredTimer = new Timer('Featured Artists');
    const startDate = new Date(new Date().setDate(new Date().getDate() - 7)); // Last 7 days
    const topArtists = await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'posts',
          localField: 'sharedPost',
          foreignField: '_id',
          as: 'originalPost'
        }
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          shares: { $sum: { $cond: ['$sharedPost', 1, 0] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const featuredTime = featuredTimer.end();
    log.metric('Query time', featuredTime, 'ms');
    log.metric('Top artists found', topArtists.length);
    if (featuredTime > 2000) {
      log.error('Featured artists query is slow');
    } else if (featuredTime > 1000) {
      log.warn('Featured artists query could be optimized');
    } else {
      log.success('Featured artists query is acceptable');
    }

    // 3D: User profile page - all followers + events
    log.section('\n3D: Profile Page Load (followers + events)');
    const profileTimer = new Timer('Profile Page');
    const profileUser = await User.findById(targetUser._id)
      .populate('followers', '_id name username profilePic')
      .populate('following', '_id name username profilePic')
      .lean();
    const userEvents = await Event.find({ userId: targetUser._id }).limit(10).lean();
    const profileTime = profileTimer.end();
    log.metric('Query time', profileTime, 'ms');
    log.metric('Events loaded', userEvents.length);
    if (profileTime > 2000) {
      log.error('Profile page load is SLOW');
    } else if (profileTime > 1000) {
      log.warn('Profile page load could be optimized');
    } else {
      log.success('Profile page load is acceptable');
    }

    // Step 4: Index Analysis
    log.header('Step 4: Index Analysis');

    const userIndexes = await User.collection.getIndexes();
    const notifIndexes = await Notification.collection.getIndexes();

    log.section('User Collection Indexes');
    Object.entries(userIndexes).forEach(([name, spec]) => {
      console.log(`  ${name}: ${JSON.stringify(spec)}`);
    });

    log.section('Notification Collection Indexes');
    Object.entries(notifIndexes).forEach(([name, spec]) => {
      console.log(`  ${name}: ${JSON.stringify(spec)}`);
    });

    // Check for critical missing indexes
    log.section('\n\nCritical Index Checks:');
    
    const hasFollowersIndex = Object.values(userIndexes).some(idx => 
      idx.key && idx.key.followers
    );
    hasFollowersIndex 
      ? log.success('Index on followers field exists') 
      : log.warn('MISSING: Index on followers field');

    const hasFollowingIndex = Object.values(userIndexes).some(idx => 
      idx.key && idx.key.following
    );
    hasFollowingIndex 
      ? log.success('Index on following field exists') 
      : log.warn('MISSING: Index on following field');

    const hasNotifUserIndex = Object.values(notifIndexes).some(idx =>
      idx.key && idx.key.userId
    );
    hasNotifUserIndex
      ? log.success('Index on notification.userId exists')
      : log.warn('MISSING: Index on notification.userId');

    // Step 5: Recommendations
    log.header('Step 5: Performance Recommendations');

    const recommendations = [];

    if (relTime > 1000) {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'Relationship populate is slow',
        cause: 'populate("followers/following") loads all user documents for large follower lists',
        fix: 'Replace with aggregation pipeline using $lookup with $project to select only needed fields',
        impact: `Could reduce from ${relTime}ms to ~200ms for large follower lists`
      });
    }

    if ((targetUser.followers?.length || 0) > 500) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'High follower count detected',
        cause: `User has ${targetUser.followers.length} followers - full populates scale poorly`,
        fix: 'Implement pagination or lazy-loading for followers/following lists',
        impact: 'Prevents future slowdown as followers grow'
      });
    }

    if (notifTime > 500) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Notification fetch is slow',
        cause: 'populate("senderId") is running for each notification',
        fix: 'Consider using aggregation with $lookup or caching sender info',
        impact: `Could reduce from ${notifTime}ms to ~100ms`
      });
    }

    if (!hasFollowersIndex || !hasFollowingIndex) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Missing indexes on relationship fields',
        cause: 'Queries filtering by followers/following will full-scan',
        fix: 'Create indexes: db.users.createIndex({ followers: 1 }); db.users.createIndex({ following: 1 });',
        impact: 'Significant improvement for any query filtering on these fields'
      });
    }

    if (recommendations.length > 0) {
      recommendations.forEach((rec, idx) => {
        console.log(`\n${idx + 1}. [${rec.priority}] ${rec.issue}`);
        log.info(`Cause: ${rec.cause}`);
        log.info(`Fix: ${rec.fix}`);
        log.info(`Impact: ${rec.impact}`);
      });
    } else {
      log.success('No critical issues found');
    }

    // Step 6: Summary
    log.header('Step 6: Summary');
    console.log(`
${colors.bright}Performance Profile for @${targetUser.username}:${colors.reset}
  • Followers: ${targetUser.followers?.length || 0}
  • Following: ${targetUser.following?.length || 0}
  • Notifications: ${targetNotifCount}
  
${colors.bright}Query Times:${colors.reset}
  • Notifications fetch: ${notifTime}ms ${notifTime > 500 ? '⚠️ SLOW' : '✓'}
  • Relationships populate: ${relTime}ms ${relTime > 1000 ? '⚠️ VERY SLOW' : relTime > 500 ? '⚠️ SLOW' : '✓'}
  • Featured artists: ${featuredTime}ms ${featuredTime > 1000 ? '⚠️ SLOW' : '✓'}
  • Profile page: ${profileTime}ms ${profileTime > 2000 ? '⚠️ VERY SLOW' : profileTime > 1000 ? '⚠️ SLOW' : '✓'}

${colors.bright}Diagnosis:${colors.reset}
${relTime > 1000 ? `  The MAIN culprit is the relationship populate query (${relTime}ms).
  This happens when loading followers/following lists with .populate().
  
  The slowness is proportional to the number of followers (${targetUser.followers?.length || 0}),
  which explains why @${targetUser.username} is 2x slower than other accounts.` : '  No critical issues detected'}
    `);

  } catch (error) {
    log.error(`Diagnostic failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log.success('Disconnected from database');
  }
}

// Run diagnostics
runDiagnostics();
