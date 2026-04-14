/**
 * Offline Evaluation Metrics for Recommendation System
 * Calculates standard metrics to measure recommendation accuracy
 */

class OfflineEvaluator {
  /**
   * Precision@K: % of top-K recommendations that are relevant
   * Relevant = items with tags matching user interests
   */
  static calculatePrecisionAtK(recommendations, relevantItems, k = 10) {
    const topK = recommendations.slice(0, k);
    const relevant = topK.filter(item =>
      relevantItems.some(r => r._id?.toString() === item._id?.toString())
    ).length;

    return relevant / Math.max(k, 1);
  }

  /**
   * Recall@K: % of relevant items that appear in top-K
   * Measures coverage of relevant items in recommendations
   */
  static calculateRecallAtK(recommendations, relevantItems, k = 10) {
    const topK = recommendations.slice(0, k);
    const relevant = topK.filter(item =>
      relevantItems.some(r => r._id?.toString() === item._id?.toString())
    ).length;

    return relevant / Math.max(relevantItems.length, 1);
  }

  /**
   * F1 Score: Harmonic mean of precision and recall
   * Balanced metric considering both precision and recall
   */
  static calculateF1Score(precision, recall) {
    const denominator = precision + recall;
    if (denominator === 0) return 0;
    return 2 * (precision * recall) / denominator;
  }

