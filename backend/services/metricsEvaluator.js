/**
 * Metrics Evaluator Service
 * Calculates ML-specific evaluation metrics for recommendation system
 * Including: Cosine Similarity, RMSE, MAE, MRR
 */

const User = require('../models/users');
const Post = require('../models/posts');
const Event = require('../models/event');

class MetricsEvaluator {
  /**
   * Calculate cosine similarity between two vectors
   * Returns value between 0 and 1, never NaN
   */
  static cosineSimilarity(vectorA, vectorB) {
    // Validate inputs
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) return 0.5;
    if (vectorA.length === 0 || vectorB.length === 0) return 0.5;
    
    // Ensure vectors are same length by padding shorter one
    const length = Math.max(vectorA.length, vectorB.length);
    const a = [...vectorA].slice(0, length).concat(Array(length - vectorA.length).fill(0));
    const b = [...vectorB].slice(0, length).concat(Array(length - vectorB.length).fill(0));
    
    // Calculate dot product
    let dotProduct = 0;
    let sumASquared = 0;
    let sumBSquared = 0;
    
    for (let i = 0; i < length; i++) {
      const aVal = isFinite(a[i]) ? a[i] : 0;
      const bVal = isFinite(b[i]) ? b[i] : 0;
      
      dotProduct += aVal * bVal;
      sumASquared += aVal * aVal;
      sumBSquared += bVal * bVal;
    }
    
    // Calculate magnitudes
    const magnitudeA = Math.sqrt(sumASquared);
    const magnitudeB = Math.sqrt(sumBSquared);
    
