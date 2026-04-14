# Recommendation System Improvement Guide

## Problem Summary
Your new user account reveals a critical issue: the recommendation system works _perfectly_ but only for content that exists. With 13 diverse interests but limited post coverage, metrics underperform.

**The Fix:** Three-tier approach addressing data gaps, ranking, and discovery balance.

---

## Tier 1: Quick Win - Adjust Recommendation Weights (5 min)

### Current Weights (Too strict for diverse interests)
```javascript
const WEIGHTS = {
  explicit: 0.80,      // Tag matching - PRIMARY
  time: 0.10,          // Recency
  popularity: 0.10,    // Engagement
  implicit: 0.00       // No following boost
};
```

### Recommended Weights (Better Discovery)
```javascript
const WEIGHTS = {
  explicit: 0.70,      // Still primary, but allow discovery
  time: 0.15,          // Slightly more recency boost
  popularity: 0.15,    // Slightly more popularity boost
  implicit: 0.00       // Keep no following boost
};
```

### Impact
- **Allows more diverse recommendations** that don't perfectly match tags
- **Helps newer/popular content surface** even with weak interest match
- **Estimated improvement:** Interest Alignment +15%, MRR +10%

### Implementation Location
**File:** [`backend/services/recommendations.js`](backend/services/recommendations.js) around **line 756-765**

```javascript
// OLD: Weighted blend - EXPLICIT INTEREST is PRIMARY for testing accuracy
const WEIGHTS = {
  explicit: 0.80,      
  time: 0.10,          
  popularity: 0.10,    
  implicit: 0.00       
};

// NEW: Balanced blend - Allow some discovery
const WEIGHTS = {
  explicit: 0.70,      // Was 0.80 - allow 30% of score from other factors now
  time: 0.15,          // Was 0.10 - boost recency slightly
  popularity: 0.15,    // Was 0.10 - boost community signals
  implicit: 0.00       // Keep zero
};
```

---

## Tier 2: Create Interest Thesaurus (15 min)

### The Problem
User selected "film" but database has NO "film" posts. However, some posts tagged "visual-arts" or "video" might be film-related but aren't matched.

### Solution: Interest Expansion Map
Add to [`backend/services/recommendations.js`](backend/services/recommendations.js) around **line 95**:

```javascript
// EXISTING: this.interestMap = { music: [...], ... }

// ADD THIS - Cross-interest mappings for discovery
static interestCrossMap = {
  // Link related but distinct interests
  'film': ['video', 'visual-arts', 'cinema', 'animation', 'multimedia'],
  'fashion': ['design', 'visual-arts', 'performance', 'creative'],
  'writing': ['performance', 'cultural-arts', 'poetry', 'literature'],
  'photogrammetry': ['visual-arts', 'photography', 'design', 'technical-production'],
  'sculpture': ['visual-arts', 'art', 'creative', 'design'],
  
  // Strengthen existing mappings
  'music': ['performance', 'band', 'concert', 'vocal-arts', 'music'], // was missing cross-refs
  'photography': ['visual-arts', 'creative', 'design'],
  'animation': ['film', 'visual-arts', 'performance', 'multimedia'],
};
```

### In `calculateInterestScore()` function (around line 1260):
```javascript
// EXISTING CODE:
const expandedInterests = new Set([
  ...normalizedInterests,
  ...normalizedInterests.flatMap(interest => this.interestMap[interest] || [])
]);

// ADD THIS AFTER:
// Expand further with cross-interest mappings for discovery
for (const interest of normalizedInterests) {
  const crossInterests = this.interestCrossMap[interest] || [];
  crossInterests.forEach(cross => expandedInterests.add(cross));
}
```

### Impact
- **Film posts** tagged "visual-arts" or "digital" will now match user's film interest
- **Fashion posts** tagged "design" or "creative" will match
- **Similar items surface together** even with different tag names
- **Estimated improvement:** +10-15% more matching posts, MRR +5%

---

## Tier 3: Increase Minimum Discovery Items (10 min)

