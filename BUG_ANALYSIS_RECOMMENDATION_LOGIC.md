# Bug Analysis: Recommendation Logic Issues

**Date:** April 28, 2026  
**Analyst:** AI Code Review  
**Severity:** CRITICAL - Affects ranking quality  

---

## Executive Summary

A new user with interests `["music", "rock-music"]` sees posts about photography/art ranked **above** music-related content. This indicates the relevance scoring system is broken. Testing revealed **5 critical bugs** that cause unrelated items to rank high.

---

## Test Case: User "troy" with Music Interests

**User Profile:**
- Interests: `["music", "rock-music"]`
- Status: New user (cold start)

**Observed Issue:**
- Top post: "Photography Art" (0% relevant) - **WRONG**
- Expected: Music-related post should be first
- Events: Better but still poorly ranked

---

## Bugs Identified

### **BUG #1: Fallback Scoring Gives Points to Unrelated Items** ⚠️ CRITICAL

**Location:** [backend/services/recommendations.js](backend/services/recommendations.js#L1300-L1350)

**Problem:**
```javascript
// In calculateInterestScore() - "No matches" fallback
if (!hasAnyMatches) {
  totalScore = 0.0;
  if (item.organization && ORGANIZATION_CATEGORIES[item.organization]) {
    totalScore = 0.05;  // ❌ GIVES POINTS TO UNRELATED ITEMS!
  }
  if (item.type === 'event' && item.status === 'upcoming') {
    totalScore = Math.max(totalScore, 0.08);  // ❌ WORSE FOR EVENTS
  }
  totalScore = Math.max(totalScore, 0.01);  // ❌ ALWAYS GIVES MINIMUM SCORE
}
```

**Why It's Wrong:**
- A post about "photography" with zero interest matches gets `totalScore = 0.05`
- After normalization: `0.20 + (0.05 * 1.0) = 0.225`
- In `calculateFinalScore()`: `0.225 * 0.75 (explicit weight) = 0.169` → becomes competitive with music posts

**Impact:** Non-matching items get artificial scores, allowing them to rank above truly relevant content

**Fix:** Items with ZERO interest matches should get score of 0, not 0.01-0.08

---

### **BUG #2: Exact Match Not Implemented** ⚠️ CRITICAL

**Location:** [backend/services/recommendations.js](backend/services/recommendations.js#L1200)

**Problem:**
```javascript
const WEIGHTS = {
  EXACT_MATCH: 1.0,  // ✅ DEFINED
  PRIMARY_ORG_MATCH: 0.9,
  // ... other weights
};

// But in the actual matching logic:
itemTagsSet.forEach(tagLower => {
  // This code NEVER checks for EXACT_MATCH!
  // It goes straight to partial/related matches
  
  if (normalizedInterests.some(interest => {
    // This checks partial matches, not exact!
    if (tagLower.includes(interest) || interest.includes(tagLower)) {
      return true;  // ❌ PARTIAL MATCH, NOT EXACT!
    }
    // ...
  })) {
    totalScore += WEIGHTS.PARTIAL_MATCH;  // ❌ USES PARTIAL WEIGHT!
  }
});
```

**Why It's Wrong:**
- A post with tag "rock" should get EXACT_MATCH (1.0) for user interest "rock-music"
- Instead it gets PARTIAL_MATCH (0.5) because "rock" is contained in "rock-music"
- This under-weights perfect matches

**Impact:** Perfect matching posts get lower scores than they should

**Fix:** Check for exact matches FIRST and apply 1.0 weight

---

### **BUG #3: Score Capping Logic Broken**  ⚠️ CRITICAL

**Location:** [backend/services/recommendations.js](backend/services/recommendations.js#L900-L920)

**Problem:**
```javascript
// In calculateFinalScore() for posts:
const explicitScore = this.calculateInterestScore(itemWithTags, normalizedInterests); // Returns normalized 0-1

if (explicitScore === 0) {
  finalScore = Math.min(finalScore, 0.10);  // Cap at 0.10
} else if (explicitScore < 0.15) {
  finalScore = Math.min(finalScore, 0.30);  // Cap at 0.30
}
```

**The Core Problem:**
- `explicitScore` comes from `calculateInterestScore()` which returns **NORMALIZED** (0-1) score
- A photo with zero matches gets: `totalScore = 0.05` → normalized to `0.225`
- This `0.225` is NOT `< 0.15`, so the cap is NOT applied!
- The photo post then gets: `0.225 * 0.75 + popularityScore * 0.13 + ...`
- If the photo is popular (10 views), it could score 0.25+

**Why It's Wrong:**
- The check `explicitScore < 0.15` is comparing against a normalized score
- An item with ZERO actual matches might still be `> 0.15` after normalization
- This defeats the purpose of the capping mechanism

**Impact:** Unrelated posts can rank high if they have engagement

**Fix:** Check if EXPLICIT matches exist BEFORE normalizing, or use the raw score

---

### **BUG #4: Over-Generous Score Normalization**  ⚠️ CRITICAL

**Location:** [backend/services/recommendations.js](backend/services/recommendations.js#L1350-L1370)

**Problem:**
```javascript
let normalizedScore = totalScore;
if (totalScore > 0.2) {
  // Items with matches get mapped to 0.5-0.95 range
  normalizedScore = 0.50 + (totalScore * 0.45);  // ❌ INFLATES WEAK MATCHES
} else if (totalScore > 0) {
  // Weak matches get mapped to 0.2-0.4 range
  normalizedScore = 0.20 + (totalScore * 1.0);  // ❌ MINIMUM 0.20!
}
```

**Example Walkthrough - Photo vs Music Post:**

| Item | Tags | Score | After Norm | In Final Score |
|------|------|-------|------------|----------------|
| Photo (no match) | ["photography"] | 0.05 | 0.25 | 0.1875 (75% of 0.25) |
| Music Post | ["music", "concert"] | 0.4 | 0.68 | 0.51 (75% of 0.68) |

Result: Photo + engagement can beat Music post

**Why It's Wrong:**
- The formula `0.20 + (0.05 * 1.0) = 0.25` gives 20% baseline to UNRELATED items
- A photo with zero matches gets 0.25 score, which is only 20% lower than a weak music match
- This destroys the ranking differentiation

**Impact:** Weak matches and non-matches become indistinguishable

**Fix:** Use logarithmic or step-function normalization that increases gap between matched/unmatched

---

### **BUG #5: Event Collaborative Weighting Too High**  ⚠️ HIGH

**Location:** [backend/services/recommendations.js](backend/services/recommendations.js#L850-L870)

**Problem:**
```javascript
// For events:
let finalScore = (
  (orgScore * weights.base) +           // 40% - collaborative
  (interestScore * weights.explicit * 0.97) +  // ~30% - interest
  (timeScore * 0.2) +                   // 20%
  (recencyScore * weights.recency) +    // Extra
  (implicitScore * weights.implicit) +  // Extra
  (engagementHistoryScore * 0.03)       // 3%
);
```

**The Issue:**
- Collaborative filtering (40%) is still high even though app lacks diverse users
- With few users, collaborative metrics are noise/random
- Events with no interest match but high engagement (wrong audience) score high

**Example:**
- Event: "Art Exhibition" (no music tags)
- Similar users: None (new app, sparse data)
- User similarity score: ~0.1 (random)
- Collaborative score: 0.4 * 0.1 = 0.04
- Interest score: 0.0 (no match)
- Final: 0.04 + 0.0 + ... could still be 0.3-0.5 if timeScore is high

**Impact:** Unrelated events appear because collaborative signals are unreliable

**Fix:** Reduce collaborative to 15-20%, increase interest matching to 75%

---

## Ranking Order Issues

### **Current Behavior (WRONG):**
```
1. Photography Post (0 matches) - 0.28 score - HIGH ENGAGEMENT
2. Rock Music Post (perfect match) - 0.15 score - NO ENGAGEMENT
3. Music Event (good match) - 0.25 score - MEDIUM ENGAGEMENT
```

### **Expected Behavior (CORRECT):**
```
1. Rock Music Post (perfect match) - should be 0.80+
2. Music Event (good match) - should be 0.70+
3. Photography Post (no match) - should be 0.02 (almost invisible)
```

---

## Impact Analysis

### **Affected Components:**
- ✅ Posts feed ranking (content-based)
- ✅ Events feed ranking (hybrid)
- ✅ Hybrid feed distribution
- ✅ All personalized recommendations

### **Affected User Scenarios:**
- ❌ New users with specific interests see irrelevant content first
- ❌ Popular unrelated content drowns out relevant content
- ❌ Interest-based filtering ineffective
- ❌ Events page poor ranking quality

---

## Solution Outline

### Fix 1: Zero Out Non-Matching Items
```javascript
if (!hasAnyMatches) {
  totalScore = 0;  // NOT 0.05, 0.08, 0.01 - ZERO
}
```

### Fix 2: Implement Exact Match Detection
```javascript
normalizedInterests.forEach(interest => {
  if (itemTagsSet.has(interest.toLowerCase())) {
    totalScore += WEIGHTS.EXACT_MATCH;  // Use 1.0 weight
  }
});
```

### Fix 3: Check Raw Matches Before Normalizing
```javascript
// Track if we found ANY matches BEFORE normalizing
const hasMatches = matchDetails.exact + matchDetails.primary + ... > 0;

// Then in calculateFinalScore, use this raw data, not normalized score
if (!hasMatches) {
  finalScore = 0.02;  // Minimal, not 0.10
}
```

### Fix 4: Better Normalization
```javascript
// Option A: Linear with higher floor for matched items
if (hasMatches && totalScore > 0.2) {
  normalizedScore = 0.60 + (totalScore * 0.30);  // Maps 0.2-1.0 to 0.66-0.90
} else if (hasMatches) {
  normalizedScore = 0.40 + (totalScore * 0.20);  // Maps 0.0-0.2 to 0.40-0.44
} else {
  normalizedScore = 0.02;  // NO matches = almost invisible
}
```

### Fix 5: Reweight Event Collaborative
```javascript
// For events with sparse data:
const weights = {
  collaborative: 0.15,  // ↓ DOWN from 40%
  interestMatch: 0.75,  // ↑ UP from ~30%
  timeRelevance: 0.10
};
```

---

## Validation Checklist

- [ ] Post with tags ["music", "concert"] for user["music"] scores 0.8+
- [ ] Post with tags ["photography"] for user["music"] scores 0.02 (invisible)
- [ ] Popular unrelated post doesn't rank above relevant but unpopular post
- [ ] Event with matching org/tags ranks above unrelated events
- [ ] Exact tag matches prioritized over partial matches

---

## Files to Modify

1. **[backend/services/recommendations.js](backend/services/recommendations.js)**
   - `calculateInterestScore()` - Fix fallback, add exact match, fix normalization
   - `calculateFinalScore()` - Fix score capping logic
   - `calculateCollaborativeScore()` - Reweight for sparse data

---

## Next Steps

1. ✅ Apply all 5 fixes
2. Create test cases with known inputs/outputs
3. Run regression tests
4. Monitor metrics improvement (MRR, cosine similarity)
5. A/B test with real users
