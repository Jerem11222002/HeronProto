# Recommendation System Refinement Strategy

## Overview
This document outlines a systematic approach to improving recommendation accuracy metrics (Cosine Similarity, RMSE, MAE, MRR) without jumping straight to synthetic data generation. The strategy prioritizes signal quality and algorithm refinement over raw data volume.

---

## The Diagnosis: Data Quality vs. Algorithm vs. Data Quantity

### What You've Already Fixed ✅
- 111/124 posts had no tags → Now auto-extracted
- 9/19 events marked incorrectly → Now corrected
- Tag fallback system implemented

### What Likely Remains 🔍
- User engagement patterns incomplete
- Algorithm may be too strict in scoring
- Cold-start penalties too aggressive
- Feature extraction too sparse for cosine similarity

### The Truth About Synthetic Data ⚠️
Dummy accounts with dummy posts will:
- ✅ Improve coverage metrics (% of features represented)
- ❌ NOT improve accuracy for real users
- ❌ Mask underlying algorithm problems
- ⚠️ Create false confidence in low-signal data

**Bottom line**: Synthetic data has **diminishing returns** if algorithm/signal quality issues exist first.

---

## Recommended Strategy: Three-Week Approach

### Priority 1: Fix Signal Quality (Week 1)

**Goal**: Ensure every engagement signal in database is accurate and complete.

**Tasks**:
- [ ] **Audit tag completeness**
  - Are 100% of posts tagged OR have fallback tags?
  - Are tags semantically meaningful (not just "post" or "event")?
  - Query: `db.posts.find({ tags: { $exists: false } }).count()`

- [ ] **Verify engagement metrics logged**
  - Does database track: likes, views, comments, shares?
  - Are timestamps accurate?
  - Are user-item pairs unique (no duplicate likes)?
  - Query: `db.posts.aggregate([{ $group: { _id: "$_id", engagementCount: { $sum: 1 } } }])`

- [ ] **Create 3-5 seed users with rich history**
  - Real users who actively engaged with content
  - Each with 5-20 interactions matching their stated interests
  - Use these as **baseline test cases** for algorithm validation

- [ ] **Validate user profile data**
  - Are interests accurately recorded?
  - Are they normalized (consistent formatting)?
  - Query: `db.users.find({ interests: [] }).count()` (should be ~0 for active users)

- [ ] **Check organization data integrity**
  - Is every org-related event/post linked correctly?
  - Are org categories properly defined?
  - Query: `db.events.find({ organization: null }).count()`

**Metrics to collect**:
```javascript
// Run these to establish baseline
const avgTagsPerPost = /* calculate avg */;
const avgEngagementsPerPost = /* calculate avg */;
const avgInterestsPerUser = /* calculate avg */;
const avgEngagementsPerUser = /* calculate avg */;
const pctPostsWithTags = /* calculate % */;
const pctUsersWithInterests = /* calculate % */;
```

**Success criteria**:
- 100% of posts have tags (auto-extracted or fallback)
- 100% of events have status and visibility
- Avg 2+ interests per active user
- Avg 0.5+ engagements per post (ratio should be 1 user : 2 posts minimum)

---

### Priority 2: Refine Algorithm Constraints (Week 2)

**Goal**: Remove unnecessary strictness that kills accuracy on sparse data.

**Problems to fix**:

#### Problem 1: Cosine Similarity Returns Zero
**Issue**: When feature vectors have no overlap, similarity = 0 (not helpful)

**Current behavior**:
```javascript
// In metricsEvaluator.js
if (magnitudeA === 0 || magnitudeB === 0) return 0;
```

**Better approach**:
```javascript
// Add fallback similarity based on shared categories
if (magnitudeA === 0 || magnitudeB === 0) {
  // Check if they share any high-level category
  return sharedCategoryBoost(vectorA, vectorB); // 0.1-0.3
}
```

**Impact**: Prevents cold-start items from scoring 0, improves recall from X% to X+10-15%.

#### Problem 2: Strict Tag Matching
**Issue**: If post has no matching tag, score = 0 (even if content is relevant)

**Current behavior**:
```javascript
// Only exact tag matches count
const score = item.tags.some(t => userInterests.includes(t)) ? 0.8 : 0;
```

**Better approach**:
```javascript
// Tiered matching system
let score = 0;
if (item.tags.some(t => userInterests.includes(t))) {
  score = 0.8;  // Exact match
} else if (matchesRelatedTags(item.tags, userInterests)) {
  score = 0.5;  // Related match (music → band, concert)
} else if (textContentMatches(item, userInterests)) {
  score = 0.3;  // Text-based match
} else {
  score = 0.05; // Minimum visibility
}
return score;
```

**Impact**: Improves recall (more relevant items discovered), increases RMSE/MAE accuracy.

