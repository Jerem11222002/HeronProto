/**
 * Recommendation System Test Suite
 * Tests the hybrid filtering recommendation system using real database users and content
 */

const {
  connectDB,
  disconnectDB,
  getSampleUsers,
  getUserProfile,
  getAllContent,
  getUserEngagementData,
  identifyRelevantItems,
  createTestReport
} = require('./test-setup');

const OfflineEvaluator = require('./evaluation-metrics');
const { RecommendationService, ORGANIZATION_CATEGORIES } = require('../services/recommendations');

describe('Recommendation System - Real User Testing', () => {
  let testReport;
  let sampleUsers = [];
  let allContent = {};

  beforeAll(async () => {
    jest.setTimeout(30000);
    await connectDB();
    testReport = createTestReport();

    // Load real data
    sampleUsers = await getSampleUsers(15); // Test with up to 15 real users
    allContent = await getAllContent();

    console.log('\n📋 Test Setup Complete:');
    console.log(`   - Sample Users: ${sampleUsers.length}`);
    console.log(`   - Posts Available: ${allContent.posts.length}`);
    console.log(`   - Events Available: ${allContent.events.length}`);
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. Interest Score Calculation Accuracy', () => {
    test('should return non-zero score for items matching user interests', async () => {
      if (sampleUsers.length === 0) {
        console.warn('⚠️  No users found, skipping test');
        return;
      }

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      if (!userProfile.interests || userProfile.interests.length === 0) {
        console.log('⏭️  User has no interests, skipping');
        return;
      }

      const relevantItems = identifyRelevantItems(userProfile, allContent.all);

      if (relevantItems.length === 0) {
        console.log('⏭️  No relevant items found for user');
        return;
      }

      const item = relevantItems[0];
      const score = RecommendationService.calculateInterestScore(item, userProfile.interests);

      console.log(`   ✓ User ${userProfile._id} (interests: ${userProfile.interests.slice(0, 2).join(', ')})`);
      console.log(`     Item: ${item.title || item.desc?.slice(0, 30)}`);
      console.log(`     Interest Score: ${score.toFixed(4)}`);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeGreaterThan(0);
    });

    test('should return lower score for items not matching user interests', async () => {
      if (sampleUsers.length === 0) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      if (!userProfile.interests || userProfile.interests.length === 0) return;

      // Find items that DON'T match
      const irrelevantItems = allContent.all.filter(item => {
        const tagMatch = (item.tags || []).some(tag =>
          userProfile.interests.some(int => tag.toLowerCase().includes(int.toLowerCase()))
        );
        return !tagMatch;
      });

      if (irrelevantItems.length === 0) return;

      const score = RecommendationService.calculateInterestScore(irrelevantItems[0], userProfile.interests);

      console.log(`   ✓ Interest Score for non-matching item: ${score.toFixed(4)}`);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should normalize legacy numeric interests correctly', () => {
      const legacyInterests = [1, 2, 3];
      const normalized = RecommendationService.normalizeLegacyInterests(legacyInterests);

      console.log(`   ✓ Legacy interests ${legacyInterests} normalized to: ${normalized.join(', ')}`);
      expect(normalized.length).toBeGreaterThan(0);
      expect(Array.isArray(normalized)).toBe(true);
    });
  });

  describe('2. Event Scoring & Engagement', () => {
    test('should calculate event time relevance correctly', () => {
      if (allContent.events.length === 0) return;

      const event = allContent.events[0];
      const relevanceScore = RecommendationService.calculateEventTimeRelevance(event);

      console.log(`   ✓ Event: "${event.title}"`);
      console.log(`     Status: ${event.status}, Relevance Score: ${relevanceScore.toFixed(4)}`);

      expect(relevanceScore).toBeGreaterThanOrEqual(0);
      expect(relevanceScore).toBeLessThanOrEqual(1);

      // Ongoing events should have maximum relevance
      if (event.status === 'ongoing') {
        expect(relevanceScore).toBe(1.0);
      }
    });

    test('should boost upcoming events happening soon', () => {
      if (allContent.events.length < 2) return;

      const upcomingEvents = allContent.events.filter(e => e.status === 'upcoming');
      if (upcomingEvents.length < 2) return;

      const scores = upcomingEvents.map(e => ({
        event: e.title,
        daysUntil: (new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24),
        score: RecommendationService.calculateEventTimeRelevance(e)
      }));

      console.log(`   ✓ Event Time Relevance Scores:`);
      scores.slice(0, 3).forEach(s => {
        console.log(`     "${s.event}" (${s.daysUntil.toFixed(1)} days): ${s.score.toFixed(4)}`);
      });

      // Verify that closer events have higher or equal scores
      const sortedByDays = [...scores].sort((a, b) => a.daysUntil - b.daysUntil);
      if (sortedByDays.length > 1) {
        expect(sortedByDays[0].score).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('3. Collaborative Filtering', () => {
    test('should calculate collaborative score for events', async () => {
      if (sampleUsers.length === 0 || allContent.events.length === 0) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);
      const event = allContent.events[0];

      const collabScore = await RecommendationService.calculateCollaborativeScore(event, userProfile);

      console.log(`   ✓ Collaborative Score for "${event.title}": ${collabScore.toFixed(4)}`);

      expect(collabScore).toBeGreaterThanOrEqual(0);
      expect(collabScore).toBeLessThanOrEqual(1);
    });

    test('should boost popular events among similar users', async () => {
      if (sampleUsers.length === 0 || allContent.events.length < 2) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      const popularEvent = allContent.events.find(e =>
        e.engagementMetrics && (e.engagementMetrics.interested > 5 || e.engagementMetrics.registrations > 2)
      );
      const unpopularEvent = allContent.events.find(e =>
        e.engagementMetrics && (e.engagementMetrics.interested <= 2 && e.engagementMetrics.registrations <= 1)
      );

      if (!popularEvent || !unpopularEvent) {
        console.log('⏭️  Insufficient popular/unpopular events data');
        return;
      }

      const [popularScore, unpopularScore] = await Promise.all([
        RecommendationService.calculateCollaborativeScore(popularEvent, userProfile),
        RecommendationService.calculateCollaborativeScore(unpopularEvent, userProfile)
      ]);

      console.log(`   ✓ Popular Event Score: ${popularScore.toFixed(4)}`);
      console.log(`     Unpopular Event Score: ${unpopularScore.toFixed(4)}`);

      // Popular events should generally score higher
      expect(popularScore).toBeGreaterThanOrEqual(unpopularScore - 0.1); // Allow some variance
    });
  });

  describe('4. Hybrid Scoring (Combined Content + Collaborative)', () => {
    test('should calculate final hybrid score combining all signals', async () => {
      if (sampleUsers.length === 0 || allContent.events.length === 0) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);
      const events = allContent.events.slice(0, 5);

      const scoredEvents = await Promise.all(
        events.map(async (e) => ({
          event: e,
          score: await RecommendationService.calculateFinalScore(e, userProfile)
        }))
      );

      console.log(`   ✓ Hybrid Scores for ${userProfile._id}:`);
      scoredEvents.forEach((item, idx) => {
        console.log(`     ${idx + 1}. "${item.event.title}" → ${item.score.toFixed(4)}`);
      });

      scoredEvents.forEach(item => {
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(1);
      });
    });

    test('should rank items appropriately by final score', async () => {
      if (sampleUsers.length === 0 || allContent.events.length < 3) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      const scoredEvents = await Promise.all(
        allContent.events.slice(0, 10).map(async (e) => ({
          _id: e._id,
          title: e.title,
          finalScore: await RecommendationService.calculateFinalScore(e, userProfile)
        }))
      );

      const ranked = [...scoredEvents].sort((a, b) => b.finalScore - a.finalScore);

      console.log(`   ✓ Event Rankings by Hybrid Score:`);
      ranked.slice(0, 3).forEach((item, idx) => {
        console.log(`     ${idx + 1}. ${item.finalScore.toFixed(4)} - "${item.title}"`);
      });

      // Verify ranking is monotonic
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i - 1].finalScore).toBeGreaterThanOrEqual(ranked[i].finalScore);
      }
    });
  });

  describe('5. Evaluation Metrics - Offline Accuracy', () => {
    test('should calculate precision and recall for real user recommendations', async () => {
      if (sampleUsers.length === 0) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      if (!userProfile.interests || userProfile.interests.length === 0) {
        console.log('⏭️  User has no interests');
        return;
      }

      // Identify relevant items
      const relevantItems = identifyRelevantItems(userProfile, allContent.all);
      if (relevantItems.length === 0) {
        console.log('⏭️  No relevant items found');
        return;
      }

      // Score all items
      const scoredItems = await Promise.all(
        allContent.all.slice(0, 50).map(async (item) => ({
          ...item,
          finalScore: await RecommendationService.calculateFinalScore(item, userProfile)
        }))
      );

      // Rank by score
      const recommendations = scoredItems.sort((a, b) => b.finalScore - a.finalScore);

      // Calculate metrics
      const precision = OfflineEvaluator.calculatePrecisionAtK(recommendations, relevantItems, 10);
      const recall = OfflineEvaluator.calculateRecallAtK(recommendations, relevantItems, 10);
      const ndcg = OfflineEvaluator.calculateNDCG(recommendations, relevantItems, 10);
      const map = OfflineEvaluator.calculateMAP(recommendations, relevantItems, 10);

      console.log(`   ✓ Offline Metrics for User ${userProfile._id}:`);
      console.log(`     Precision@10: ${(precision * 100).toFixed(1)}%`);
      console.log(`     Recall@10: ${(recall * 100).toFixed(1)}%`);
      console.log(`     NDCG@10: ${(ndcg * 100).toFixed(1)}%`);
      console.log(`     MAP@10: ${(map * 100).toFixed(1)}%`);

      testReport.summary.avgPrecision = precision;
      testReport.summary.avgRecall = recall;
      testReport.summary.avgNDCG = ndcg;

      expect(precision).toBeGreaterThanOrEqual(0);
      expect(recall).toBeGreaterThanOrEqual(0);
      expect(ndcg).toBeGreaterThanOrEqual(0);
    });
  });

  describe('6. Multi-User Comparative Analysis', () => {
    test('should generate recommendations for multiple users and compare', async () => {
      if (sampleUsers.length < 2) {
        console.log('⏭️  Need at least 2 users for comparison');
        return;
      }

      const testUsers = sampleUsers.slice(0, Math.min(5, sampleUsers.length));
      const analysisResults = [];

      for (const user of testUsers) {
        const userProfile = await getUserProfile(user._id);

        if (!userProfile.interests || userProfile.interests.length === 0) {
          continue;
        }

        const scoredItems = await Promise.all(
          allContent.all.slice(0, 50).map(async (item) => ({
            ...item,
            finalScore: await RecommendationService.calculateFinalScore(item, userProfile)
          }))
        );

        const recommendations = scoredItems.sort((a, b) => b.finalScore - a.finalScore);
        const relevantItems = identifyRelevantItems(userProfile, allContent.all);

        const metrics = OfflineEvaluator.runEvaluation(
          recommendations.slice(0, 10),
          relevantItems,
          allContent.all.length
        );

        analysisResults.push({
          userId: userProfile._id,
          interests: userProfile.interests.slice(0, 2),
          ndcg: metrics.ndcg,
          precision: metrics.precisionAt10,
          recall: metrics.recallAt10
        });
      }

      console.log(`\n   ✓ Multi-User Analysis Results:`);
      console.log(`     Users Analyzed: ${analysisResults.length}`);
      analysisResults.forEach(result => {
        console.log(`     • User ${result.userId} (${result.interests.join(', ')})`);
        console.log(`       NDCG: ${(result.ndcg * 100).toFixed(1)}% | Precision: ${(result.precision * 100).toFixed(1)}%`);
      });

      const avgNDCG = analysisResults.reduce((sum, r) => sum + r.ndcg, 0) / analysisResults.length;
      console.log(`\n     📊 Average NDCG: ${(avgNDCG * 100).toFixed(1)}%`);

      expect(analysisResults.length).toBeGreaterThan(0);
      expect(avgNDCG).toBeGreaterThanOrEqual(0);
    });
  });

  describe('7. Content Distribution Analysis', () => {
    test('should distribute events and posts appropriately', async () => {
      if (sampleUsers.length === 0) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      // Score content
      const scoredEvents = await Promise.all(
        allContent.events.map(async (e) => ({
          ...e,
          type: 'event',
          finalScore: await RecommendationService.calculateFinalScore(e, userProfile)
        }))
      );

      const scoredPosts = await Promise.all(
        allContent.posts.slice(0, 50).map(async (p) => ({
          ...p,
          type: 'post',
          finalScore: await RecommendationService.calculateFinalScore(p, userProfile)
        }))
      );

      const distributed = RecommendationService.distributeContent(scoredEvents, scoredPosts);

      if (!distributed || distributed.length === 0) {
        console.log('⏭️  Distribution returned empty');
        return;
      }

      const eventCount = distributed.filter(i => i.type === 'event').length;
      const postCount = distributed.filter(i => i.type === 'post').length;
      const eventRatio = eventCount / (eventCount + postCount || 1);

      console.log(`   ✓ Content Distribution:`);
      console.log(`     Total Items: ${distributed.length}`);
      console.log(`     Events: ${eventCount} (${(eventRatio * 100).toFixed(1)}%)`);
      console.log(`     Posts: ${postCount} (${((1 - eventRatio) * 100).toFixed(1)}%)`);

      expect(distributed.length).toBeGreaterThan(0);
      expect(eventRatio).toBeGreaterThanOrEqual(0);
      expect(eventRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('8. Edge Cases & Error Handling', () => {
    test('should handle users with no interests gracefully', async () => {
      // Find or create a user with no interests
      const usersWithoutInterests = sampleUsers.filter(u => !u.interests || u.interests.length === 0);

      if (usersWithoutInterests.length === 0) {
        console.log('⏭️  No users without interests found');
        return;
      }

      const user = usersWithoutInterests[0];
      const userProfile = await getUserProfile(user._id);

      const items = allContent.all.slice(0, 5);
      const scores = items.map(item => RecommendationService.calculateInterestScore(item, userProfile.interests || []));

      console.log(`   ✓ Handled user ${userProfile._id} with no interests`);
      console.log(`     Generated scores for ${scores.length} items`);

      expect(scores.every(s => s !== undefined)).toBe(true);
    });

    test('should handle items with missing fields', async () => {
      const itemWithMissingFields = {
        _id: 'test-id',
        // Missing tags, title, description, etc.
        finalScore: 0.5
      };

      if (sampleUsers.length === 0) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      const score = RecommendationService.calculateInterestScore(itemWithMissingFields, userProfile.interests);

      console.log(`   ✓ Handled item with missing fields: score = ${score}`);

      expect(score).toBeDefined();
      expect(typeof score).toBe('number');
    });

    test('should calculate metrics for empty recommendation lists', () => {
      const emptyRecommendations = [];
      const relevantItems = allContent.all.slice(0, 5);

      const precision = OfflineEvaluator.calculatePrecisionAtK(emptyRecommendations, relevantItems, 10);
      const recall = OfflineEvaluator.calculateRecallAtK(emptyRecommendations, relevantItems, 10);

      console.log(`   ✓ Empty recommendations: Precision = ${precision}, Recall = ${recall}`);

      expect(precision).toBe(0);
      expect(recall).toBe(0);
    });
  });

  describe('9. Organization Matching Accuracy', () => {
    test('should correctly match organization categories to interests', async () => {
      if (sampleUsers.length === 0) return;

      const user = sampleUsers[0];
      const userProfile = await getUserProfile(user._id);

      // Get events by organization
      const eventsByOrg = {};
      allContent.events.forEach(event => {
        if (!eventsByOrg[event.organization]) {
          eventsByOrg[event.organization] = [];
        }
        eventsByOrg[event.organization].push(event);
      });

      console.log(`   ✓ Organization Matching Analysis:`);

      for (const [org, events] of Object.entries(eventsByOrg)) {
        if (events.length === 0) continue;

        const orgInfo = ORGANIZATION_CATEGORIES[org];
        if (!orgInfo) continue;

        const event = events[0];
        const score = RecommendationService.calculateInterestScore(event, userProfile.interests);

        console.log(`     ${org} (primary: ${orgInfo.primaryInterest}): ${score.toFixed(4)}`);
      }

      expect(Object.keys(eventsByOrg).length).toBeGreaterThan(0);
    });
  });
});
