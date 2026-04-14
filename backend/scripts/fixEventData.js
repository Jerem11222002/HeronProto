/**
 * Data Migration - Fix Missing Tags and Metrics on Events
 * Run: node backend/scripts/fixEventData.js
 * 
 * This script:
 * 1. Finds events without tags and generates them
 * 2. Initializes missing engagement metrics
 * 3. Fixes past events with wrong status
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Event = require('../models/event');
const TagExtractor = require('../utils/tagExtractor');

let tagsFixed = 0;
let metricsFixed = 0;
let statusFixed = 0;
let errorCount = 0;

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/heron';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }
}

async function fixEventData() {
  try {
    console.log('🔍 Finding events with missing data...\n');
    const events = await Event.find().lean();
    console.log(`📅 Found ${events.length} total events\n`);
    console.log('━'.repeat(70));

    const now = new Date();

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      let updated = false;
      const updates = {};

      console.log(`\n[${i + 1}/${events.length}] Processing: ${event.title?.slice(0, 40)}...`);

      try {
        // Fix missing tags
        if (!event.tags || event.tags.length === 0) {
          const generatedTags = TagExtractor.extractEventTags(event);
          if (generatedTags.length > 0) {
            updates.tags = generatedTags;
            console.log(`   📋 Generated tags: [${generatedTags.slice(0, 3).join(', ')}...]`);
            tagsFixed++;
            updated = true;
          }
        }

        // Initialize missing engagement metrics
        if (!event.engagementMetrics || Object.keys(event.engagementMetrics).length === 0) {
          updates.engagementMetrics = {
            views: 0,
            shares: 0,
            interested: event.interested?.length || 0,
            registrations: event.registrations?.length || 0,
            completionRate: 0,
            avgRating: 0,
            clickThrough: 0,
            timeSpent: 0,
            bounceRate: 0,
            registrationConversion: 0
          };
          console.log(`   📊 Initialized engagement metrics`);
          metricsFixed++;
          updated = true;
        }

        // Fix past events with wrong status
        if (new Date(event.date) < now && event.status !== 'completed') {
          const daysOverdue = Math.floor((now - new Date(event.date)) / (1000 * 60 * 60 * 24));
          if (daysOverdue > 1) { // Only fix if more than 1 day past
            updates.status = 'completed';
            console.log(`   🔄 Fixed status to 'completed' (${daysOverdue} days past)`);
            statusFixed++;
            updated = true;
          }
        }

        // Apply updates if any
        if (updated) {
          await Event.findByIdAndUpdate(event._id, updates, { new: true });
          console.log(`   ✅ Updated successfully`);
        } else {
          console.log(`   ⏭️  No updates needed`);
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '━'.repeat(70));
    console.log(`\n✅ MIGRATION COMPLETE:`);
    console.log(`   ✓ Fixed tags:       ${tagsFixed} events`);
    console.log(`   ✓ Fixed metrics:    ${metricsFixed} events`);
    console.log(`   ✓ Fixed status:     ${statusFixed} events`);
    console.log(`   ✗ Errors:          ${errorCount} events\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function main() {
  try {
    await connectDB();
    await fixEventData();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

main();