#### Problem 3: No Minimum Score Floor
**Issue**: Items with poor match get exactly 0, creating artificial zeros in metrics

**Current behavior**:
```javascript
// Zero means "not relevant at all"
return interestScore === 0 ? 0.0 : 0.8;
```

**Better approach**:
```javascript
// Implement soft minimum for cold-start
const MIN_SCORE = 0.05;
return Math.max(MIN_SCORE, baseScore);
```

**Impact**: All items are scoreable, improves coverage without spamming irrelevant content.

#### Problem 4: Suboptimal Weight Distribution
**Issue**: Weights may not match your data distribution

**Current weights** (from recommendations.js):
```javascript
const WEIGHTS = {
  interestMatch: 0.60,
  engagement: 0.20,
  recency: 0.10,
  organization: 0.10
};
```

**Test different distributions**:
```
Test 1: weightedByVariance = [0.70, 0.15, 0.10, 0.05]
Test 2: balanced = [0.50, 0.25, 0.15, 0.10]
Test 3: engagementFirst = [0.40, 0.40, 0.10, 0.10]

For each: measure RMSE, MAE, Precision@10
```

**Impact**: 2-3x improvement possible with right weights.

**Implementation**:
- [ ] Add fallback to cosine similarity
- [ ] Implement tiered tag matching
- [ ] Add minimum score floor (0.05)
- [ ] Create weight testing framework
- [ ] A/B test 3 weight distributions on seed users

**Success criteria**:
- % of items scoring 0 drops from ~30% to <10%
- RMSE improves by 10-20%
- Precision@10 improves by 15-25%

---

### Priority 3: Strategic Data Augmentation (Week 3)

**Only proceed if Weeks 1-2 show minimal improvement.**

#### If algorithm problems fixed but still low scores:

**Create strategic synthetic data**:
```javascript
// 10-15 synthetic seed users, not 1000
const syntheticUsers = [
  {
    id: "synthetic_1",
    interests: ["theatre", "drama", "performance"],
    engagements: [
      { postId: "post_drama_1", type: "like", timestamp: now },
      { postId: "post_drama_2", type: "like", timestamp: now },
      { eventId: "event_theatre_1", type: "attend", timestamp: now }
    ]
  },
  // ... 10-15 more
];
```

**DO**:
- ✅ Create diverse interest combinations
- ✅ Add realistic interaction sequences (3-8 per user)
- ✅ Match interactions to stated interests
- ✅ Use for coverage testing only

**DON'T**:
- ❌ Create 100+ synthetic accounts
- ❌ Have each synthetic user like every post
- ❌ Use synthetic data to train algorithm
- ❌ Treat synthetic engagements as real signals

**Purpose**: 
- Test edge cases (does algebra work for all coverage scenarios?)
- Not to improve accuracy (accuracy improves from fixing real signals)

**Success criteria**:
- All user interest combinations have ≥2 relevant items
- Coverage metrics improve to >80%
- Real user metrics don't get worse

---

## Quick Diagnostic: Identify Your Actual Bottleneck

**Run this analysis to know where to focus**:

```javascript
// 1. DATA QUALITY METRICS
const dataQualityCheck = async () => {
  const posts = await Post.find();
  const users = await User.find();
  const events = await Event.find();
  
  return {
    avgTagsPerPost: posts.reduce((sum, p) => sum + (p.tags?.length || 0), 0) / posts.length,
    avgEngagementsPerPost: posts.reduce((sum, p) => sum + (p.likes?.length || 0), 0) / posts.length,
    avgInterestsPerUser: users.reduce((sum, u) => sum + (u.interests?.length || 0), 0) / users.length,
    avgEngagementsPerUser: users.reduce((sum, u) => sum + (u.liked?.length || 0), 0) / users.length,
    pctPostsWithTags: (posts.filter(p => p.tags?.length > 0).length / posts.length) * 100,
    pctUsersWithInterests: (users.filter(u => u.interests?.length > 0).length / users.length) * 100,
  };
};

// 2. ALGORITHM TIGHTNESS METRICS
const algorithmTightnessCheck = async () => {
  const recommendations = await getRecommendationsForAllUsers();
  
  return {
    pctZeroScores: (recommendations.filter(r => r.score === 0).length / recommendations.length) * 100,
    pctLowScores: (recommendations.filter(r => r.score < 0.1).length / recommendations.length) * 100,
    avgNonZeroScore: recommendations.filter(r => r.score > 0).reduce((sum, r) => sum + r.score, 0) / recommendations.filter(r => r.score > 0).length,
    scoreDistribution: {
      "0-0.1": recommendations.filter(r => r.score >= 0 && r.score < 0.1).length,
      "0.1-0.3": recommendations.filter(r => r.score >= 0.1 && r.score < 0.3).length,
      "0.3-0.5": recommendations.filter(r => r.score >= 0.3 && r.score < 0.5).length,
      "0.5-0.7": recommendations.filter(r => r.score >= 0.5 && r.score < 0.7).length,
      "0.7-1.0": recommendations.filter(r => r.score >= 0.7).length,
    }
  };
};

// 3. USER SIGNAL METRICS
const userSignalCheck = async () => {
  const users = await User.find();
  
  return {
    avgInteractionsPerUser: users.reduce((sum, u) => sum + (u.liked?.length || 0), 0) / users.length,
    pctUsersWithZeroInteractions: (users.filter(u => !u.liked || u.liked.length === 0).length / users.length) * 100,
    avgInterestsPerActiveUser: users.filter(u => u.liked?.length > 0)
      .reduce((sum, u) => sum + (u.interests?.length || 0), 0) / users.filter(u => u.liked?.length > 0).length,
  };
};

// Run all checks
console.log("DATA QUALITY:", await dataQualityCheck());
console.log("ALGORITHM TIGHTNESS:", await algorithmTightnessCheck());
console.log("USER SIGNAL:", await userSignalCheck());
```

