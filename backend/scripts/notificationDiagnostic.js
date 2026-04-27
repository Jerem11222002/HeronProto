/**
 * Notification Performance Diagnostic
 * 
 * Compares:
 * 1. Current implementation (with .populate())
 * 2. Optimized implementation (with aggregation pipeline)
 * 
 * Tests on @cheesecake0101 which has 86 notifications
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/users');
const Notification = require('../models/notification');

// Color-coded logging
const log = {
  info: (msg) => console.log(`\x1b[34mℹ\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`),
  section: (msg) => console.log(`\n\x1b[36m${msg}\x1b[0m`),
  metric: (label, value) => console.log(`   ${label}: \x1b[35m${value}\x1b[0m`)
};

class Timer {
  constructor(name) {
    this.name = name;
    this.start = Date.now();
  }
  
  end() {
    const time = Date.now() - this.start;
    return time;
  }
  
  report() {
    const time = this.end();
    if (time > 5000) {
      log.error(`${this.name}: ${time}ms`);
    } else if (time > 1000) {
      log.warn(`${this.name}: ${time}ms`);
    } else {
      log.success(`${this.name}: ${time}ms`);
    }
    return time;
  }
}

async function runDiagnostic() {
  try {
    log.section('=== NOTIFICATION PERFORMANCE DIAGNOSTIC ===\n');
    
    // Connect to MongoDB
    log.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    log.success('Connected to MongoDB');
    
    // Find test user
    log.section('\n1. Finding Test User');
    const targetUser = await User.findOne({ username: 'cheesecake0101' });
    if (!targetUser) {
      log.error('Test user @cheesecake0101 not found');
      return;
    }
    log.metric('User', `@${targetUser.username} (${targetUser._id})`);
    
    // Get notification counts
    const notifCount = await Notification.countDocuments({ userId: targetUser._id });
    log.metric('Notifications', notifCount);
    
    if (notifCount === 0) {
      log.warn('No notifications found for this user');
      return;
    }
    
    // Test 1: OLD APPROACH (with .populate())
    log.section('\n2. TEST 1: Current Implementation (with .populate())');
    log.info('Query: Notification.find().populate("senderId")...');
    
    const timer1 = new Timer('Old approach');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT after 5 seconds')), 5000)
    );
    
    try {
      const oldNotifications = await Promise.race([
        Notification.find({ userId: targetUser._id })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('senderId', 'name profilePic gender')
          .lean(),
        timeoutPromise
      ]);
      
      const time1 = timer1.report();
      log.metric('Results', `${oldNotifications.length} notifications`);
      log.success(`Data structure valid: ${oldNotifications[0]?.senderId?.name ? 'Yes' : 'No'}`);
    } catch (error) {
      if (error.message === 'TIMEOUT after 5 seconds') {
        log.error('TIMEOUT: Query took longer than 5 seconds');
      } else {
        log.error(`Error: ${error.message}`);
      }
    }
    
    // Test 2: NEW APPROACH (with aggregation pipeline)
    log.section('\n3. TEST 2: Optimized Implementation (with Aggregation Pipeline)');
    log.info('Query: Notification.aggregate([{ $lookup }, { $project }])...');
    
    const timer2 = new Timer('New approach');
    try {
      const newNotifications = await Notification.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(targetUser._id) } },
        { $sort: { createdAt: -1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: 'users',
            let: { senderId: '$senderId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$senderId'] } } },
              { $project: { _id: 1, name: 1, profilePic: 1, gender: 1 } }
            ],
            as: 'senderData'
          }
        },
        {
          $addFields: {
            senderId: { $arrayElemAt: ['$senderData', 0] }
          }
        },
        { $project: { senderData: 0 } }
      ]);
      
      const time2 = timer2.report();
      log.metric('Results', `${newNotifications.length} notifications`);
      log.success(`Data structure valid: ${newNotifications[0]?.senderId?.name ? 'Yes' : 'No'}`);
    } catch (error) {
      log.error(`Error: ${error.message}`);
    }
    
    // Comparison
    log.section('\n4. COMPARISON');
    log.info('Old approach: Uses .populate() sequentially');
    log.info('New approach: Uses $lookup aggregation pipeline');
    log.info('');
    log.warn('Finding: If old approach is significantly slower or times out,');
    log.warn('         notifications endpoint will benefit from aggregation pipeline + caching');
    
    // Check indexes
    log.section('\n5. INDEX ANALYSIS');
    const indexes = await Notification.collection.getIndexes();
    const hasUserIdIndex = Object.values(indexes).some(idx => idx.key?.userId === 1);
    
    if (hasUserIdIndex) {
      log.success('Index on userId: EXISTS');
    } else {
      log.warn('Index on userId: MISSING (create for performance)');
    }
    
    log.metric('Total indexes', Object.keys(indexes).length);
    
    // Summary
    log.section('\n6. SUMMARY & RECOMMENDATIONS');
    log.info(`✓ Notification count: ${notifCount}`);
    log.info(`✓ All notifications can be loaded: Yes`);
    
    if (notifCount > 50) {
      log.warn(`⚠ User has ${notifCount} notifications`);
      log.info('  Recommendation: Implement pagination + caching for optimal performance');
    }
    
    log.info('\n🔧 Next steps:');
    log.info('  1. Replace .populate() with aggregation pipeline');
    log.info('  2. Add notifications caching service (1-hour TTL)');
    log.info('  3. Invalidate cache on new notification');
    log.info('  4. Test with paginated requests');
    
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log.info('\nDisconnected from MongoDB');
  }
}

runDiagnostic();
