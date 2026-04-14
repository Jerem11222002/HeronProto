/**
 * Database Audit Script
 * Scans the database for data quality issues and generates a comprehensive report
 * Run: node backend/scripts/auditDatabase.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Post = require('../models/posts');
const Event = require('../models/event');
const User = require('../models/users');

const auditResults = {
  timestamp: new Date().toISOString(),
  posts: {
    total: 0,
    withoutTags: [],
    withoutEngagementMetrics: [],
    withoutOrganization: [],
    quality: {}
  },
  events: {
    total: 0,
    withoutTags: [],
    withoutEngagementMetrics: [],
    pastEvents: [],
    quality: {}
  },
  users: {
    total: 0,
    withoutInterests: [],
    withoutOrganizations: [],
    quality: {}
  },
  summary: {
    totalIssues: 0,
    criticalIssues: 0,
    recommendations: []
  }
};

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/heron';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }
}

async function auditPosts() {
  console.log('\n📝 Auditing Posts...');
  try {
    const posts = await Post.find().lean();
    auditResults.posts.total = posts.length;

    posts.forEach(post => {
      // Check for missing tags
      if (!post.tags || post.tags.length === 0) {
        auditResults.posts.withoutTags.push({
          id: post._id,
          title: post.desc?.slice(0, 50),
          createdAt: post.createdAt
        });
      }

      // Check for missing engagement metrics
      if (!post.engagementMetrics || Object.keys(post.engagementMetrics).length === 0) {
        auditResults.posts.withoutEngagementMetrics.push({
          id: post._id,
          title: post.desc?.slice(0, 50)
        });
      }

      // Check for missing organization
      if (!post.organization) {
        auditResults.posts.withoutOrganization.push({
          id: post._id,
          title: post.desc?.slice(0, 50)
        });
      }
    });

    auditResults.posts.quality = {
      completeness: {
        withTags: ((posts.length - auditResults.posts.withoutTags.length) / posts.length * 100).toFixed(1),
        withEngagementMetrics: ((posts.length - auditResults.posts.withoutEngagementMetrics.length) / posts.length * 100).toFixed(1),
        withOrganization: ((posts.length - auditResults.posts.withoutOrganization.length) / posts.length * 100).toFixed(1)
      },
      stats: {
        totalWithoutTags: auditResults.posts.withoutTags.length,
        totalWithoutMetrics: auditResults.posts.withoutEngagementMetrics.length,
        totalWithoutOrg: auditResults.posts.withoutOrganization.length
      }
    };

    console.log(`   ✓ Audited ${posts.length} posts`);
    console.log(`   🔴 ${auditResults.posts.withoutTags.length} posts without tags`);
    console.log(`   🔴 ${auditResults.posts.withoutEngagementMetrics.length} posts without metrics`);
  } catch (error) {
    console.error('❌ Error auditing posts:', error.message);
  }
}

async function auditEvents() {
  console.log('\n📅 Auditing Events...');
  try {
    const events = await Event.find().lean();
    auditResults.events.total = events.length;
    const now = new Date();

    events.forEach(event => {
      // Check for missing tags
      if (!event.tags || event.tags.length === 0) {
        auditResults.events.withoutTags.push({
          id: event._id,
          title: event.title,
          organization: event.organization
        });
      }

      // Check for missing engagement metrics
      if (!event.engagementMetrics || Object.keys(event.engagementMetrics).length === 0) {
        auditResults.events.withoutEngagementMetrics.push({
          id: event._id,
          title: event.title
        });
      }

      // Check for past events
      if (new Date(event.date) < now && event.status !== 'completed') {
        auditResults.events.pastEvents.push({
          id: event._id,
          title: event.title,
          date: event.date,
          status: event.status,
          daysOverdue: Math.floor((now - new Date(event.date)) / (1000 * 60 * 60 * 24))
        });
      }
    });

    auditResults.events.quality = {
      completeness: {
        withTags: ((events.length - auditResults.events.withoutTags.length) / events.length * 100).toFixed(1),
        withEngagementMetrics: ((events.length - auditResults.events.withoutEngagementMetrics.length) / events.length * 100).toFixed(1)
      },
      stats: {
        totalWithoutTags: auditResults.events.withoutTags.length,
        totalWithoutMetrics: auditResults.events.withoutEngagementMetrics.length,
        pastEvents: auditResults.events.pastEvents.length
      }
    };

    console.log(`   ✓ Audited ${events.length} events`);
    console.log(`   🔴 ${auditResults.events.withoutTags.length} events without tags`);
    console.log(`   🔴 ${auditResults.events.withoutEngagementMetrics.length} events without metrics`);
    console.log(`   🟡 ${auditResults.events.pastEvents.length} past events`);
  } catch (error) {
    console.error('❌ Error auditing events:', error.message);
  }
}

async function auditUsers() {
  console.log('\n👥 Auditing Users...');
  try {
    const users = await User.find().lean();
    auditResults.users.total = users.length;

    users.forEach(user => {
      // Check for missing interests
      if (!user.interests || user.interests.length === 0) {
        auditResults.users.withoutInterests.push({
          id: user._id,
          name: user.name
        });
      }

      // Check for missing organizations
      if (!user.organizations || user.organizations.length === 0) {
        auditResults.users.withoutOrganizations.push({
          id: user._id,
          name: user.name
        });
      }
    });

    auditResults.users.quality = {
      completeness: {
        withInterests: ((users.length - auditResults.users.withoutInterests.length) / users.length * 100).toFixed(1),
        withOrganizations: ((users.length - auditResults.users.withoutOrganizations.length) / users.length * 100).toFixed(1)
      },
      stats: {
        totalWithoutInterests: auditResults.users.withoutInterests.length,
        totalWithoutOrgs: auditResults.users.withoutOrganizations.length
      }
    };

    console.log(`   ✓ Audited ${users.length} users`);
    console.log(`   🔴 ${auditResults.users.withoutInterests.length} users without interests`);
    console.log(`   🔴 ${auditResults.users.withoutOrganizations.length} users without organizations`);
  } catch (error) {
    console.error('❌ Error auditing users:', error.message);
  }
}

function generateSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 DATA QUALITY AUDIT SUMMARY');
  console.log('='.repeat(70));

  const postIssues = auditResults.posts.withoutTags.length + auditResults.posts.withoutEngagementMetrics.length;
  const eventIssues = auditResults.events.withoutTags.length + auditResults.events.withoutEngagementMetrics.length;
  const userIssues = auditResults.users.withoutInterests.length + auditResults.users.withoutOrganizations.length;

  auditResults.summary.totalIssues = postIssues + eventIssues + userIssues;
  auditResults.summary.criticalIssues = auditResults.posts.withoutTags.length + auditResults.events.withoutTags.length;

  console.log('\n🔴 CRITICAL ISSUES (Prevent Recommendations):');
  console.log(`   Posts without tags:     ${auditResults.posts.withoutTags.length}/${auditResults.posts.total}`);
  console.log(`   Events without tags:    ${auditResults.events.withoutTags.length}/${auditResults.events.total}`);

  console.log('\n🟡 HIGH PRIORITY ISSUES:');
  console.log(`   Posts without metrics:  ${auditResults.posts.withoutEngagementMetrics.length}/${auditResults.posts.total}`);
  console.log(`   Events without metrics: ${auditResults.events.withoutEngagementMetrics.length}/${auditResults.events.total}`);
  console.log(`   Past events (wrong status): ${auditResults.events.pastEvents.length}/${auditResults.events.total}`);

  console.log('\n🟠 SECONDARY ISSUES:');
  console.log(`   Users without interests: ${auditResults.users.withoutInterests.length}/${auditResults.users.total}`);
  console.log(`   Users without orgs:      ${auditResults.users.withoutOrganizations.length}/${auditResults.users.total}`);

  console.log('\n📈 DATA COMPLETENESS SCORES:');
  console.log(`   Posts with tags:        ${auditResults.posts.quality.completeness.withTags}%`);
  console.log(`   Events with tags:       ${auditResults.events.quality.completeness.withTags}%`);
  console.log(`   Posts with metrics:     ${auditResults.posts.quality.completeness.withEngagementMetrics}%`);
  console.log(`   Events with metrics:    ${auditResults.events.quality.completeness.withEngagementMetrics}%`);

  console.log('\n✅ RECOMMENDATIONS:');
  console.log(`   1. Run: npm run fix:tags:posts`);
  console.log(`   2. Run: npm run fix:tags:events`);
  console.log(`   3. Run: npm run fix:metrics:events`);
  console.log(`   4. Update ${auditResults.users.withoutInterests.length} users with missing interests`);
  console.log(`   5. Update ${auditResults.events.pastEvents.length} past events to 'completed' status`);

  console.log('\n' + '='.repeat(70));
  console.log(`Total Issues Found: ${auditResults.summary.totalIssues}`);
  console.log(`Critical Issues: ${auditResults.summary.criticalIssues}`);
  console.log('='.repeat(70) + '\n');

  // Save report to file
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '../../DATABASE_AUDIT_REPORT.json'),
    JSON.stringify(auditResults, null, 2)
  );
  console.log('📁 Full report saved to: DATABASE_AUDIT_REPORT.json\n');
}

async function main() {
  try {
    await connectDB();
    await auditPosts();
    await auditEvents();
    await auditUsers();
    generateSummary();
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();
