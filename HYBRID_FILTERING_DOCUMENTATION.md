# Hybrid Recommendation System: Collaborative + Content-Based Filtering

**Document Date:** March 22, 2026  
**System:** HeronProto Recommendation Engine  
**Purpose:** Understanding how posts and events are recommended using hybrid filtering

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [How It Works - Detailed Breakdown](#how-it-works---detailed-breakdown)
4. [Posts Scoring (Content-Based)](#posts-scoring-content-based)
5. [Events Scoring (Collaborative + Content)](#events-scoring-collaborative--content)
6. [Collaborative Filtering Deep Dive](#collaborative-filtering-deep-dive)
7. [Key Differences](#key-differences)
8. [Real Example](#real-example)

---

## System Overview

The recommendation system uses a **hybrid approach** that combines:
- **Content-Based Filtering** (dominant for posts) - Matches user interests to item tags
- **Collaborative Filtering** (dominant for events) - Finds similar users and learns from their behavior

The system intelligently selects different weights for different content types to maximize recommendation quality.

---

## Architecture Diagram

```
User Profile (Interests: dance, theatre, drama)
        ↓
        ├─→ Similar Users (users with same interests/orgs)
        ├─→ Content Data (tags, popularity, recency)
        │
        ↓
     HYBRID RECOMMENDATION ENGINE
        │
        ├─→ FOR POSTS
        │    └─→ Content-Based Filtering
        │         • 60% Explicit Match (tag/keyword matching)
        │         • 20% Recency (how recent)
        │         • 15% Popularity (engagement)
        │         • 5% Implicit (past behavior)
        │
        ├─→ FOR EVENTS
        │    └─→ Collaborative + Content
        │         • 40% Organization Popularity
        │         • 40% User Similarity Score
        │         • 20% Time-Weighted Engagement
        │         • + Interest Match (bonus)
        │         • + Time Relevance (bonus)
        │
        ↓
    Calculate Final Score (0-1 normalized)
        ↓
    Rank All Items
        ↓
    Return Top 10 Recommendations
```

---

## How It Works - Detailed Breakdown

### For POSTS (Content-Based Dominant)

The system prioritizes **what the post says** over social signals.

| Factor | Weight | What It Does | Example |
|--------|--------|-------------|---------|
| **Explicit Interest Match** | 60% | Direct tag/keyword matching with user interests | "dance" tag matches user's "dance" interest → High score |
| **Recency** | 20% | How recent the post is | Posts from today rank higher than 1-month-old ones |
| **Popularity** | 15% | Engagement (likes, views, comments, shares) | Post with 3,000 views and 50 likes → Boosts score |
| **Implicit Preferences** | 5% | Derived from past behavior (what you liked before) | User liked video content → video posts get slight boost |
| **Following Boost** | +5% | If post is from someone you follow | Posts from followed users get +5% boost |
| **Past Engagement** | +4-8% | If you saved/liked/shared this exact post | Saved content gets 4-8% boost |

#### Example Calculation for "folkdance#ph" Post

```
Component               Score    Weight    Contribution
─────────────────────────────────────────────────────
Explicit Interest Match  0.85 ×   0.60  =  0.510
Recency Score            0.75 ×   0.20  =  0.150
Popularity Score         0.90 ×   0.15  =  0.135
Implicit Score           0.60 ×   0.05  =  0.030
─────────────────────────────────────────────────────
                                 TOTAL  =  0.825 ✓ EXCELLENT
```

---

### For EVENTS (Collaborative + Content Balance)

The system prioritizes **what similar users do** combined with **content matching**.

| Factor | Weight | What It Does | How |
|--------|--------|-------------|-----|
| **Organization Base Score** | 40% | Whether similar users engage with this org | Finds similar users → checks their org engagement |
| **User Similarity Score** | 40% | How similar other users are to you | Shares interests? Same orgs? Same following? |
| **Time-Weighted Engagement** | 20% | Recent registrations/interest + time decay | Recent events weighted higher (30-day decay) |
| **Interest Match** | Bonus | Direct tag matching (secondary) | Event tags match your interests |
| **Past Engagement** | Multiplier | Events you registered/interested in | Registered event gets 40% boost, Interested gets 30% |

#### Example Event Scoring

```
Component                      Score    Weight    Contribution
────────────────────────────────────────────────────────────
Organization Base Score         0.60 ×   0.40  =  0.240
Time-Weighted Engagement        0.80 ×   0.40  =  0.320
User Similarity Score           0.70 ×   0.20  =  0.140
────────────────────────────────────────────────────────────
                                        TOTAL  =  0.700 ✓ GOOD
```

---

## Posts Scoring (Content-Based)

### Scoring Process

1. **Extract User Interests** (normalized/expanded)
   - Normalize old/alternative spellings
   - Expand related interests (e.g., "dance" → includes "contemporary-dance", "modern-dance")

2. **Match Post Tags to User Interests**
   - Direct match: 1.0 points
   - Partial match: 0.5 points
   - No match: 0.0 points
   - Multiple matches: averaged

3. **Calculate Recency Score**
   - Posted today: 1.0
   - Posted 7 days ago: 0.85
   - Posted 30 days ago: 0.5
   - Posted 90+ days ago: 0.1

4. **Calculate Popularity Score** (normalized 0-1)
   - Views: 40% weight
   - Likes: 30% weight
   - Comments: 20% weight
   - Shares: 10% weight

5. **Combine Scores with Weights**
   ```
   Final Score = (explicit × 0.60) + (recency × 0.20) + 
                 (popularity × 0.15) + (implicit × 0.05)
   ```

6. **Apply Boosts**
   - From followed users: ×1.05
   - Previously saved: ×1.04
   - Previously liked: ×1.06
   - Previously shared: ×1.08

---

## Events Scoring (Collaborative + Content)

### Scoring Process

1. **Find Similar Users**
   ```
   SELECT users WHERE
   - Share 1+ interests with target user
   - Share 1+ organizations with target user
   - Follow or are followed by target user
   ```

2. **Calculate User Similarity for Each Similar User**
   ```
   Similarity = (interest_overlap × 0.5) + 
                (org_overlap × 0.3) + 
                (implicit_overlap × 0.2)
   ```

3. **Calculate Organization Base Score**
   ```
   IF event.organization matches user's primary interest:
       score = 0.6
   IF event.organization matches user's secondary interests:
       score += 0.4
   Otherwise:
       score = 0.0
   ```

4. **Calculate Time-Weighted Engagement**
   ```
   FOR each similar event's registrations/interests:
       - Apply 30-day decay: weight = e^(-days / 30)
       - engagement_score = (interested × 0.3 + registered × 0.7) × decay
   Average across all similar events
   ```

5. **Combine All Scores**
   ```
   Final Score = (org_base × 0.4) + 
                 (time_weighted_engagement × 0.4) + 
                 (avg_user_similarity × 0.2)
   ```

6. **Apply Multiple Boosts**
   - Registered events: ×1.4 (40% boost)
   - Interested events: ×1.3 (30% boost)
   - Shared events: ×1.25 (25% boost)
   - Organization weight multiplier

---

## Collaborative Filtering Deep Dive

### How It Works: User-to-User Similarity

Let's trace through the system with **cheesecake0101** (interests: `dance`, `theatre`, `drama`)

#### Step 1: Find Similar Users

```
Query database for users WHERE:
✓ interests CONTAINS any of: dance, theatre, drama
✓ organizations CONTAINS: CAST, UMAK Siglahi, CULTURA, etc.
✓ following list includes any user I follow

Result: 8-12 similar users found
```

#### Step 2: Calculate Similarity Score for Each User

Example: Compare cheesecake0101 with user_xyz

```
User Interest Overlap (50% weight):
  My interests:         [dance, theatre, drama]
  Their interests:      [dance, theatre, performance, music]
  Overlap count:        2/3 = 0.667
  Contribution:         0.667 × 0.5 = 0.334

Organization Overlap (30% weight):
  My orgs:              [UMAK Siglahi, CAST]
  Their orgs:           [UMAK Siglahi]
  Overlap count:        1/2 = 0.5
  Contribution:         0.5 × 0.3 = 0.15

Following Overlap (20% weight):
  My following:         25 users
  Their following:      20 users
  Mutual following:     8 users = 0.32
  Contribution:         0.32 × 0.2 = 0.064

TOTAL USER SIMILARITY = 0.334 + 0.15 + 0.064 = 0.548
```

#### Step 3: Check Similar Users' Organization Engagement

For event at "UMAK Dance Extreme":

```
Aggregate data from all similar users:
- How many registered for UMAK Dance Extreme events? 12 users
- How many marked interested? 15 users
- Recent events in last 30 days? 3 events

Time-Weighted Calculation:
Event 1 (3 days ago):     (12 registered × 0.7 + 15 interested × 0.3) × e^(-3/30) = 7.8 × 0.91 = 7.1
Event 2 (12 days ago):    (8 registered × 0.7 + 10 interested × 0.3) × e^(-12/30) = 6.8 × 0.68 = 4.6
Event 3 (25 days ago):    (5 registered × 0.7 + 7 interested × 0.3) × e^(-25/30) = 4.6 × 0.42 = 1.9

Average Time-Weighted Engagement = (7.1 + 4.6 + 1.9) / 3 = 4.53
Normalized to 0-1 scale = 0.68
```

#### Step 4: Calculate Final Event Score

```
Org Base Score:           0.6  (dance matches primary interest)
Time-Weighted Engagement: 0.68 (normalized)
User Similarity:          0.548 (from Step 2)

Final Score = (0.6 × 0.4) + (0.68 × 0.4) + (0.548 × 0.2)
            = 0.24 + 0.272 + 0.110
            = 0.622 ✓ GOOD SCORE
```

---

## Key Differences

### Posts Use Content-Based (60% Interest Weight)

**Advantages:**
- ✅ Focus on **what the post says** (tags, content quality)
- ✅ Faster computation (no user comparison needed)
- ✅ Works well for new/unpopular posts
- ✅ Transparent (user sees why matched)

**Limitations:**
- ❌ Misses social signals
- ❌ Can promote unpopular content if it matches interests
- ❌ Doesn't learn from user behavior

### Events Use Collaborative + Content (Balanced)

**Advantages:**
- ✅ Leverages **what similar users do**
- ✅ Strong social proof (shared behavior from similar users)
- ✅ Discovers events you didn't know about
- ✅ Adaptively learns engagement patterns

**Limitations:**
- ⚠️ Needs engagement data to work effectively
- ⚠️ New events with no engagement get lower scores
- ⚠️ Slower (requires user similarity calculation)

---

## Real Example

### Setup

**User:** cheesecake0101  
**Interests:** dance, theatre, drama  
**Following:** 25 users  
**Organizations:** UMAK Siglahi, CAST  

**Event:** "SIGLAHI: UMAK Dance Festival 2026"
- Organization: UMAK Siglahi
- Tags: `folk-dance`, `dance`, `theatre`
- Registrations (last 30 days): 28
- Interested (last 30 days): 35
- Date: April 15, 2026 (upcoming)

### Scoring Process

#### Step 1: Organization Base Score

```
UMAK Siglahi maps to:
  - Primary Interest: cultural
  - Secondary Interests: performance

User has interests:
  - dance, theatre, drama

Check matches:
  - Primary "cultural" matches? 
    → "dance" is cultural activity → 0.6 points
  - Secondary interests match?
    → "theatre" and "performance" overlap → 0.4 points

Organization Base Score = 0.6 + 0.4 = 1.0 (perfect!)
Contribution to final = 1.0 × 0.4 = 0.40
```

#### Step 2: User Similarity Score

```
Found 9 similar users who:
- Like dance, theatre, or cultural activities
- Follow or are in same organizations

Similarity scores:
  User 1: 0.72
  User 2: 0.65
  User 3: 0.78
  User 4: 0.61
  User 5: 0.71
  User 6: 0.68
  User 7: 0.69
  User 8: 0.74
  User 9: 0.63

Average User Similarity = 0.69
Contribution to final = 0.69 × 0.2 = 0.138
```

#### Step 3: Time-Weighted Engagement

```
Similar users' engagement with UMAK Siglahi:

Recent events:
  - 3 days ago: 28 registered, 35 interested
    Score = (28×0.7 + 35×0.3) × e^(-3/30) 
           = 29.5 × 0.905 = 26.7
  
  - 15 days ago: 22 registered, 28 interested
    Score = (22×0.7 + 28×0.3) × e^(-15/30)
           = 23.8 × 0.606 = 14.4
  
  - 28 days ago: 18 registered, 20 interested
    Score = (18×0.7 + 20×0.3) × e^(-28/30)
           = 18 × 0.341 = 6.1

Normalized Time-Weighted Engagement = 0.78
Contribution to final = 0.78 × 0.4 = 0.312
```

#### Step 4: Interest Matching (Bonus)

```
Event tags: folk-dance, dance, theatre
User interests: dance, theatre, drama

Matches found: 3/4 tags match
Interest match score: 0.85
Applied as multiplier to final score
```

#### Step 5: Calculate Final Score

```
Base calculation:
  Org Base Score contribution:           0.40
  User Similarity contribution:          0.138
  Time-Weighted Engagement contribution: 0.312
  ────────────────────────────────────────
  Base Final Score:                      0.85

Apply interest match multiplier:
  0.85 × 0.85 (interest match) = 0.72

Apply engagement boost (user hasn't registered yet):
  0.72 (no registered boost applied)

FINAL SCORE = 0.72 ✅ EXCELLENT - TOP RECOMMENDATION!
```

---

## Summary

The hybrid recommendation system intelligently combines:

1. **Content-Based Filtering** for posts
   - Analyzes what the post contains
   - Matches user interests directly
   - Fast and transparent

2. **Collaborative Filtering** for events
   - Analyzes what similar users do
   - Social proof and engagement signals
   - Discovers new opportunities

This hybrid approach maximizes recommendation quality across different content types while maintaining computational efficiency and user satisfaction.

---

**Document Version:** 1.0  
**Last Updated:** March 22, 2026  
**System:** HeronProto Recommendation Engine v1.0
