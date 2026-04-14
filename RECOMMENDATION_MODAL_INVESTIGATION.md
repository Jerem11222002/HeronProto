# Recommendation Modal Investigation Report

## Executive Summary
The recommendation modal shows **generic/default events instead of personalized ones** because the event fetching pipeline is missing critical filtering. While the scoring system IS properly personalized, it's scoring **all events in the database** (including past, private, etc.) and returning top results by engagement rather than by user relevance.

---

## Problem Breakdown

### Root Cause
The `getContent()` method in [backend/scripts/dynamicRecommendationEvaluator.js](backend/scripts/dynamicRecommendationEvaluator.js#L163-L175) fetches **ALL events without filtering**:

```javascript
// LINES 163-175 - THE PROBLEM
async getContent() {
  try {
    const posts = await Post.find()
      .select('_id title desc tags organization likes engagementMetrics mediaType createdAt')
      .lean();

    const events = await Event.find()
      .select('_id title description date tags organization status engagementMetrics createdAt')
      .lean();

    console.log(`📚 Found ${posts.length} posts, ${events.length} events`);
    return { posts, events };
```

**Missing Filters:**
1. ❌ No `status` filter (includes past, completed, cancelled events)
2. ❌ No `visibility` filter (could include private events)
3. ❌ No user registration filter (recommends events user already registered for)
4. ❌ No date range filter (includes 2020 events)
5. ❌ No user interest pre-filtering

---

## Data Flow Analysis

### Current Pipeline
```
RecommendationModal (React)
  └─> POST /api/recommendations/evaluate
      └─> SingleUserRecommendationEvaluator.evaluateUser()
          ├─> getUser() ✅ (works fine)
          ├─> getContent() ❌ (FETCHES ALL EVENTS)
          ├─> generateRecommendationsWithExplanations()
          └─> RecommendationService.getRecommendations()
              └─> calculateFinalScore() for EACH item
                  ├─ calculateInterestScore() (0.60 weight for posts, varies for events)
                  ├─ calculateCollaborativeScore() (0.40 weight for events)  
                  ├─ calculateEventTimeRelevance() (0.20 weight)
                  └─ calculateRecencyScore() (0.25 weight for events)
```

### What SHOULD Happen
Look at the comparison with [backend/services/recommendations.js#L1678-L1700](backend/services/recommendations.js#L1678-L1700) in the `getHybridFeed()` method:

```javascript
// CORRECT FILTERING (from getHybridFeed)
const eventQuery = {
  $and: [
    { 
      status: { 
        $in: ['upcoming', 'ongoing']  // ✅ Only future/current
      }
    },
    {
      $or: [
        // ✅ Interest-based matching
        { tags: { $in: normalizedInterests } },
        // ✅ Organization category matching
        // ✅ Visibility check (public events)
      ]
    }
  ]
};
```

---

## Impact Analysis

### What's Being Returned
- **Total events in DB**: Unknown (need to count)
- **Events passed to scoring**: ALL events (including past ones)
- **Events returned as recommendations**: Top 20 by engagement score
- **Result**: Generic, historically-popular events instead of personalized matches

### Example Problem Scenario
```
DATABASE EVENTS:
1. "Annual Music Festival 2023" (PAST, completed) - 1000 registrations
2. "Blockchain Workshop" (UPCOMING) - 10 registrations, no tags
3. "Dance Class 2025" (UPCOMING) - 2 registrations, tags: [dance, modern-dance]
4. "Theatre Performance" (UPCOMING) - 5 registrations, tags: [theatre, drama]

USER PROFILE: interests = [dance, theatre, drama]

CURRENT BEHAVIOR (no filter):
- Festival gets scored high (engagement boost despite being past)
- Dance Class scores: interestScore=0.95 × 0.6 = 0.57
- Top recommendations might include Festival anyway (no status filter)

CORRECT BEHAVIOR (with filter):
- Festival excluded (status != upcoming/ongoing)
- Remaining filtered by status first
- Dance Class and Theatre Performance ranked by personalized score
```

---

## Scoring System Analysis

The scoring logic **IS properly personalized**. Here's how it works:

### Event Scoring Formula
```
finalScore = (
  (collaborativeScore × 0.40) +      // Organization + user similarity
  (interestScore × 0.60) +           // Interest match (HIGHEST WEIGHT)
  (timeScore × 0.20) +               // Days until event
  (recencyScore × 0.25) +            // When event was created
  (implicitScore × 0.05)             // Past engagement patterns
) × organizationWeight
```

**Interest Score Details** ([backend/services/recommendations.js#L1094-L1200](backend/services/recommendations.js#L1094-L1200)):
- Exact tag matches: **1.0 weight**
- Organization matches: **0.8-1.0 weight**
- Partial matches: **0.6 weight**
- Related term matches: **0.5 weight**
- Zero interest match: **0.05 score** (minimal)

### The Problem
Even though scoring prioritizes interests (60% weight), when **ALL events are scored**, generic events with high engagement win:

```
Generic High-Engagement Event:
- interestScore = 0.05 (no tag match)
- collaborative = 0.8 (many registrations)
- finalScore = (0.80 × 0.40) + (0.05 × 0.60) = 0.35 ✓

Personalized Event (but past/unfiltered):
- interestScore = 0.95 (perfect match)
- date = 2 years ago (past event)
- finalScore = 0.95 × 0.20 = 0.19 ✗

Generic wins even though personalized has better interest match!
```

---

## Database Statistics

### Query to Check Event Count
```javascript
// Run these to see current state:
const totalEvents = await Event.countDocuments({});
const upcomingEvents = await Event.countDocuments({ status: 'upcoming' });
const ongoingEvents = await Event.countDocuments({ status: 'ongoing' });
const pastEvents = await Event.countDocuments({ status: { $in: ['completed', 'cancelled', 'past'] } });
const publicEvents = await Event.countDocuments({ visibility: 'public' });
```

### What We Know from events-debug.json
```
User: cheesecake0101
Total events returned: 12 (by hybrid recommender)
Event status breakdown:
- upcoming: 12
- ongoing: 0

_baseScore analysis (from events-debug.json):
- Most events have _baseScore=0 (no interest match in hybrid system)
- _collabScore ranges: 0 to 1 (based on registrations)
- Events ranked by collaborative score, not interest match!
```

This shows the hybrid recommender has the same issue!

---

## Missing Filtering Logic That Should Be Applied

### 1. **Status Filter** ⭐ CRITICAL
```javascript
// MUST filter for upcoming/ongoing only
status: { $in: ['upcoming', 'ongoing'] }
```

### 2. **Visibility Filter** ⭐ CRITICAL
```javascript
// MUST filter public or user's organization events
visibility: { $in: ['public', 'organization-only'] }
```

### 3. **Date Range Filter** ⭐ IMPORTANT
```javascript
// MUST filter future dates
date: { $gte: new Date() }
```

### 4. **Registration Filter** (SHOULD HAVE)
```javascript
// Exclude events user already registered for
'contentPreferences.registeredEvents': { $ne: userId }
```

### 5. **User Interest Pre-Filtering** (OPTIMIZATION)
```javascript
// Pre-filter by interests before scoring
tags: { $in: userNormalizedInterests }
// OR organization: { $in: ORGANIZATION_CATEGORIES matching interests }
```

### 6. **Duplicate Prevention** (SHOULD HAVE)
```javascript
// Exclude events already shown in feed
_id: { $nin: previouslyShownEventIds }
```

---

## Exact Location of Code Issues

### Issue #1: Missing Event Filters in getContent()
**File**: [backend/scripts/dynamicRecommendationEvaluator.js](backend/scripts/dynamicRecommendationEvaluator.js#L163-L175)
**Lines**: 163-175
**Current Code**:
```javascript
const events = await Event.find()
  .select('_id title description date tags organization status engagementMetrics createdAt')
  .lean();
```

**Should Be**:
```javascript
const events = await Event.find({
  status: { $in: ['upcoming', 'ongoing'] },
  visibility: { $in: ['public', 'organization-only'] },
  date: { $gte: new Date() }
})
  .select('_id title description date tags organization status engagementMetrics createdAt')
  .lean();
```

### Issue #2: Collaborative Score Not Weighting Interest Properly
**File**: [backend/services/recommendations.js](backend/services/recommendations.js#L810-830)
**Lines**: 810-830 - Event scoring weights

Current event weights:
```javascript
const weights = {
  base: 0.2,           // Collaborative (too low!)
  explicit: 0.6,       // Interest match (good)
  recency: 0.25,       // Post age
  implicit: 0.05       // Past behavior
};
```

Issue: `base` (collaborative) is only 0.2, but collaborative score is often 0 if no previous similar users.

### Issue #3: Scoring Returns Default/Generic Events
**File**: [backend/services/recommendations.js](backend/services/recommendations.js#L1877-1910)
**Lines**: 1877-1910 - getRecommendations() method

The scoring IS good, but it's sorting by score then slicing top N:
```javascript
const sorted = scoredContent
  .sort((a, b) => (b.score || 0) - (a.score || 0))
  .slice(0, limit)
```

When ALL events are in the pool, this works against personalization.

---

## Filtering Logic That's Missing But Implemented Elsewhere

### Reference: getEventsMatchingUser() Method
**File**: [backend/services/recommendations.js](backend/services/recommendations.js#L1945-1975)
**Lines**: 1945-1975

This method DOES proper filtering:
```javascript
// If no interests/orgs, return public, upcoming/ongoing events as fallback
if (!interestRegexes.length && !orgRegexes.length) {
  return await Event.find({
    visibility: 'public',
    status: { $in: ['upcoming', 'ongoing'] }
  })
    .populate('createdBy', 'name profilePicture organization')
    .sort({ date: 1 })
    .limit(limit)
    .lean();
}

const query = {
  $and: [
    { visibility: { $in: ['public', 'organization-only'] } },
    {
      $or: [
        ...(interestRegexes.length ? [{ tags: { $in: interestRegexes } }] : []),
        ...(orgRegexes.length ? [{ organization: { $in: orgRegexes } }] : [])
      ]
    }
  ]
};
```

This approach should be adopted in `getContent()`.

---

## Verification Steps

To confirm this hypothesis, check:

### 1. Count Events in Database
```javascript
// In backend, run:
const totalEvents = await Event.countDocuments({});
const upcomingEvents = await Event.countDocuments({ status: 'upcoming' });
console.log(`Total: ${totalEvents}, Upcoming: ${upcomingEvents}`);
```

**Expected**: If upcomingEvents << totalEvents, confirms filtering issue.

### 2. Check Event Scores in Logs
Run the evaluation API and check logs for the scoring breakdown:
```
[RecommendationService] Event Final Score: {
  eventId: '...',
  scores: {
    orgScore: 0.5,      // Collaborative
    interestScore: 0.05, // Interest (LOW!)
    timeScore: 0.5       // Time relevance
  }
}
```

If interestScore is consistently low despite user having relevant interests, the pool includes unrelated events.

### 3. Compare With Hybrid Feed
Check if `/api/feed` returns better recommendations than modal:
- If YES: Hybrid feed is applying filters that modal isn't
- If NO: Both have same issue indicating it's in the scoring logic

---

## Summary: What Needs to Be Fixed

| Issue | Location | Fix | Priority |
|-------|----------|-----|----------|
| Missing status filter | `getContent()` line 170 | Add `status: { $in: ['upcoming', 'ongoing'] }` | 🔴 CRITICAL |
| Missing visibility filter | `getContent()` line 170 | Add `visibility: { $in: ['public', 'organization-only'] }` | 🔴 CRITICAL |
| Missing date filter | `getContent()` line 170 | Add `date: { $gte: new Date() }` | 🔴 CRITICAL |
| No registration exclusion | `getContent()` line 170 | Filter out user's registered events | 🟡 IMPORTANT |
| Weak event filtering | `getHybridFeed()` weights | Increase interest weight, verify collaborative | 🟡 IMPORTANT |
| No interest pre-filtering | `getContent()` optimization | Pre-filter by tags before scoring (optional) | 🟢 NICE |

---

## Next Steps

1. **Immediate Fix**: Update [backend/scripts/dynamicRecommendationEvaluator.js](backend/scripts/dynamicRecommendationEvaluator.js#L163-L175) `getContent()` method with proper filters
2. **Verify**: Run database count queries to see event distribution
3. **Test**: Compare modal recommendations before/after fix
4. **Optimize**: Consider moving filters to getHybridFeed() as well
5. **Monitor**: Add debug logging to see score breakdowns

---

## Files to Review
- [backend/scripts/dynamicRecommendationEvaluator.js](backend/scripts/dynamicRecommendationEvaluator.js) - getContent() needs filtering
- [backend/services/recommendations.js](backend/services/recommendations.js) - getEventsMatchingUser() reference implementation
- [backend/services/eventService.js](backend/services/eventService.js) - getRecommendedEvents() may have similar issues
- [backend/routes/recommendationEvaluation.js](backend/routes/recommendationEvaluation.js) - API endpoint

---

## Related Documentation
- [HYBRID_FILTERING_DOCUMENTATION.md](HYBRID_FILTERING_DOCUMENTATION.md) - Explains scoring system
- [RECOMMENDATION_FIX_COMPLETE.md](RECOMMENDATION_FIX_COMPLETE.md) - Previous fixes applied
- [evaluation_results.json](evaluation_results.json) - Sample evaluation output
- [events-debug.json](events-debug.json) - Sample event recommendations with scores
