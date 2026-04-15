# MRR Low Score Analysis - Root Cause & Fix

## Problem Summary
**Your MRR is 0.227 (22.7%)** even though you've engaged with multiple posts. This means the first relevant item appears at position ~4-5 instead of position 1.

---

## Root Cause Analysis

### Current Scoring Weights (recommendations.js:703-708)
```javascript
const WEIGHTS = {
  explicit: 0.80,      // Tag/keyword matching against user interests
  time: 0.10,          // Recency boost
  popularity: 0.10,    // Community engagement (likes, shares)
  implicit: 0.00       // 🔴 PAST ENGAGEMENT: ZERO WEIGHT
};
```

**The Critical Issue:** 
- `implicit: 0.00` means **your past engagement history has ZERO impact** on recommendations
- Algorithm only checks: "Does this item's tags match your interests?"
- It IGNORES: "Did you like similar items before?"

### Why This Creates Low MRR

| Step | What Happens | Impact |
|------|-------------|--------|
| 1 | You like Post A (Music interest tag) | Stored in database, but NOT tracked |
| 2 | New Post B comes (also Music tag) | Should rank high because you liked A |
| 3 | Algorithm checks tags | Uses only 80% explicit match score |
| 4 | But Post C is "more popular" (100 likes) | Gets higher score due to popularity boost |
| 5 | Result | Post B ranked #4, Post C ranked #1 ❌ |

**Real numbers from your metrics:**
- Total recommendations: 26
- Relevant items in history: 12
- Successfully matched: 8 (66.7%)
- **First relevant item position: ~4.4** (1/0.227 = 4.4)

This means:
- Posts 1-3 are probably newer/more popular but irrelevant
- Post 4 is finally relevant (you liked something similar)

---

## Why Your Numbers ARE Justified

### Metric: Interest Alignment 42.8% ⚠️
**Means:** Algorithm only recognizes 42.8% alignment between:
- Your interests profile (explicit interests you set)
- Posts/events you've actually engaged with

**Why:** Your engagement history tags might not be in your interests list
- Example: You liked a "music" post, but your interests list says "vocal"
- Algorithm: "No match!" ❌
- But you clearly liked it! ✅

### Metric: Coverage 66.7% ⚠️
**Means:** Only 8 out of 12 items you liked are recognized as relevant

**Why:** The 4 unmatched items don't have tags in your interests profile
- You engaged with them anyway
- But algorithm can't see the connection

### Metric: MRR 0.227 ⚠️
**Means:** Relevant items buried deep in recommendations

**Why:** Algorithm weight formula is:
```
Score = (explicit 0.80) + (recency 0.10) + (popularity 0.10) + (past_engagement 0.00)
```

Without past engagement weight:
- Recent popular posts get boosted to top (even if irrelevant)
- Your previously-liked items stay middle-ranked
- Result: MRR suffers

---

## Solution: Add Engagement History Boost

We need to add a **fourth scoring component** that checks if:
1. Did user like similar items before?
2. Does this item have similar tags to user's engagement history?
3. If yes, boost the score

### Proposed New Weights
```javascript
const WEIGHTS = {
  explicit: 0.65,           // Tag/keyword matching
  time: 0.10,               // Recency
  popularity: 0.10,         // Community engagement
  engagement_history: 0.15  // 🟢 NEW: Past engagement boost
};
```

### How It Works
```javascript
// New function to calculate engagement history score
static calculateEngagementHistoryBoost(item, userLikedPosts) {
  if (!userLikedPosts || userLikedPosts.length === 0) return 0;
  
  const itemTags = new Set((item.tags || []).map(t => t.toLowerCase()));
  
  // Find tags from posts user liked
  const likedItemTags = new Set();
  userLikedPosts.forEach(post => {
    (post.tags || []).forEach(tag => {
      likedItemTags.add(tag.toLowerCase());
    });
  });
  
  // Calculate overlap
  const overlap = [...itemTags].filter(tag => likedItemTags.has(tag)).length;
  const maxPossible = Math.max(itemTags.size, likedItemTags.size);
  
  // Higher boost if many tags match
  return maxPossible > 0 ? (overlap / maxPossible) : 0;
}

// In calculateFinalScore:
const engagementHistoryScore = await this.calculateEngagementHistoryBoost(item, user.likedPosts);
let finalScore = (
  explicitScore * WEIGHTS.explicit +
  timeScore * WEIGHTS.time +
  popularityScore * WEIGHTS.popularity +
  engagementHistoryScore * WEIGHTS.engagement_history
);
```

---

## Expected Improvements After Fix

### Before (Current)
- Explicit match: 80%
- Past engagement: 0% 🔴
- MRR: 0.227 (position 4.4)
- Coverage: 66.7% (8/12 items)

### After (With Engagement Boost)
- Explicit match: 65%
- Past engagement: 15% 🟢
- MRR: Expected 0.45-0.55 (position 1.8-2.2)
- Coverage: Expected 80-85% (10/12 items)

---

## Why This Matters

The current algorithm treats you like a new user every time:
- ❌ "You used to like posts about music? Doesn't matter."
- ❌ "This post has music tags and you liked similar stuff? Irrelevant."
- ✅ After fix: "This post matches your tags AND similar to things you liked? Boost it!"

**The fix is simple but powerful:** Give past engagement 15% weight instead of 0%.

---

## Implementation Checklist

- [ ] Create `calculateEngagementHistoryScore()` function
- [ ] Fetch user's liked posts when calculating recommendations
- [ ] Add engagement_history weight to WEIGHTS object
- [ ] Include engagement score in final score calculation
- [ ] Test MRR improves to >0.40
- [ ] Verify coverage increases to >75%