  /**
   * NDCG: Normalized Discounted Cumulative Gain
   * Measures ranking quality - penalizes relevant items appearing lower
   */
  static calculateNDCG(recommendations, relevantItems, k = 10) {
    const topK = recommendations.slice(0, k);

    // Calculate DCG
    let dcg = 0;
    topK.forEach((item, idx) => {
      const isRelevant = relevantItems.some(r => r._id?.toString() === item._id?.toString()) ? 1 : 0;
      dcg += (isRelevant / Math.log2(idx + 2)); // idx+2 because ranking starts at 1
    });

    // Calculate IDCG (ideal ranking: all relevant items first)
    let idcg = 0;
    for (let i = 0; i < Math.min(relevantItems.length, k); i++) {
      idcg += (1 / Math.log2(i + 2));
    }

    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * MAP: Mean Average Precision
   * Average precision across all cutoff points where relevant items appear
   */
  static calculateMAP(recommendations, relevantItems, k = 10) {
    let sumPrecision = 0;
    let relevantCount = 0;

    for (let i = 0; i < Math.min(k, recommendations.length); i++) {
      const item = recommendations[i];
      const isRelevant = relevantItems.some(r => r._id?.toString() === item._id?.toString());

      if (isRelevant) {
        relevantCount++;
        sumPrecision += relevantCount / (i + 1);
      }
    }

    return relevantCount === 0 ? 0 : sumPrecision / Math.min(relevantItems.length, k);
  }

  /**
   * Coverage: % of total items that appear in recommendations
   * Measures diversity of recommendations
   */
  static calculateCoverage(recommendations, totalItemCount) {
    const uniqueItems = new Set(recommendations.map(r => r._id?.toString()));
    return uniqueItems.size / Math.max(totalItemCount, 1);
  }

  /**
   * Novelty: % of recommendations not in user's viewed items
   * Measures ability to introduce new content to users
   */
  static calculateNovelty(recommendations, viewedItems) {
    const novel = recommendations.filter(r =>
      !viewedItems.some(v => v._id?.toString() === r._id?.toString())
    ).length;

    return novel / Math.max(recommendations.length, 1);
  }

  /**
   * Diversity: Measures how different recommended items are from each other
   * Based on tags and organization dissimilarity
   */
  static calculateDiversity(recommendations) {
    if (recommendations.length < 2) return 1.0;

    let dissimilaritySum = 0;
    let pairCount = 0;

    for (let i = 0; i < recommendations.length; i++) {
      for (let j = i + 1; j < Math.min(i + 10, recommendations.length); j++) { // Compare top 10
        const item1 = recommendations[i];
        const item2 = recommendations[j];

        // Tag dissimilarity
        const tags1 = new Set((item1.tags || []).map(t => t.toLowerCase()));
        const tags2 = new Set((item2.tags || []).map(t => t.toLowerCase()));
        const commonTags = [...tags1].filter(t => tags2.has(t)).length;
        const totalTags = Math.max(tags1.size, tags2.size, 1);
        const tagDissimilarity = 1 - (commonTags / totalTags);

        // Organization dissimilarity
        const orgDissimilarity = item1.organization === item2.organization ? 0 : 0.5;

        const pairDissimilarity = (tagDissimilarity + orgDissimilarity) / 2;
        dissimilaritySum += pairDissimilarity;
        pairCount++;
      }
    }

    return pairCount === 0 ? 0 : dissimilaritySum / pairCount;
  }

  /**
   * Calibration: Measures if recommendation score distribution matches user behavior
   * Compares avg score of interacted items vs non-interacted
   */
  static calculateCalibration(recommendations, interestedItems, minScoreDifference = 0.1) {
    const interestedScores = recommendations
      .filter(r => interestedItems.some(i => i._id?.toString() === r._id?.toString()))
      .map(r => r.finalScore || r.score || 0);

    const notInterestedScores = recommendations
      .filter(r => !interestedItems.some(i => i._id?.toString() === r._id?.toString()))
      .map(r => r.finalScore || r.score || 0);

    const avgInterested = interestedScores.length > 0
      ? interestedScores.reduce((a, b) => a + b, 0) / interestedScores.length
      : 0;

    const avgNotInterested = notInterestedScores.length > 0
      ? notInterestedScores.reduce((a, b) => a + b, 0) / notInterestedScores.length
      : 0;

    const scoreDifference = avgInterested - avgNotInterested;
    return scoreDifference >= minScoreDifference ? 1.0 : Math.max(0, scoreDifference / minScoreDifference);
  }

  /**
   * Run complete evaluation suite
   */
  static runEvaluation(recommendations, relevantItems, totalItems, viewedItems = [], interestedItems = []) {
    const precisionAt10 = this.calculatePrecisionAtK(recommendations, relevantItems, 10);
    const recallAt10 = this.calculateRecallAtK(recommendations, relevantItems, 10);
    const f1 = this.calculateF1Score(precisionAt10, recallAt10);
    const ndcg = this.calculateNDCG(recommendations, relevantItems, 10);
    const map = this.calculateMAP(recommendations, relevantItems, 10);
    const coverage = this.calculateCoverage(recommendations, totalItems);
    const novelty = this.calculateNovelty(recommendations, viewedItems);
    const diversity = this.calculateDiversity(recommendations);
    const calibration = this.calculateCalibration(recommendations, interestedItems);

    return {
      precisionAt10: parseFloat(precisionAt10.toFixed(4)),
      recallAt10: parseFloat(recallAt10.toFixed(4)),
      f1Score: parseFloat(f1.toFixed(4)),
      ndcg: parseFloat(ndcg.toFixed(4)),
      map: parseFloat(map.toFixed(4)),
      coverage: parseFloat(coverage.toFixed(4)),
      novelty: parseFloat(novelty.toFixed(4)),
      diversity: parseFloat(diversity.toFixed(4)),
      calibration: parseFloat(calibration.toFixed(4)),
      summary: {
        quality: ndcg > 0.7 ? '✅ Excellent' : ndcg > 0.5 ? '✅ Good' : ndcg > 0.3 ? '⚠️ Fair' : '❌ Poor',
        ranking: map > 0.5 ? '✅ Excellent' : map > 0.3 ? '✅ Good' : '⚠️ Fair',
        diversity: diversity > 0.6 ? '✅ High' : diversity > 0.4 ? '✅ Moderate' : '⚠️ Low',
        novelty: novelty > 0.5 ? '✅ Good' : '⚠️ Limited',
        calibration: calibration > 0.7 ? '✅ Well-calibrated' : '⚠️ Needs adjustment'
      },
      interpretation: {
        precision: `${(precisionAt10 * 100).toFixed(1)}% of top-10 recommendations are relevant`,
        recall: `${(recallAt10 * 100).toFixed(1)}% of relevant items are in top-10`,
        ndcg: `Ranking quality score: ${(ndcg * 100).toFixed(1)}/100`,
        coverage: `System recommends ${(coverage * 100).toFixed(1)}% of available content variety`,
        novelty: `${(novelty * 100).toFixed(1)}% of recommendations are new to user`,
        diversity: `Average item dissimilarity: ${(diversity * 100).toFixed(1)}%`
      }
    };
  }

  /**
   * Detailed analysis per user
   */
  static analyzeUserRecommendations(userId, recommendations, userData, allItems) {
    const userInterests = userData.interests || [];
    const userOrganizations = userData.organizations || [];

    // Find relevant items based on user profile
    const relevantItems = allItems.filter(item => {
      const interestMatch = (item.tags || []).some(tag =>
        userInterests.some(interest => tag.toLowerCase().includes(interest.toLowerCase()))
      );
      const orgMatch = userOrganizations.includes(item.organization);
      return interestMatch || orgMatch;
    });

    const recommendations_slice = recommendations.slice(0, 20);
    const metrics = this.runEvaluation(
      recommendations_slice,
      relevantItems,
      allItems.length,
      userData.viewedPosts || [],
      userData.interestedEvents || []
    );

    return {
      userId,
      userProfile: {
        interests: userInterests,
        organizations: userOrganizations,
        viewedItems: (userData.viewedPosts || []).length,
        interestedInEvents: (userData.interestedEvents || []).length
      },
      recommendationStats: {
        totalRecommended: recommendations_slice.length,
        relevantInTop10: recommendations_slice.slice(0, 10).filter(r =>
          relevantItems.some(ri => ri._id?.toString() === r._id?.toString())
        ).length
      },
      metrics,
      topRecommendations: recommendations_slice.slice(0, 5).map(r => ({
        id: r._id,
        title: r.title || r.desc,
        type: r.type,
        score: (r.finalScore || r.score || 0).toFixed(4),
        organization: r.organization,
        tags: r.tags
      }))
    };
  }
}

module.exports = OfflineEvaluator;