**Interpret results**:

| Metric | Target | If Below → Priority |
|--------|--------|-------------------|
| Avg tags per post | 1.5+ | Week 1: Data quality |
| Avg engagements per user | 3+ | Week 1: Data quality |
| % zero scores | <10% | Week 2: Algorithm |
| Avg non-zero score | >0.3 | Week 2: Algorithm |
| Avg interactions/user | 2+ | Week 1: Data quality |

---

## Implementation Roadmap

### Week 1: Data Quality
```
Monday: Audit tag completeness, engagement logging
Tuesday: Create seed users (3-5 real users with rich history)
Wednesday: Validate user interests, organization data
Thursday: Collect diagnostic metrics
Friday: Report on gaps
```

### Week 2: Algorithm Refinement
```
Monday: Implement tiered tag matching
Tuesday: Add fallback cosine similarity
Wednesday: Implement minimum score floor
Thursday: Create weight testing framework
Friday: Run A/B tests (3 weight distributions)
```

### Week 3: Data Augmentation (if needed)
```
Monday-Tuesday: Create synthetic seed users (10-15)
Wednesday: Test coverage edge cases
Thursday-Friday: Final tuning based on results
```

---

## Expected Improvements

### Week 1 Impact (Data Quality)
- Tag coverage: 89% → 100%
- Engagement completeness: +20-30%
- Expected metric improvement: +5-10%

### Week 2 Impact (Algorithm)
- Zero scores: -30% → -5%
- RMSE: -15-25%
- Precision@10: +20-30%
- MAE: -15-20%
- MRR: +10-20%

### Week 3 Impact (Synthetic Data)
- Coverage: +5-10%
- No expected change to real user metrics
- Risk: Could worsen if algorithm still has issues

---

## Success Metrics: How to Know It's Working

**Track these before and after**:

```
BEFORE (Week 0):
  Cosine Similarity: X%
  RMSE: Y%
  MAE: Z%
  MRR: W%

AFTER WEEK 1:
  (Should see +5-10% improvement)

AFTER WEEK 2:
  (Should see +15-30% improvement from baseline)

AFTER WEEK 3:
  (Should stabilize if Week 1-2 work done correctly)
```

**When to pivot**:
- If Week 1 shows no improvement → might not be data quality issue
- If Week 2 shows <5% improvement → weights may be severely wrong, need deeper algorithmic redesign
- If Week 3 needed but Week 1-2 didn't help → reconsider approach entirely

---

## Common Pitfalls to Avoid

❌ **Pitfall 1**: "Let me just add 1000 synthetic users"
- Creates false confidence
- Algorithm learns noise
- Real metrics don't improve

✅ **Instead**: Create 10-15 strategic seed users for edge case testing

❌ **Pitfall 2**: "Change all the weights at once"
- Can't tell which change helped
- Might make things worse

✅ **Instead**: Test one weight distribution at a time, measure impact

❌ **Pitfall 3**: "Metrics are low, so algorithm is broken"
- Could be data signal issue
- Could be weights issue
- Could be evaluation metric mismatch

✅ **Instead**: Use diagnostic framework above to pinpoint

❌ **Pitfall 4**: "More data always helps"
- 15 users × 8 interactions beats 1000 users × 0.1 interactions
- Quality > Quantity

✅ **Instead**: Ensure every data point is meaningful signal

---

## Next Steps

**Choose one**:

1. **Run diagnostic** → Understand your bottleneck
2. **Implement Week 1** → Fix data quality issues
3. **Implement Week 2** → Refine algorithm
4. **Create synthetic test set** → For Week 3 readiness

Which would be most valuable for your project right now?
