const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Event = require('./backend/models/event');

(async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
  
  const withEngagement = await Event.find({
    $or: [
      { 'engagementMetrics.views': { $gt: 0 } },
      { 'engagementMetrics.interested': { $gt: 0 } },
      { 'engagementMetrics.registrations': { $gt: 0 } }
    ]
  }).select('title engagementMetrics').lean();
  
  console.log('Events with engagement data:', withEngagement.length);
  withEngagement.forEach(e => {
    const em = e.engagementMetrics || {};
    console.log('-', e.title.substring(0, 50), '| views:', em.views, 'interested:', em.interested, 'regs:', em.registrations);
  });
  
  process.exit(0);
})();
