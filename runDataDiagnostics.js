// Simplified Data Quality Diagnostics
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✓ Connected to MongoDB\n");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
};

const runDiagnostics = async () => {
  try {
    const db = mongoose.connection.db;

    console.log("==============================================================");
    console.log("RECOMMENDATION SYSTEM DATA QUALITY DIAGNOSTICS");
    console.log("==============================================================\n");

    // 1. User Interest Population
    console.log("📊 1. USER INTEREST POPULATION");
    console.log("-----------------------------------------------");
    const users = await db.collection("users").find({}).toArray();
    const totalUsers = users.length;
    const usersWithInterests = users.filter((u) => u.interests && u.interests.length > 0).length;
    const interestCounts = users
      .filter((u) => u.interests && Array.isArray(u.interests))
      .map((u) => u.interests.length);
    const avgInterests = interestCounts.length > 0 ? interestCounts.reduce((a, b) => a + b, 0) / interestCounts.length : 0;

    console.log(`Total Users: ${totalUsers}`);
    console.log(`Users with Interests: ${usersWithInterests} (${((usersWithInterests / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Avg Interests per User: ${avgInterests.toFixed(2)}`);
    console.log(`Max Interests: ${Math.max(...interestCounts, 0)}`);
    console.log(`Min Interests: ${interestCounts.length > 0 ? Math.min(...interestCounts) : 0}`);
    console.log("");

    // 2. Post & Engagement Data
    console.log("📈 2. POST & ENGAGEMENT DATA");
    console.log("-----------------------------------------------");
    const posts = await db.collection("posts").find({}).toArray();
    const totalPosts = posts.length;

    // Count engagement
    const postsWithLikes = posts.filter((p) => {
      const likes = p.likes;
      return likes && (Array.isArray(likes) ? likes.length > 0 : likes > 0);
    }).length;

    const postsWithComments = posts.filter((p) => {
      const comments = p.comments;
      return comments && (Array.isArray(comments) ? comments.length > 0 : comments > 0);
    }).length;

    const postsWithShares = posts.filter((p) => {
      const shares = p.shares;
      return shares && (Array.isArray(shares) ? shares.length > 0 : shares > 0);
    }).length;

    // Calculate total engagement
    let totalLikes = 0,
      totalComments = 0,
      totalShares = 0;
    posts.forEach((p) => {
      if (p.likes) totalLikes += Array.isArray(p.likes) ? p.likes.length : p.likes;
      if (p.comments) totalComments += Array.isArray(p.comments) ? p.comments.length : p.comments;
      if (p.shares) totalShares += Array.isArray(p.shares) ? p.shares.length : p.shares;
    });

    console.log(`Total Posts: ${totalPosts}`);
    console.log(`Posts with Likes: ${postsWithLikes} (${((postsWithLikes / totalPosts) * 100).toFixed(1)}%)`);
    console.log(`Posts with Comments: ${postsWithComments} (${((postsWithComments / totalPosts) * 100).toFixed(1)}%)`);
    console.log(`Posts with Shares: ${postsWithShares} (${((postsWithShares / totalPosts) * 100).toFixed(1)}%)`);
    console.log(`Total Likes: ${totalLikes}, Avg per Post: ${(totalLikes / totalPosts).toFixed(2)}`);
    console.log(`Total Comments: ${totalComments}, Avg per Post: ${(totalComments / totalPosts).toFixed(2)}`);
    console.log(`Total Shares: ${totalShares}, Avg per Post: ${(totalShares / totalPosts).toFixed(2)}`);
    console.log("");

    // 3. Event Engagement
    console.log("🎭 3. EVENT & ATTENDANCE DATA");
    console.log("-----------------------------------------------");
    const events = await db.collection("events").find({}).toArray();
    const totalEvents = events.length;

    const eventsWithAttendees = events.filter((e) => {
      const attendees = e.attendees;
      return attendees && (Array.isArray(attendees) ? attendees.length > 0 : attendees > 0);
    }).length;

    let totalAttendees = 0;
    events.forEach((e) => {
      if (e.attendees) totalAttendees += Array.isArray(e.attendees) ? e.attendees.length : e.attendees;
    });

    console.log(`Total Events: ${totalEvents}`);
    console.log(`Events with Attendees: ${eventsWithAttendees} (${((eventsWithAttendees / totalEvents) * 100).toFixed(1)}%)`);
    console.log(`Total Registrations: ${totalAttendees}`);
    console.log(`Avg Attendees per Event: ${(totalAttendees / totalEvents).toFixed(2)}`);
    console.log("");

    // 4. Tag Coverage
    console.log("🏷️  4. TAG EXTRACTION & COVERAGE");
    console.log("-----------------------------------------------");
    const postsWithTags = posts.filter((p) => p.tags && p.tags.length > 0).length;
    const tagCounts = posts.filter((p) => p.tags && Array.isArray(p.tags)).map((p) => p.tags.length);
    const avgTags = tagCounts.length > 0 ? tagCounts.reduce((a, b) => a + b, 0) / tagCounts.length : 0;

    console.log(`Posts with Tags: ${postsWithTags} (${((postsWithTags / totalPosts) * 100).toFixed(1)}%)`);
    console.log(`Avg Tags per Post: ${avgTags.toFixed(2)}`);
    console.log(`Max Tags: ${Math.max(...tagCounts, 0)}`);
    console.log("");

    // Category breakdown
    const categories = {};
    posts.forEach((p) => {
      const cat = p.category || "uncategorized";
      categories[cat] = (categories[cat] || 0) + 1;
    });
    console.log("Category Breakdown:");
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
    console.log("");

    // 5. Network Connectivity
    console.log("🤝 5. NETWORK CONNECTIVITY");
    console.log("-----------------------------------------------");
    const usersWithFollowing = users.filter((u) => u.following && u.following.length > 0).length;
    const usersWithFollowers = users.filter((u) => u.followers && u.followers.length > 0).length;

    let totalFollowing = 0,
      totalFollowers = 0;
    users.forEach((u) => {
      if (u.following) totalFollowing += u.following.length;
      if (u.followers) totalFollowers += u.followers.length;
    });

    console.log(`Users with Following: ${usersWithFollowing} (${((usersWithFollowing / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Users with Followers: ${usersWithFollowers} (${((usersWithFollowers / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Total Following Connections: ${totalFollowing}`);
    console.log(`Total Follower Connections: ${totalFollowers}`);
    console.log(`Avg Following per User: ${(totalFollowing / totalUsers).toFixed(2)}`);
    console.log(`Avg Followers per User: ${(totalFollowers / totalUsers).toFixed(2)}`);
    console.log("");

    // 6. Organization Membership
    console.log("🏢 6. ORGANIZATION MEMBERSHIP");
    console.log("-----------------------------------------------");
    const usersWithOrg = users.filter((u) => u.organisation && u.organisation.length > 0).length;
    let totalOrgMemberships = 0;
    users.forEach((u) => {
      if (u.organisation) totalOrgMemberships += u.organisation.length;
    });

    console.log(`Users with Organization: ${usersWithOrg} (${((usersWithOrg / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Total Org Memberships: ${totalOrgMemberships}`);
    console.log(`Avg Orgs per User: ${(totalOrgMemberships / totalUsers).toFixed(2)}`);
    console.log("");

    // 7. Overall Quality Score
    console.log("⚡ 7. OVERALL DATA QUALITY ASSESSMENT");
    console.log("-----------------------------------------------");
    const interestPct = (usersWithInterests / totalUsers) * 100;
    const engagementRatio = ((postsWithLikes + postsWithComments + postsWithShares) / (totalPosts * 3)) * 100;
    const tagCoverage = (postsWithTags / totalPosts) * 100;
    const networkDensity = ((usersWithFollowing + usersWithFollowers) / (totalUsers * 2)) * 100;

    const qualityScore = (interestPct * 0.3 + engagementRatio * 0.25 + tagCoverage * 0.25 + networkDensity * 0.2) / 100;

    console.log(`Interest Population: ${interestPct.toFixed(1)}% → ${interestPct >= 70 ? "✓ EXCELLENT" : interestPct >= 50 ? "⚠ GOOD" : "✗ POOR"}`);
    console.log(`Engagement Ratio: ${engagementRatio.toFixed(1)}% → ${engagementRatio >= 40 ? "✓ EXCELLENT" : engagementRatio >= 20 ? "⚠ GOOD" : "✗ POOR"}`);
    console.log(`Tag Coverage: ${tagCoverage.toFixed(1)}% → ${tagCoverage >= 70 ? "✓ EXCELLENT" : tagCoverage >= 50 ? "⚠ GOOD" : "✗ POOR"}`);
    console.log(`Network Density: ${networkDensity.toFixed(1)}% → ${networkDensity >= 40 ? "✓ EXCELLENT" : networkDensity >= 20 ? "⚠ GOOD" : "✗ POOR"}`);
    console.log("");
    console.log(`📊 OVERALL QUALITY SCORE: ${(qualityScore * 100).toFixed(1)}/100`);
    console.log(`Status: ${qualityScore >= 0.7 ? "✓ SYSTEM READY FOR EVALUATION" : qualityScore >= 0.5 ? "⚠ ACCEPTABLE (DATA GAPS EXIST)" : "✗ INSUFFICIENT DATA FOR EVALUATION"}`);
    console.log("");

    // 8. Recommendations
    console.log("💡 IMPROVEMENT RECOMMENDATIONS");
    console.log("-----------------------------------------------");
    const issues = [];

    if (interestPct < 50) {
      issues.push(
        "🔴 CRITICAL: User interests barely populated. Without interests, collaborative filtering impossible."
      );
    } else if (interestPct < 70) {
      issues.push("🟡 WARNING: User interests only " + interestPct.toFixed(0) + "% populated. Seed remaining users.");
    } else {
      issues.push("✓ User interests: EXCELLENT coverage");
    }

    if (engagementRatio < 20) {
      issues.push(
        "🔴 CRITICAL: Post engagement extremely sparse. Metric accuracy will be very low. Consider generating test data."
      );
    } else if (engagementRatio < 40) {
      issues.push("🟡 WARNING: Post engagement limited to " + engagementRatio.toFixed(0) + "%. Recommendation confidence will be lower.");
    } else {
      issues.push("✓ Post engagement: GOOD diversity");
    }

    if (tagCoverage < 50) {
      issues.push("🔴 CRITICAL: Tag coverage insufficient. Most posts untagged.");
    } else if (tagCoverage < 70) {
      issues.push("🟡 WARNING: Tag coverage " + tagCoverage.toFixed(0) + "%. Improve tag extraction.");
    } else {
      issues.push("✓ Tag coverage: EXCELLENT");
    }

    if (networkDensity < 20) {
      issues.push(
        "🔴 CRITICAL: Network graph sparse. Collaborative filtering will be weak. Seed following relationships."
      );
    } else if (networkDensity < 40) {
      issues.push("🟡 WARNING: Network density weak at " + networkDensity.toFixed(0) + "%. Social signals underutilized.");
    } else {
      issues.push("✓ Network density: GOOD connectivity");
    }

    issues.forEach((issue) => console.log(issue));
    console.log("");

    // Expected metric improvements
    console.log("📈 EXPECTED METRIC IMPROVEMENTS (if data gaps fixed)");
    console.log("-----------------------------------------------");
    console.log(`Current State: Cosine Similarity ~0.073, MRR ~0.000`);
    console.log(`With Quality Score 0.7+: Cosine Similarity 0.60-0.75, MRR 0.50-0.75`);
    console.log(`Action Items:`);
    if (interestPct < 70) console.log(`  1. Populate missing user interests (${100 - interestPct.toFixed(0)}% gap)`);
    if (engagementRatio < 40) console.log(`  2. Generate test engagement data (likes, comments, shares)`);
    if (tagCoverage < 70) console.log(`  3. Improve tag extraction strategies`);
    if (networkDensity < 40) console.log(`  4. Seed following relationships between similar users`);
    console.log("");

    console.log("==============================================================\n");
  } catch (error) {
    console.error("Error running diagnostics:", error);
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB");
  }
};

connectDB().then(() => runDiagnostics());