### The Problem
Current minimum floor is too low for discovery. Posts with 0 interest match get capped at 0.10 score - buried forever.

### Current Code (line 1398 in `recommendations.js`)
```javascript
// Current: If explicit score is 0 (NO INTEREST MATCH), cap at 0.10
if (explicitScore === 0) {
  finalScore = Math.min(finalScore, 0.10);  // Buried
} else if (explicitScore < 0.15) {
  finalScore = Math.min(finalScore, 0.30);  // Low priority
}
```

### Recommended Improvement
```javascript
// NEW: Allow MORE discovery for users with diverse interests
// Count matching interests - diverse users should get more rows
const interestCount = (user.interests || []).length;
const shouldAllowMoreDiscovery = interestCount >= 8; // Flag diverse interests

if (explicitScore === 0 && !shouldAllowMoreDiscovery) {
  finalScore = Math.min(finalScore, 0.10);  // Standard cap for focused users
} else if (explicitScore === 0 && shouldAllowMoreDiscovery) {
  finalScore = Math.min(finalScore, 0.20);  // Higher cap for diverse users
} else if (explicitScore < 0.15) {
  finalScore = Math.min(finalScore, 0.35);  // Slightly more lenient
}
```

### Impact
- **Diverse users (8+ interests)** get more discovery content
- **Focused users (5-7 interests)** stay strict
- **More feed items surface** above minimum threshold
- **Users see 18-20 items** instead of 14-15
- **Estimated improvement:** +3-5 items per feed, MRR +3%

---

## Testing & Validation

### Before Making Changes
1. Run seed user recommendation test to get baseline:
```bash
node backend/scripts/seedUserRecommendationCheck.js > before.txt
```

2. Create test user with same 13 interests used in audit
3. Get their recommendations and note:
   - Item count (should be ~15)
   - Score range (should be 0.02-1.0)
   - Interest diversity (should be mostly 2-3 topics)

### After Making Changes
1. Run same test:
```bash
node backend/scripts/seedUserRecommendationCheck.js > after.txt
```

2. Compare:
   - Item count: 15 → 18-20? ✅
   - Score range: More values >0.30? ✅
   - Interest diversity: Wider topic mix? ✅
   - Ranking order: Relevant items earlier? ✅

### Metric Expectations
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Interest Alignment | 10.6% | 20-30% | ✅ Better |
| Ranking Quality (MRR) | 14.8% | 30-40% | ✅ Better |
| Feed Items | 15 | 18+ | ✅ Better |
| Avg Score | 0.35 | 0.45 | ✅ Better |

---

## Implementation Checklist

- [ ] **Tier 1: Adjust Weights** (5 min)
  - [ ] Edit weights in `recommendations.js` line 756-765
  - [ ] Test basic recommendation
  
- [ ] **Tier 2: Add Interest Thesaurus** (15 min)
  - [ ] Add `interestCrossMap` to class
  - [ ] Update `calculateInterestScore()` 
  - [ ] Test cross-interest matching
  
- [ ] **Tier 3: Discovery Floor** (10 min)
  - [ ] Add `shouldAllowMoreDiscovery` logic
  - [ ] Update score capping rules
  - [ ] Test diverse user feed
  
- [ ] **Validation** (10 min)
  - [ ] Create test user with 13 interests
  - [ ] Compare before/after metrics
  - [ ] Verify no regression for focused users

**Total Time:** ~40 minutes for full implementation

---

## Alternative: User-Level Solution

If you don't want code changes, the user can:

1. **Reduce interests to 6-8** (biggest impact)
   - Focus on: performance, visual-arts, dance, theatre, music, photography
   - Prediction: 60-70% metrics improvement immediately
   
2. **Create content** for missing interests
   - 5-10 posts tagged "film", "writing", "fashion" would help significantly
   
3. **Encourage community** to post more diverse content

---

## Next Steps

1. **Try Tier 1 first** - Lowest risk, quickest win
2. **Test with diverse user account**
3. **If metrics improve**, implement Tier 2 and 3
4. **If metrics don't improve**, check if user needs to reduce interests

Let me know which tier you want to implement first!