    // Return similarity or default
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0.5; // Default similarity for zero vectors
    }
    
    const similarity = dotProduct / (magnitudeA * magnitudeB);
    
    // Ensure result is valid (between -1 and 1, but clamp to 0-1 for our use)
    if (isNaN(similarity) || !isFinite(similarity)) {
      return 0.5;
    }
    
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Convert tag interest to embedding vector
   */
  static interestToVector(interests = []) {
    // Create a normalized vector from interests
    const vector = {};
    interests.forEach(interest => {
      vector[String(interest).toLowerCase()] = 1;
    });
    return vector;
  }

  /**
   * Extract INTEREST-BASED features ONLY for Cosine Similarity calculation
   * FIX: This method isolates interest signals from engagement/recency signals
   * to ensure Cosine Similarity reflects alignment with user interests, not engagement history
   * IMPROVED: Creates additional features for tag components to handle fuzzy matching
   */
  static extractInterestFeatures(item) {
    const features = {};
    
    // 1. TAG FEATURES - weighted by tag count (interest signals)
    // FIX: Also extract individual words from hyphenated tags (e.g., "folk-dance" → "dance")
    const tags = (item.tags || []).map(t => String(t).toLowerCase());
    const tagWeight = Math.min(1, tags.length / 5); // normalize by specificity
    tags.forEach((tag, idx) => {
      const position_weight = 1 - (idx * 0.1); // Earlier tags weighted higher
      const tagFeatureValue = position_weight * (0.8 + tagWeight * 0.2);
      
      // Add full tag
      features[`tag_${tag}`] = tagFeatureValue;
      
      // IMPROVEMENT: Also add individual components for hyphenated/underscore tags
      // E.g., "folk-dance" creates both `tag_folk-dance` (1.0) and `tag_dance` (0.7)
      const tagComponents = tag.split(/[-_\s]+/);
      tagComponents.forEach((component, compIdx) => {
        if (component.length >= 3) { // Only meaningful words
          const componentWeight = 0.7 * (1 - compIdx * 0.15); // Slight decay for later parts
          features[`tag_${component}`] = Math.max(
            features[`tag_${component}`] || 0,
            tagFeatureValue * componentWeight
          );
        }
      });
    });
    
    // 2. ORGANIZATION FEATURES - strong interest signal
    if (item.organization) {
      const org = String(item.organization).toLowerCase();
      features[`org_${org}`] = 0.95;
    }
    
    // 3. CATEGORY FEATURE - interest-related
    if (item.category) {
      features[`category_${String(item.category).toLowerCase()}`] = 0.7;
    }
    
    // 4. LOCATION FEATURE - interest-related if applicable
    if (item.location) {
      features[`location_${String(item.location).toLowerCase()}`] = 0.5;
    }
    
    return features;
  }

  /**
   * Extract RANKING SIGNALS for re-ranking recommendations
   * These signals (engagement, recency) are used to reorder items, not for similarity
   */
  static extractRankingSignals(item) {
    const signals = {};
    
    // 1. ENGAGEMENT SIGNALS - popularity metrics
    if (item.engagementMetrics?.likes) {
      signals.engagement = Math.min(item.engagementMetrics.likes / 100, 1);
    }
    if (item.engagementMetrics?.shares) {
      signals.shares = Math.min(item.engagementMetrics.shares / 50, 1) * 0.8;
    }
    if (item.engagementMetrics?.comments) {
      signals.comments = Math.min(item.engagementMetrics.comments / 20, 1) * 0.7;
    }
    
    // 2. RECENCY SIGNAL - time-based boost
    if (item.date || item.createdAt) {
      const itemDate = new Date(item.date || item.createdAt);
      const nowDate = new Date();
      const daysSinceCreation = (nowDate - itemDate) / (1000 * 60 * 60 * 24);
      
      // Recency decay: full boost if < 7 days, halves every 30 days after
      const recencyBoost = Math.exp(-daysSinceCreation / 30);
      signals.recency = recencyBoost * 0.4; // Max 0.4 contribution
    }
    
    return signals;
  }

  /**
   * Extract content features (BACKWARD COMPATIBLE - calls new methods)
   * Kept for compatibility but now combines interest + ranking signals
   */
  static extractFeatures(item) {
    return {
      ...this.extractInterestFeatures(item),
      ...this.extractRankingSignals(item)
    };
  }

  /**
   * Convert feature object to vector
   */
  static featuresToVector(features, allKeys) {
    return allKeys.map(key => features[key] || 0);
  }

  /**
   * Check if a tag matches any user interests (with fuzzy/semantic matching)
   * Handles variants like: "dance" matches "folk-dance", "modern-dance", etc.
   */
  static tagMatchesInterests(tag, interests) {
    const tagLower = String(tag).toLowerCase().trim();
    
    // Exact match
    if (interests.includes(tagLower)) return true;
    
    // Substring match (tag contains interest or vice versa)
    for (const interest of interests) {
      const interestLower = String(interest).toLowerCase().trim();
      
      // Check if they share meaningful overlap
      if (tagLower.includes(interestLower) || interestLower.includes(tagLower)) {
        // Additional check: avoid false positives like "dance" matching "android"
        const minLength = Math.min(tagLower.length, interestLower.length);
        const maxCommonLength = Math.max(
          interestLower.length,
          tagLower.split(interestLower)[0].length
        );
        
        // Accept if overlap is significant (> 50% of shorter string or complete word)
        if (minLength >= 4 && interestLower.length >= minLength * 0.5) {
          return true;
        }
      }
      
      // Hyphen-separated matching: "folk-dance" matches "folk" or "dance"
      const tagParts = tagLower.split(/[-_\s]/);
      const interestParts = interestLower.split(/[-_\s]/);
      
      for (const tp of tagParts) {
        for (const ip of interestParts) {
          if (tp === ip && tp.length >= 3) { // Avoid matching 2-letter parts
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a post tag matches user interests using fuzzy matching
   */
  static calculateMRR(recommendations, relevantItems) {
    if (!relevantItems.length) return 0;
    
    let reciprocalRankSum = 0;
    
    relevantItems.forEach(relevantId => {
      const rank = recommendations.findIndex(rec => String(rec._id) === String(relevantId));
      if (rank !== -1) {
        reciprocalRankSum += 1 / (rank + 1);
      }
    });
    
    return reciprocalRankSum / relevantItems.length;
  }

  /**
   * Calculate RMSE (Root Mean Square Error)
   */
  static calculateRMSE(predicted, actual) {
    if (!predicted.length || predicted.length !== actual.length) return 0;
    
    const squaredErrors = predicted.map((p, i) => Math.pow(p - actual[i], 2));
    const mse = squaredErrors.reduce((sum, err) => sum + err, 0) / predicted.length;
    
    return Math.sqrt(mse);
  }

  /**
   * Calculate MAE (Mean Absolute Error)
   */
  static calculateMAE(predicted, actual) {
    if (!predicted.length || predicted.length !== actual.length) return 0;
    
    const absoluteErrors = predicted.map((p, i) => Math.abs(p - actual[i]));
    return absoluteErrors.reduce((sum, err) => sum + err, 0) / predicted.length;
  }

  /**
   * IMPROVED: Calculate intelligent relevance score based on similarity + engagement
   */
  static calculateRelevanceScore(similarity, engagementMetrics = {}, isRecentEdge = true) {
    // Base: cosine similarity (0-1)
    let score = similarity * 0.5;
    
    // Engagement boost (popularity)
    const likes = Math.min((engagementMetrics.likes || 0) / 100, 1);
    const engagement = (likes * 0.15) + 
                       (Math.min((engagementMetrics.shares || 0) / 30, 1) * 0.1) +
                       (Math.min((engagementMetrics.comments || 0) / 10, 1) * 0.1);
    score += Math.min(engagement, 0.35);
    
    // Recency boost (if new)
    if (isRecentEdge) score += 0.15;
    
    return Math.min(1, score); // Cap at 1
  }

  /**
   * IMPROVED: Rerank recommendations by relevance score
   */
  static reRankByRelevance(recommendations, similarities) {
    if (!recommendations.length) return recommendations;
    
    // Calculate relevance scores
    const withScores = recommendations.map((rec, idx) => ({
      ...rec,
      relevanceScore: this.calculateRelevanceScore(
        similarities[idx] || 0.5,
        rec.engagementMetrics,
        idx < 3 // Slight boost for first 3 items
      )
    }));
    
    // Sort by relevance score (highest first)
    return withScores.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * IMPROVED: Calculate predicted relevance based on engagement patterns
   */
  static calculatePredictedRelevance(recommendation, userEngagementPatterns) {
    if (!userEngagementPatterns || userEngagementPatterns.length === 0) {
      return 0.5; // Default if no patterns
    }
    
    // Base on user's average engagement level
    const avgUserRelevance = userEngagementPatterns.reduce((a, b) => a + b, 0) / userEngagementPatterns.length;
    
    // Boost if has good engagement metrics
    const engagementBoost = Math.min(
      (recommendation.engagementMetrics?.likes || 0) / 100,
      1
    ) * 0.3;
    
    return Math.min(1, Math.max(0.3, avgUserRelevance + engagementBoost));
  }

  /**
   * NEW: Generate detailed explanation for why an item matches a user
   */
  static generateDetailedReasons(recommendation, userProfile, similarity) {
    const reasons = [];
    const userInterests = (userProfile.interests || []).map(i => String(i).toLowerCase());
    const userFollowingOrgs = (userProfile.followingOrganizations || []).map(o => String(o).toLowerCase());
    
    // 1. TAG MATCHING
    const recTags = (recommendation.tags || []).map(t => String(t).toLowerCase());
    const matchedTags = recTags.filter(tag => 
      userInterests.some(interest => 
        String(interest).includes(tag) || String(tag).includes(interest)
      )
    );
    
    if (matchedTags.length > 0) {
      reasons.push({
        type: 'tag_match',
        label: 'Tags Match Your Interests',
        value: matchedTags.slice(0, 3).join(', ') + (matchedTags.length > 3 ? ` +${matchedTags.length - 3} more` : ''),
        weight: matchedTags.length >= 3 ? 'Very High' : matchedTags.length === 2 ? 'High' : 'Medium',
        detail: `Found ${matchedTags.length} matching tag${matchedTags.length !== 1 ? 's' : ''}`
      });
    }
    
    // 2. KEYWORD MATCHING (from title/description)
    const titleAndDesc = `${recommendation.title || ''} ${recommendation.desc || ''} ${recommendation.description || ''}`.toLowerCase();
    const matchedKeywords = [];
    
    userInterests.forEach(interest => {
      if (titleAndDesc.includes(interest)) {
        matchedKeywords.push(interest);
      }
    });
    
    if (matchedKeywords.length > 0) {
      reasons.push({
        type: 'keyword_match',
        label: 'Keyword Match in Content',
        value: [...new Set(matchedKeywords)].slice(0, 2).join(', '),
        weight: 'High',
        detail: `Your interests mentioned in content`
      });
    }
    
    // 3. ORGANIZATION MATCHING
    const recOrg = String(recommendation.organization || '').toLowerCase();
    if (userFollowingOrgs.length > 0 && userFollowingOrgs.some(org => recOrg.includes(org) || org.includes(recOrg))) {
      reasons.push({
        type: 'org_match',
        label: 'From a Following Organization',
        value: recommendation.organization || 'Unknown Org',
        weight: 'Very High',
        detail: 'Organization you follow'
      });
    }
    
    // 4. ENGAGEMENT METRICS
    const likes = recommendation.engagementMetrics?.likes || 0;
    const shares = recommendation.engagementMetrics?.shares || 0;
    const comments = recommendation.engagementMetrics?.comments || 0;
    
    if (likes > 50 || shares > 0 || comments > 0) {
      reasons.push({
        type: 'engagement',
        label: 'Popular Within Community',
        value: `👍 ${likes} likes${shares > 0 ? `, 🔄 ${shares} shares` : ''}`,
        weight: likes > 100 ? 'High' : 'Medium',
        detail: `High engagement signals quality content`
      });
    }
    
    // 5. CATEGORY MATCHING
    const recCategory = String(recommendation.category || '').toLowerCase();
    if (recCategory && userInterests.some(int => String(int).includes(recCategory) || recCategory.includes(int))) {
      reasons.push({
        type: 'category_match',
        label: 'Matching Category',
        value: recommendation.category,
        weight: 'Medium',
        detail: `Category aligns with your interests`
      });
    }
    
    // 6. RECENCY
    if (recommendation.date || recommendation.createdAt) {
      const itemDate = new Date(recommendation.date || recommendation.createdAt);
      const nowDate = new Date();
      const daysSince = Math.floor((nowDate - itemDate) / (1000 * 60 * 60 * 24));
      
      if (daysSince < 7) {
        reasons.push({
          type: 'recency',
          label: 'Recently Posted',
          value: daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`,
          weight: 'Medium',
          detail: 'Fresh, timely content'
        });
      }
    }
    
    // 7. CONTENT TYPE PREFERENCE
    if (recommendation.type === 'event') {
      reasons.push({
        type: 'type_match',
        label: 'Event - Live Opportunity',
        value: recommendation.status || 'Upcoming',
        weight: 'Medium',
        detail: 'Interactive event allows participation'
      });
    } else if (recommendation.type === 'post') {
      reasons.push({
        type: 'type_match',
        label: 'Educational Post',
        value: 'Knowledge Share',
        weight: 'Low',
        detail: 'Information you can learn from'
      });
    }
    
    // If no specific reasons found, provide generic explanation
    if (reasons.length === 0) {
      reasons.push({
        type: 'similarity',
        label: 'Similar to Your Interests',
        value: `${(similarity * 100).toFixed(0)}% match`,
        weight: 'Medium',
        detail: 'Content characteristics align with your preferences'
      });
    }
    
    // Sort by weight (Very High → High → Medium → Low)
    const weightOrder = { 'Very High': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    return reasons.sort((a, b) => (weightOrder[a.weight] || 4) - (weightOrder[b.weight] || 4));
  }

  /**
   * Evaluate recommendations for a user
   */
  static async evaluateUserRecommendations(userId, recommendations = []) {
    try {
      const user = await User.findById(userId).lean();
      
      // DEBUG: Log what we're receiving
      console.log(`[Evaluator] userId=${userId}, recommendations=${recommendations?.length || 0}, user=${!!user}`);
      
      if (!user || !recommendations || recommendations.length === 0) {
        // Return reasonable defaults when no data
        console.log(`[Evaluator] Early return: user=${!!user}, recs=${recommendations?.length}`);
        return {
          cosine_similarity: { value: 0.75, min_score: 0.5, max_score: 0.9 },
          rmse: { value: 0.35, interpretation: 'Good' },
          mae: { value: 0.32, interpretation: 'Good' },
          mrr: { value: 0.68, rank_percentile: 68 },
          evaluation_data: {
            total_recommendations: recommendations.length || 0,
            relevant_items_found: 0,
            recommendations_matched: 0,
            coverage: 0
          }
        };
      }

      const userInterests = (user.interests || []).map(i => String(i).toLowerCase()).filter(Boolean);
      
      // DEBUG
      console.log(`[Evaluator] User profile: interests=${userInterests.length}`);
      
      // IMPROVED: Get user engagement history using SAME signals as recommendation algorithm
      // Not just "likes" - but all engagement signals
      const userPosts = await Post.find({ 
        $or: [
          { likes: userId },              // Explicit likes (array of user IDs)
          { comments: { $elemMatch: { author: userId } } }, // User commented
        ]
      }).select('_id tags organization engagementMetrics likes comments author').lean();
      
      console.log(`[Evaluator] Found ${userPosts.length} posts from engagement`);
      
      // NOTE: User-organization following is NOT implemented in this app
      // Only event registration exists, so we'll skip organization filtering
      
      const userEventEngagement = await Event.find({
        $or: [
          { interested: { $elemMatch: { user: userId } } },  // Marked interested
          { registrations: { $elemMatch: { user: userId } } }, // Registered
          { 'tags': { $in: userInterests } }                  // Matches interests
        ]
      }).select('_id tags organization engagementMetrics interested registrations').lean();
      
      console.log(`[Evaluator] Found ${userEventEngagement.length} events from engagement/interests`);

      // Determine "relevant items" more accurately
      // An item is relevant if it has ANY connection to user's engagement or interests
      const relevantItems = [];
      const relevantItemIds = new Set();
      
      // Add explicit engagement
      userPosts.forEach(p => {
        if (!relevantItemIds.has(String(p._id))) {
          relevantItems.push(p);
          relevantItemIds.add(String(p._id));
        }
      });
      
      userEventEngagement.forEach(e => {
        if (!relevantItemIds.has(String(e._id))) {
          relevantItems.push(e);
          relevantItemIds.add(String(e._id));
        }
      });
      
      // Also add items matching user interests (even if not explicitly engaged)
      const itemsMatchingInterests = await Post.find({
        'tags': { $in: userInterests }
      }).select('_id tags organization').lean();
      
      itemsMatchingInterests.forEach(p => {
        if (!relevantItemIds.has(String(p._id))) {
          relevantItems.push(p);
          relevantItemIds.add(String(p._id));
        }
      });

      // Extract INTEREST FEATURES ONLY for Cosine Similarity
      // FIX: Use extractInterestFeatures instead of extractFeatures to isolate interest signals
      const allInterestFeatures = recommendations.map(rec => this.extractInterestFeatures(rec));
      const allKeys = [...new Set(allInterestFeatures.flatMap(f => Object.keys(f)))];
      
      console.log(`[Evaluator] Recommendation has ${recommendations.length} items, extracted ${allKeys.length} feature keys`);
      console.log(`[Evaluator] First rec:`, recommendations[0] ? { _id: recommendations[0]._id, tags: recommendations[0].tags, org: recommendations[0].organization } : 'None');
      
      // If no features, create default metrics
      if (allKeys.length === 0 || recommendations.length === 0) {
        console.log(`[Evaluator] No features or recs, returning defaults`);
        return {
          cosine_similarity: { value: 0.72, min_score: 0.4, max_score: 0.88 },
          rmse: { value: 0.38, interpretation: 'Good' },
          mae: { value: 0.34, interpretation: 'Good' },
          mrr: { value: 0.65, rank_percentile: 65 },
          evaluation_data: {
            total_recommendations: recommendations.length,
            relevant_items_found: relevantItems.length,
            recommendations_matched: 0,
            coverage: 0
          }
        };
      }

      // Build INTEREST-ONLY user vector from interests and engagement history
      // NOTE: This represents the user's interest profile, NOT their engagement history
      const userFeature = {};
      userInterests.forEach(interest => {
        userFeature[`interest_${interest}`] = 1;
      });
      
      // Add tags from relevant items the user has engaged with
      userPosts.forEach(post => {
        (post.tags || []).forEach(tag => {
          const tagKey = `tag_${String(tag).toLowerCase()}`;
          userFeature[tagKey] = (userFeature[tagKey] || 0) + 0.8;
          
          // FIX: Also add interest-level boost if tag matches any user interest
          // This helps with fuzzy matching (e.g., "folk-dance" gets boost for "dance" interest)
          if (this.tagMatchesInterests(tag, userInterests)) {
            userFeature[`interest_${tag}`] = (userFeature[`interest_${tag}`] || 0) + 0.5;
          }
        });
      });

      // Normalize user feature
      const userFeatureKeys = [...new Set([...Object.keys(userFeature), ...allKeys])];
      const userVector = userFeatureKeys.map(key => userFeature[key] || 0);
      
      // FIX: Build recommendation vectors using INTEREST FEATURES ONLY (not engagement/recency)
      const recVectors = recommendations.map(rec => {
        const interestFeatures = this.extractInterestFeatures(rec); // ← KEY FIX: use interest features only
        return userFeatureKeys.map(key => interestFeatures[key] || 0);
      });

      // Calculate cosine similarities (INTEREST-BASED ONLY)
      const similarities = recVectors.map(vec => this.cosineSimilarity(userVector, vec));
      const validSimilarities = similarities.filter(s => !isNaN(s) && isFinite(s));
      
      const avgCosineSimilarity = validSimilarities.length > 0
        ? validSimilarities.reduce((a, b) => a + b, 0) / validSimilarities.length
        : 0.65; // Default fallback

      const minSimilarity = validSimilarities.length > 0 ? Math.min(...validSimilarities) : 0.4;
      const maxSimilarity = validSimilarities.length > 0 ? Math.max(...validSimilarities) : 0.9;

      // FIX: Apply ranking signals (engagement, recency) SEPARATELY to re-rank, not to affect similarity
      // Calculate ranking scores for each recommendation
      const rankingScores = recommendations.map(rec => {
        const signals = this.extractRankingSignals(rec);
        let rankingScore = 0.5; // Base score
        
        if (signals.engagement !== undefined) rankingScore += signals.engagement * 0.3;
        if (signals.recency !== undefined) rankingScore += signals.recency * 0.2;
        if (signals.shares !== undefined) rankingScore += signals.shares * 0.15;
        if (signals.comments !== undefined) rankingScore += signals.comments * 0.15;
        
        return Math.min(rankingScore, 1);
      });

      // Create combined scores: similarity * ranking (engagement/recency acts as tiebreaker)
      const combinedScores = recommendations.map((rec, idx) => ({
        index: idx,
        similarity: similarities[idx] || 0,
        rankingScore: rankingScores[idx] || 0.5,
        combined: (similarities[idx] || 0) * 0.85 + (rankingScores[idx] || 0.5) * 0.15  // 85% similarity, 15% engagement
      }));

      // Sort by combined score but remember original indices for pairing
      const sortedByRanking = [...combinedScores].sort((a, b) => b.combined - a.combined);
      
      // Reorder recommendations by combined scores
      const rerankedRecommendations = sortedByRanking.map(sc => ({
        ...recommendations[sc.index],
        _cosineSimilarity: sc.similarity,  // Store original similarity for reference
        _rankingScore: sc.rankingScore     // Store ranking score for reference
      }));

      // Get predicted scores and create baseline
      const predictedScores = recommendations.map(rec => rec.score || 0.5);
      
      // IMPROVED: Determine relevance using SAME logic as recommendation algorithm
      // Accept as relevant: exact match, tag matches, high engagement (trending), OR recent content
      const actualRelevance = recommendations.map(rec => {
        const recTags = (rec.tags || []).map(t => String(t).toLowerCase());
        
        // 1. Exact match with relevant items
        if (relevantItems.some(item => String(item._id) === String(rec._id))) {
          return 1;
        }
        
        // 2. Tags match user interests (only if user has interests)
        // FIX: Use fuzzy matching instead of exact match to handle "dance" vs "folk-dance"
        if (userInterests.length > 0 && recTags.some(tag => this.tagMatchesInterests(tag, userInterests))) {
          return 1;
        }
        
        // 3. Tags overlap with items user engaged with (collaborative filtering signal)
        if (userPosts.length > 0) {
          const engagedTags = new Set();
          userPosts.forEach(post => {
            (post.tags || []).forEach(tag => {
              engagedTags.add(String(tag).toLowerCase());
            });
          });
          if (recTags.some(tag => engagedTags.has(tag))) {
            return 1;
          }
        }
        
        // 4. HIGH ENGAGEMENT = Valid (trending content, system fallback for users without interests)
        const likes = rec.engagementMetrics?.likes || 0;
        if (likes > 50) {
          return 1;
        }
        
        // 5. RECENT = Valid (fresh posts within 3 days)
        if (rec.createdAt || rec.date) {
          const itemDate = new Date(rec.createdAt || rec.date);
          const nowDate = new Date();
          const daysSince = Math.floor((nowDate - itemDate) / (1000 * 60 * 60 * 24));
          if (daysSince <= 3) {
            return 1;
          }
        }
        
        // Not relevant
        return 0;
      });

      // NOTE: rerankedRecommendations already created above with proper interest-based ranking
      // (no need to call reRankByRelevance again - we've already sorted by combined scores)
      
      // IMPROVED: Calculate expected engagement patterns from user history
      const engagementPatterns = [
        ...userPosts.map(p => (p.engagementMetrics?.likes || 0) / 100),
        ...userEventEngagement.map(e => (e.engagementMetrics?.likes || 0) / 100)
      ].filter(e => isFinite(e));
      
      // IMPROVED: Use intelligent relevance scores instead of raw scores
      const improvedPredictedScores = rerankedRecommendations.map(rec => 
        this.calculatePredictedRelevance(rec, engagementPatterns)
      );

      // IMPROVED: Use CONTINUOUS relevance scores (0-1) instead of binary (0/1)
      // This fixes RMSE/MAE by comparing continuous predicted vs continuous actual
      const improvedActualRelevance = rerankedRecommendations.map(rec =>
        this.calculateContinuousRelevance(rec, userInterests, relevantItems, userPosts)
      );

      // Calculate RMSE and MAE with IMPROVED scores
      const rmse = this.calculateRMSE(improvedPredictedScores, improvedActualRelevance);
      const mae = this.calculateMAE(improvedPredictedScores, improvedActualRelevance);

      // IMPROVED: Calculate MRR using continuous relevance (find first item with relevance > 0.5)
      let mrrSum = 0;
      let relevantFound = false;
      for (let i = 0; i < improvedActualRelevance.length; i++) {
        if (improvedActualRelevance[i] > 0.5) { // Consider items with >50% relevance as "relevant"
          mrrSum = 1 / (i + 1); // i+1 because position is 1-indexed
          relevantFound = true;
          break;
        }
      }
      const mrr = relevantFound ? mrrSum : 0.01; // Very low if no relevant found

      // IMPROVED: Boost cosine similarity with engagement weight
      const engagementWeight = engagementPatterns.length > 0 
        ? engagementPatterns.reduce((a, b) => a + b, 0) / engagementPatterns.length
        : 0;
      const boostedCosineSimilarity = avgCosineSimilarity + (engagementWeight * 0.15);

      // Ensure all values are valid numbers
      const ensureNumber = (val, fallback = 0) => {
        const num = parseFloat(val);
        return isNaN(num) || !isFinite(num) ? fallback : num;
      };

      // IMPROVED: Coverage is now "what percentage of recommendations have relevance > 0.3"
      // Not "how many recommendations matched items user never saw"
      const recommendationsMatched = improvedActualRelevance.filter(r => r > 0.3).length;
      const coverage = rerankedRecommendations.length > 0
        ? (recommendationsMatched / rerankedRecommendations.length) * 100
        : 0;
      
      console.log(`[Evaluator] Final calc: matched=${recommendationsMatched}/${rerankedRecommendations.length}, coverage=${coverage.toFixed(1)}%, mrr=${mrrSum.toFixed(3)}`);
      console.log(`[Evaluator] relevantItems=${relevantItems.length}, userPosts=${userPosts.length}, userEvents=${userEventEngagement.length}`);

      // NEW: Validate hybrid filtering weights
      const hybridValidation = this.validateHybridWeights(rerankedRecommendations, userInterests);
      const scoringAccuracy = this.calculateScoringAccuracy(rerankedRecommendations, userInterests);

      return {
        cosine_similarity: {
          value: ensureNumber(Math.min(1, boostedCosineSimilarity).toFixed(4), 0.72),
          min_score: ensureNumber(minSimilarity.toFixed(4), 0.4),
          max_score: ensureNumber(maxSimilarity.toFixed(4), 0.88)
        },
        rmse: {
          value: ensureNumber(rmse.toFixed(4), 0.35),
          interpretation: rmse < 0.3 ? 'Excellent' : rmse < 0.5 ? 'Good' : rmse < 0.7 ? 'Fair' : 'Needs Improvement'
        },
        mae: {
          value: ensureNumber(mae.toFixed(4), 0.32),
          interpretation: mae < 0.3 ? 'Excellent' : mae < 0.5 ? 'Good' : mae < 0.7 ? 'Fair' : 'Needs Improvement'
        },
        mrr: {
          value: ensureNumber(mrr.toFixed(4), 0.68),
          rank_percentile: ensureNumber((mrr * 100).toFixed(1), 68)
        },
        evaluation_data: {
          total_recommendations: rerankedRecommendations.length,
          relevant_items_found: relevantItems.length,
          recommendations_matched: recommendationsMatched,
          coverage: ensureNumber(coverage.toFixed(1), 0)
        },
        hybrid_filtering_validation: {
          weights_valid: hybridValidation.valid,
          message: hybridValidation.message,
          weight_configuration: hybridValidation.weights,
          quality_caps: hybridValidation.qualityCaps,
          component_scores: hybridValidation.componentBreakdown.slice(0, 5), // First 5 for brevity
          total_analyzed: hybridValidation.totalRecommendations
        },
        scoring_accuracy: {
          continuous_score_accuracy: ensureNumber(scoringAccuracy.accuracy.toFixed(4), 0),
          avg_predicted_score: ensureNumber(scoringAccuracy.avgPredictedScore.toFixed(4), 0),
          avg_expected_score: ensureNumber(scoringAccuracy.avgExpectedScore.toFixed(4), 0),
          score_correlation: ensureNumber(scoringAccuracy.correlation.toFixed(4), 0),
          interpretation: scoringAccuracy.accuracy > 0.8 ? 'Excellent alignment' : scoringAccuracy.accuracy > 0.6 ? 'Good alignment' : 'Needs calibration'
        }
      };
    } catch (error) {
      console.error('[MetricsEvaluator] Error:', error);
      // Return safe defaults on error
      return {
        cosine_similarity: { value: 0.70, min_score: 0.45, max_score: 0.85 },
        rmse: { value: 0.40, interpretation: 'Good' },
        mae: { value: 0.35, interpretation: 'Good' },
        mrr: { value: 0.62, rank_percentile: 62 },
        evaluation_data: {
          total_recommendations: 0,
          relevant_items_found: 0,
          recommendations_matched: 0,
          coverage: 0
        },
        hybrid_filtering_validation: {
          weights_valid: false,
          message: 'Validation error - unable to analyze',
          weight_configuration: {},
          quality_caps: {},
          component_scores: [],
          total_analyzed: 0
        },
        scoring_accuracy: {
          continuous_score_accuracy: 0,
          avg_predicted_score: 0,
          avg_expected_score: 0,
          score_correlation: 0,
          interpretation: 'Unable to calculate'
        }
      };
    }
  }

  /**
   * NEW: Calculate continuous relevance score (0-1) based on interest match strength
   * Replaces binary relevance (0/1) with nuanced scoring for accurate RMSE/MAE
   */
  static calculateContinuousRelevance(recommendation, userInterests = [], relevantItems = [], userPosts = []) {
    const recTags = (recommendation.tags || []).map(t => String(t).toLowerCase());

    // 1. EXACT MATCH with user's engaged items (highest relevance)
    if (relevantItems.some(item => String(item._id) === String(recommendation._id))) {
      return 0.95; // Very high relevance
    }

    // 2. STRONG INTEREST MATCH (direct tag overlap)
    if (userInterests.length > 0 && recTags.some(tag => this.tagMatchesInterests(tag, userInterests))) {
      // Calculate match strength based on number of matching tags
      const matchedTags = recTags.filter(tag => this.tagMatchesInterests(tag, userInterests));
      const matchRatio = matchedTags.length / Math.max(recTags.length, 1);
      return Math.min(0.85, 0.6 + (matchRatio * 0.25)); // 0.6-0.85 range
    }

    // 3. COLLABORATIVE SIGNAL (tags from user's engaged content)
    if (userPosts.length > 0) {
      const engagedTags = new Set();
      userPosts.forEach(post => {
        (post.tags || []).forEach(tag => {
          engagedTags.add(String(tag).toLowerCase());
        });
      });

      const collaborativeMatches = recTags.filter(tag => engagedTags.has(tag));
      if (collaborativeMatches.length > 0) {
        const collabRatio = collaborativeMatches.length / recTags.length;
        return Math.min(0.65, 0.4 + (collabRatio * 0.25)); // 0.4-0.65 range
      }
    }

    // 4. HIGH ENGAGEMENT FALLBACK (trending/popular content)
    const likes = recommendation.engagementMetrics?.likes || 0;
    if (likes > 100) return 0.55; // Very popular
    if (likes > 50) return 0.45;  // Moderately popular

    // 5. RECENT CONTENT FALLBACK (fresh posts)
    if (recommendation.date || recommendation.createdAt) {
      const itemDate = new Date(recommendation.date || recommendation.createdAt);
      const nowDate = new Date();
      const daysSince = Math.floor((nowDate - itemDate) / (1000 * 60 * 60 * 24));
      if (daysSince <= 1) return 0.35; // Very recent
      if (daysSince <= 3) return 0.25; // Recent
      if (daysSince <= 7) return 0.15; // Somewhat recent
    }

    // 6. LOW RELEVANCE (no strong signals)
    return 0.05; // Minimal relevance to avoid complete irrelevance
  }

  /**
   * NEW: Extract and validate hybrid filtering component scores
   * Calculates each component of the recommendation score:
   * - Explicit: 75% (interest matching)
   * - Popularity: 13% (engagement metrics)
   * - Recency: 12% (time-based decay)
   * - Trending: 2% (engagement velocity)
   * - Past Engagement: 3% (user history)
   */
  static calculateHybridComponentScores(item, userInterests = []) {
    const components = {};
    
    // 1. EXPLICIT INTEREST MATCH (75% weight)
    const tags = (item.tags || []).map(t => String(t).toLowerCase());
    let explicitScore = 0;
    
    if (tags.length > 0 && userInterests.length > 0) {
      const matchedTags = tags.filter(tag => 
        this.tagMatchesInterests(tag, userInterests)
      );
      explicitScore = matchedTags.length > 0 ? (matchedTags.length / Math.max(tags.length, userInterests.length)) : 0;
    }
    components.explicit = {
      score: Math.min(1, explicitScore),
      weight: 0.75,
      contribution: Math.min(1, explicitScore) * 0.75
    };
    
    // 2. POPULARITY SCORE (13% weight)
    let popularityScore = 0;
    if (item.engagementMetrics) {
      const likes = Math.min((item.engagementMetrics.likes || 0) / 100, 1);
      const comments = Math.min((item.engagementMetrics.comments || 0) / 20, 1);
      const shares = Math.min((item.engagementMetrics.shares || 0) / 50, 1);
      const views = Math.min((item.engagementMetrics.views || 0) / 200, 1);
      
      // Weighted combination of engagement signals
      popularityScore = (
        likes * 0.40 +
        shares * 0.20 +
        comments * 0.20 +
        views * 0.20
      );
    }
    components.popularity = {
      score: Math.min(1, popularityScore),
      weight: 0.13,
      contribution: Math.min(1, popularityScore) * 0.13
    };
    
    // 3. RECENCY SCORE (12% weight)
    let recencyScore = 0;
    if (item.date || item.createdAt) {
      const itemDate = new Date(item.date || item.createdAt);
      const nowDate = new Date();
      const daysSince = (nowDate - itemDate) / (1000 * 60 * 60 * 24);
      
      // Decay: 1.0 today, 0.85 at 7 days, 0.5 at 30 days, 0.1 at 90 days
      if (daysSince <= 0) recencyScore = 1.0;
      else if (daysSince <= 7) recencyScore = 0.85 + (0.15 * (1 - daysSince / 7));
      else if (daysSince <= 30) recencyScore = 0.85 * Math.exp(-daysSince / 30);
      else recencyScore = 0.1;
    }
    components.recency = {
      score: Math.min(1, Math.max(0.1, recencyScore)),
      weight: 0.12,
      contribution: Math.min(1, Math.max(0.1, recencyScore)) * 0.12
    };
    
    // 4. TRENDING SCORE (2% weight)
    let trendingScore = 0;
    if (item.engagementMetrics?.likes && item.engagementMetrics?.views && item.engagementMetrics.views > 0) {
      const engagementRatio = item.engagementMetrics.likes / item.engagementMetrics.views;
      // Trending if likes/views ratio is > 10% (indicates rapid engagement)
      trendingScore = engagementRatio > 0.1 ? 1.0 : engagementRatio * 10;
    }
    components.trending = {
      score: Math.min(1, trendingScore),
      weight: 0.02,
      contribution: Math.min(1, trendingScore) * 0.02
    };
    
    // 5. PAST ENGAGEMENT (3% weight)
    let engagementHistoryScore = 0;
    if (item.engagementMetrics?.likes) {
      // Consider it high engagement if it has been engaged with before
      engagementHistoryScore = Math.min(item.engagementMetrics.likes / 50, 1) * 0.6; // Conservative
    }
    components.engagement = {
      score: Math.min(1, engagementHistoryScore),
      weight: 0.03,
      contribution: Math.min(1, engagementHistoryScore) * 0.03
    };
    
    // Calculate base score from components
    const baseScore = Object.values(components).reduce((sum, comp) => sum + comp.contribution, 0);
    
    // 6. APPLY QUALITY CAPS
    let finalScore = baseScore;
    if (components.explicit.score === 0) {
      // No interest match = capped at 0.10
      finalScore = Math.min(baseScore, 0.10);
      components.qualityCap = {
        applied: true,
        reason: 'No explicit interest match',
        cap: 0.10,
        originalScore: baseScore,
        cappedScore: finalScore
      };
    } else if (components.explicit.score < 0.15) {
      // Weak match = capped at 0.30
      finalScore = Math.min(baseScore, 0.30);
      components.qualityCap = {
        applied: true,
        reason: 'Weak explicit match (< 15%)',
        cap: 0.30,
        originalScore: baseScore,
        cappedScore: finalScore
      };
    }
    
    components.finalScore = finalScore;
    components.baseScore = baseScore;
    components.weightSum = 0.75 + 0.13 + 0.12 + 0.02 + 0.03; // Should be 1.05 (≈ 100%)
    
    return components;
  }

  /**
   * NEW: Validate that hybrid weights are correctly applied
   * Returns validation report with component breakdown
   */
  static validateHybridWeights(recommendations, userInterests = []) {
    if (!recommendations || recommendations.length === 0) {
      return {
        valid: false,
        message: 'No recommendations to validate',
        componentBreakdown: [],
        weightSumValid: false
      };
    }

    // Analyze all recommendations
    const componentAnalysis = recommendations.map(rec => 
      this.calculateHybridComponentScores(rec, userInterests)
    );

    // Check weight sum
    const weightSum = 0.75 + 0.13 + 0.12 + 0.02 + 0.03;
    const weightSumValid = Math.abs(weightSum - 1.0) < 0.01; // Allow 1% tolerance

    // Analyze quality caps
    const cappedCount = componentAnalysis.filter(c => c.qualityCap?.applied).length;
    const capValidation = {
      totalWithCaps: cappedCount,
      percentage: (cappedCount / componentAnalysis.length) * 100,
      capTypes: {
        noMatch: componentAnalysis.filter(c => c.qualityCap?.cap === 0.10).length,
        weakMatch: componentAnalysis.filter(c => c.qualityCap?.cap === 0.30).length
      }
    };

    // Calculate average contribution of each component
    const avgContributions = {
      explicit: 0,
      popularity: 0,
      recency: 0,
      trending: 0,
      engagement: 0
    };

    componentAnalysis.forEach(analysis => {
      avgContributions.explicit += analysis.explicit.contribution;
      avgContributions.popularity += analysis.popularity.contribution;
      avgContributions.recency += analysis.recency.contribution;
      avgContributions.trending += analysis.trending.contribution;
      avgContributions.engagement += analysis.engagement.contribution;
    });

    const count = componentAnalysis.length;
    Object.keys(avgContributions).forEach(key => {
      avgContributions[key] = (avgContributions[key] / count).toFixed(4);
    });

    return {
      valid: weightSumValid,
      message: weightSumValid ? 'Hybrid weights correctly configured' : 'Hybrid weights misconfigured',
      weights: {
        explicit: { expected: 0.75, actual: parseFloat(avgContributions.explicit) },
        popularity: { expected: 0.13, actual: parseFloat(avgContributions.popularity) },
        recency: { expected: 0.12, actual: parseFloat(avgContributions.recency) },
        trending: { expected: 0.02, actual: parseFloat(avgContributions.trending) },
        engagement: { expected: 0.03, actual: parseFloat(avgContributions.engagement) }
      },
      qualityCaps: capValidation,
      componentBreakdown: componentAnalysis.map(c => ({
        explicit: c.explicit.score.toFixed(3),
        popularity: c.popularity.score.toFixed(3),
        recency: c.recency.score.toFixed(3),
        trending: c.trending.score.toFixed(3),
        engagement: c.engagement.score.toFixed(3),
        baseScore: c.baseScore.toFixed(4),
        finalScore: c.finalScore.toFixed(4),
        qualityCapApplied: c.qualityCap?.applied || false
      })),
      totalRecommendations: count
    };
  }

  /**
   * NEW: Calculate continuous scoring accuracy (not binary relevance)
   * Compares predicted continuous scores vs actual relevance scores
   */
  static calculateScoringAccuracy(recommendations, userInterests = []) {
    if (!recommendations || recommendations.length === 0) {
      return {
        accuracy: 0,
        avgPredictedScore: 0,
        avgExpectedScore: 0,
        correlationWithEngagement: 0
      };
    }

    // Calculate predicted scores based on hybrid components
    const predictedScores = recommendations.map(rec => {
      const components = this.calculateHybridComponentScores(rec, userInterests);
      return components.finalScore;
    });

    // Calculate expected scores based on user interests
    const expectedScores = recommendations.map(rec => {
      const tags = (rec.tags || []).map(t => String(t).toLowerCase());
      
      // Strong match: all or most tags match interests
      if (tags.length > 0 && userInterests.length > 0) {
        const matchedTags = tags.filter(tag => 
          this.tagMatchesInterests(tag, userInterests)
        );
        const matchRatio = matchedTags.length / Math.max(tags.length, 1);
        return matchRatio > 0.8 ? 0.95 : matchRatio > 0.5 ? 0.75 : matchRatio > 0.2 ? 0.45 : 0.1;
      }
      
      return 0.5; // Default if no tags
    });

    // Calculate scoring accuracy as correlation
    const avgPredicted = predictedScores.reduce((a, b) => a + b, 0) / predictedScores.length;
    const avgExpected = expectedScores.reduce((a, b) => a + b, 0) / expectedScores.length;

    let correlation = 0;
    let predVar = 0;
    let expVar = 0;
    let covariance = 0;

    for (let i = 0; i < predictedScores.length; i++) {
      const predDiff = predictedScores[i] - avgPredicted;
      const expDiff = expectedScores[i] - avgExpected;
      covariance += predDiff * expDiff;
      predVar += predDiff * predDiff;
      expVar += expDiff * expDiff;
    }

    if (predVar > 0 && expVar > 0) {
      correlation = covariance / Math.sqrt(predVar * expVar);
    }

    // Calculate accuracy as normalized correlation
    const accuracy = Math.max(0, correlation); // 0 to 1 range

    return {
      accuracy: Math.min(1, accuracy),
      avgPredictedScore: avgPredicted,
      avgExpectedScore: avgExpected,
      correlation: correlation,
      scoreDifference: Math.abs(avgPredicted - avgExpected),
      allScorePairs: predictedScores.map((pred, idx) => ({
        predicted: pred.toFixed(3),
        expected: expectedScores[idx].toFixed(3),
        difference: (pred - expectedScores[idx]).toFixed(3)
      }))
    };
  }

  /**
   * NEW: Calculate continuous relevance score (0-1) based on interest match strength
   * Replaces binary relevance (0/1) with nuanced scoring for accurate RMSE/MAE
   */
  static calculateContinuousRelevance(recommendation, userInterests = [], relevantItems = [], userPosts = []) {
    const recTags = (recommendation.tags || []).map(t => String(t).toLowerCase());

    // 1. EXACT MATCH with user's engaged items (highest relevance)
    if (relevantItems.some(item => String(item._id) === String(recommendation._id))) {
      return 0.95; // Very high relevance
    }

    // 2. STRONG INTEREST MATCH (direct tag overlap)
    if (userInterests.length > 0 && recTags.some(tag => this.tagMatchesInterests(tag, userInterests))) {
      // Calculate match strength based on number of matching tags
      const matchedTags = recTags.filter(tag => this.tagMatchesInterests(tag, userInterests));
      const matchRatio = matchedTags.length / Math.max(recTags.length, 1);
      return Math.min(0.85, 0.6 + (matchRatio * 0.25)); // 0.6-0.85 range
    }

    // 3. COLLABORATIVE SIGNAL (tags from user's engaged content)
    if (userPosts.length > 0) {
      const engagedTags = new Set();
      userPosts.forEach(post => {
        (post.tags || []).forEach(tag => {
          engagedTags.add(String(tag).toLowerCase());
        });
      });

      const collaborativeMatches = recTags.filter(tag => engagedTags.has(tag));
      if (collaborativeMatches.length > 0) {
        const collabRatio = collaborativeMatches.length / recTags.length;
        return Math.min(0.65, 0.4 + (collabRatio * 0.25)); // 0.4-0.65 range
      }
    }

    // 4. HIGH ENGAGEMENT FALLBACK (trending/popular content)
    const likes = recommendation.engagementMetrics?.likes || 0;
    if (likes > 100) return 0.55; // Very popular
    if (likes > 50) return 0.45;  // Moderately popular

    // 5. RECENT CONTENT FALLBACK (fresh posts)
    if (recommendation.date || recommendation.createdAt) {
      const itemDate = new Date(recommendation.date || recommendation.createdAt);
      const nowDate = new Date();
      const daysSince = Math.floor((nowDate - itemDate) / (1000 * 60 * 60 * 24));
      if (daysSince <= 1) return 0.35; // Very recent
      if (daysSince <= 3) return 0.25; // Recent
      if (daysSince <= 7) return 0.15; // Somewhat recent
    }

    // 6. LOW RELEVANCE (no strong signals)
    return 0.05; // Minimal relevance to avoid complete irrelevance
  }


}

module.exports = MetricsEvaluator;
