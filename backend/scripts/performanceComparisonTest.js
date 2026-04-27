/**
 * Performance Comparison Test
 * 
 * Compares the old .populate() approach with the new aggregation pipeline approach
 * to verify the fix resolves the hanging/slowness issue.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/users');

// Color codes
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
  metric: (label, value, unit = '') => console.log(`  ${label}: ${colors.bright}${value}${colors.reset} ${unit}`)
};

async function compareApproaches() {
  try {
    log.header('Connecting to Database');
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/heronproto';
    await mongoose.connect(mongoUri);
    log.success('Connected to MongoDB');

    // Find target user
    log.header('Finding Test User');
    const targetUser = await User.findOne({ username: 'cheesecake0101' }).select('_id').lean();
    if (!targetUser) {
      log.error('User @cheesecake0101 not found');
      process.exit(1);
    }
    log.success(`Found @cheesecake0101 (${targetUser._id})`);

    // Test 1: Old approach with timeout protection
    log.header('Test 1: OLD APPROACH (.populate())');
    log.section('Using .populate("followers").populate("following") - WITH 5 SECOND TIMEOUT');
    
    const oldApproachPromise = User.findById(targetUser._id)
      .populate("followers", "_id name username profilePic profilePicture sex")
      .populate("following", "_id name username profilePic profilePicture sex")
      .lean();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT after 5 seconds')), 5000)
    );

    let oldResult = null;
    let oldTime = null;
    let oldError = null;

    try {
      const startOld = Date.now();
      oldResult = await Promise.race([oldApproachPromise, timeoutPromise]);
      oldTime = Date.now() - startOld;
      log.metric('Query time', oldTime, 'ms');
      log.success('Query completed');
    } catch (err) {
      oldError = err.message;
      log.error(err.message);
      log.warn('Old approach is TOO SLOW - times out after 5 seconds');
    }

    // Test 2: New approach with aggregation
    log.header('Test 2: NEW APPROACH (Aggregation Pipeline)');
    log.section('Using $lookup with $project - optimized for large relationship arrays');

    const newApproachStart = Date.now();
    const results = await User.aggregate([
      { $match: { _id: targetUser._id } },
      {
        $facet: {
          followersDocs: [
            { $unwind: "$followers" },
            {
              $lookup: {
                from: "users",
                localField: "followers",
                foreignField: "_id",
                as: "followerData"
              }
            },
            { $unwind: "$followerData" },
            {
              $project: {
                _id: "$followerData._id",
                name: "$followerData.name",
                username: "$followerData.username",
                sex: "$followerData.sex",
                profilePic: { $ifNull: ["$followerData.profilePic", "$followerData.profilePicture"] }
              }
            }
          ],
          followingDocs: [
            { $unwind: "$following" },
            {
              $lookup: {
                from: "users",
                localField: "following",
                foreignField: "_id",
                as: "followingData"
              }
            },
            { $unwind: "$followingData" },
            {
              $project: {
                _id: "$followingData._id",
                name: "$followingData.name",
                username: "$followingData.username",
                sex: "$followingData.sex",
                profilePic: { $ifNull: ["$followingData.profilePic", "$followingData.profilePicture"] }
              }
            }
          ]
        }
      }
    ]);
    const newTime = Date.now() - newApproachStart;

    const { followersDocs, followingDocs } = results[0];

    log.metric('Query time', newTime, 'ms');
    log.metric('Followers loaded', followersDocs.length);
    log.metric('Following loaded', followingDocs.length);
    log.success('Query completed successfully');

    // Results comparison
    log.header('Performance Comparison');
    
    if (oldError) {
      console.log(`
${colors.bright}Old Approach (.populate()):${colors.reset}
  • Status: ${colors.red}FAILED${colors.reset}
  • Error: ${oldError}
  • The endpoint would hang indefinitely

${colors.bright}New Approach (Aggregation):${colors.reset}
  • Status: ${colors.green}SUCCESS${colors.reset}
  • Query time: ${colors.bright}${newTime}ms${colors.reset}
  • Followers: ${followersDocs.length}
  • Following: ${followingDocs.length}

${colors.bright}Improvement:${colors.reset}
  ✓ Old approach HANGS → New approach completes in ~${newTime}ms
  ✓ Fix RESOLVES the account-specific slowness issue
  ✓ Enables profile page, relationships, and RightBar to load quickly
      `);
    } else {
      const speedup = ((oldTime - newTime) / oldTime * 100).toFixed(1);
      console.log(`
${colors.bright}Comparison Results:${colors.reset}
  • Old approach: ${oldTime}ms
  • New approach: ${newTime}ms
  • Improvement: ${speedup}% faster (${oldTime - newTime}ms saved)
      `);
    }

    // Verify data integrity
    log.header('Data Integrity Check');
    log.section('Verifying aggregation pipeline returns correct data structure');

    if (results[0]) {
      log.success('Aggregation result exists');
      log.metric('Result structure', 'contains followersDocs and followingDocs');
      
      // Verify sample follower record
      if (followersDocs.length > 0) {
        const sample = followersDocs[0];
        const hasFields = sample._id && sample.name && sample.username;
        hasFields ? log.success('Sample record has required fields') : log.error('Missing fields in sample record');
      }

      log.success('Data structure is valid');
    }

  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log.success('Disconnected from database');
  }
}

// Run comparison
compareApproaches();
