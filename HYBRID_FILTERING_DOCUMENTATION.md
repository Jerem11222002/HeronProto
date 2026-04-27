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
        ├─→ FOR POSTS (Accuracy Testing Mode)
        │    └─→ Content-Based Filtering
        │         • 75% Explicit Match (tag/keyword matching - PRIMARY)
        │         • 13% Popularity (engagement)
        │         • 12% Recency (how recent)
        │         • 2% Trending Score (engagement velocity)
        │         • 3% Past Engagement (saved/liked/shared history)
        │
        ├─→ FOR EVENTS (Production Mode)
        │    └─→ Collaborative + Content
        │         • 40% Organization Engagement
        │         • 40% Time-Weighted User Behavior
        │         • 20% User Similarity Score
        │         • + Interest Match (bonus)
        │         • + Past Event Engagement (multiplier)
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

The system prioritizes **what the post says** over social signals, with optimization for **accuracy testing** and interest matching quality.

| Factor | Weight | What It Does | Example |
|--------|--------|-------------|---------|
| **Explicit Interest Match** | 75% | Direct tag/keyword matching with user interests (PRIMARY FOCUS) | "dance" tag matches user's "dance" interest → High score |
| **Popularity** | 13% | Engagement (likes, views, comments, shares) | Post with 3,000 views and 50 likes → Boosts score |
| **Recency** | 12% | How recent the post is | Posts from today rank higher than 1-month-old ones |
| **Trending Score** | 2% | Items gaining engagement quickly | Post with rising likes/views ratio → Gets small boost |
| **Past Engagement** | 3% | If you saved/liked/shared this exact post | Saved content gets 4-8% boost (conservative) |
| ~~Implicit Preferences~~ | ~~5%~~ | ~~Removed for accuracy~~ | ~~Disabled in current version~~ |
| ~~Following Boost~~ | ~~+5%~~ | ~~Removed for accuracy~~ | ~~Disabled in current version~~ |

**Note:** Current implementation emphasizes **interest matching accuracy** over social signals. Following relationships and implicit preferences are deprioritized.

#### Example Calculation for "folkdance#ph" Post

```
Component               Score    Weight    Contribution
─────────────────────────────────────────────────────
Explicit Interest Match  0.85 ×   0.75  =  0.638
Popularity Score         0.90 ×   0.13  =  0.117
Recency Score            0.75 ×   0.12  =  0.090
Trending Score           0.80 ×   0.02  =  0.016
Past Engagement          0.60 ×   0.03  =  0.018
─────────────────────────────────────────────────────
                                 TOTAL  =  0.879 ✓ EXCELLENT
```

**Quality Caps Applied:**
- Explicit match ≥ 0.15: Score can reach 1.0
- Explicit match < 0.15: Score capped at 0.30 (low priority)
- No explicit match: Score capped at 0.10 (filtered out)

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

### Scoring Process (PRIMARY SIGNAL)
   - Direct match: 1.0 points
   - Partial match: 0.5 points
   - No match: 0.0 points
   - Multiple matches: averaged

3. **Calculate Popularity Score** (normalized 0-1)
   - Views: 40% weight
   - Likes: 30% weight
   - Comments: 20% weight
   - Shares: 10% weight

4. **Calculate Recency Score**
   - Posted today: 1.0
   - Posted 7 days ago: 0.85
   - Posted 30 days ago: 0.5
   - Posted 90+ days ago: 0.1

5. **Calculate Trending Score**
   - Detect items with rising engagement (views/likes ratio)
   - Recent posts with high engagement velocity get small boost

6. **Combine Scores with Weights**
   ```
   Final Score = (explicit × 0.75) + (popularity × 0.13) + 
                 (recency × 0.12) + (trending × 0.02) + 
                 (engagementHistory × 0.03)
   ```

7. **Apply Quality Caps** (Accuracy Focus)
   ```
   IF explicit match = 0:
       Final Score = MIN(score, 0.10)  // Effectively filtered out
   ELSE IF explicit match < 0.15:
       Final Score = MIN(score, 0.30)  // Low priority
   ELSE:
       Score reaches full 0.0-1.0 range
   ```

8. **Apply Conservative Past Engagement Boosts**
   - Previously saved: ×1.04
   - Previously liked: ×1.06
   - Previously shared: ×1.08
   - NOTE: Boosts only apply if explicit match > 0

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

### Posts Use Content-Based (75% Interest Weight) - Accuracy Optimized

**Current Focus:** Accuracy testing and interest matching quality

**Advantages:**
- ✅ **High accuracy** - Explicit interest matching is primary signal (75%)
- ✅ Focus on **what the post says** (tags, content quality)
- ✅ Transparent and predictable recommendations
- ✅ Works well for measurable interest alignment
- ✅ Prevents irrelevant content from being boosted by popularity alone

**Tradeoffs:**
- ⚠️ Reduced diversity (deprioritizes popularity/engagement)
- ⚠️ Ignores social signals (following relationships disabled)
- ⚠️ May miss trending content that doesn't match interests
- ⚠️ Implicit learning disabled for testing consistency

**Design Note:** Following relationships and implicit preferences are intentionally deprioritized to maintain accuracy and reproducibility during testing phases.

### Events Use Collaborative + Content (Balanced) - Standard Approach

**Current Focus:** Balanced recommendation quality

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

**Post:** "folk-dance techniques and trends"
- Tags: `folk-dance`, `dance`, `theatre`
- Recency: Posted 5 days ago
- Engagement: 45 views, 8 likes, 2 comments, 1 share
- User relationship: Not from followed account
- User history: User previously saved similar dance posts

### Scoring Process

#### Step 1: Calculate Explicit Interest Match (PRIMARY)

```
Post tags: folk-dance, dance, theatre
User interests: dance, theatre, drama

Matches found: 3 tags match directly
Match scoring: 1.0 (direct match on 2/3 main interests)
Explicit Interest Score = 1.0 ✓
```

#### Step 2: Calculate Popularity Score

```
Views:     45 × 0.4 = 18
Likes:     8 × 0.3 = 2.4
Comments:  2 × 0.2 = 0.4
Shares:    1 × 0.1 = 0.1
          ─────────────
Raw score = 20.9
Normalized (scale to 0-1 on content type distribution) = 0.68
Popularity Score = 0.68
```

#### Step 3: Calculate Recency Score

```
Days ago: 5 days
Decay formula: Applied
Recency Score = 0.85
```

#### Step 4: Calculate Trending Score

```
Recent engagement velocity: Moderate (not trending rapidly)
Trending Score = 0.40 (low trending indicator)
```

#### Step 5: Check Past Engagement

```
User previously saved similar posts: Yes
Engagement History Score = 0.8 (indicates interest pattern)
```

#### Step 6: Calculate Final Score

```
Base Calculation:
  Explicit × 0.75  =  1.0 × 0.75  = 0.750
  Popularity × 0.13 = 0.68 × 0.13 = 0.088
  Recency × 0.12    = 0.85 × 0.12 = 0.102
  Trending × 0.02   = 0.40 × 0.02 = 0.008
  Past Engagement × 0.03 = 0.8 × 0.03 = 0.024
                                   ─────────
Base Score = 0.972

Apply Past Engagement Boost (saved content):
0.972 × 1.04 = 1.0 (capped at max)

Check Quality Caps:
  Explicit = 1.0 ✓ No caps applied
  
FINAL SCORE = 1.0 ✅ TOP RECOMMENDATION!
```

### Why This Score?

1. **Strong explicit match** (100%) - All tags align with user interests → Gets 75% weight
2. **Recent post** (5 days) - Fresh content is valued → 12% boost
3. **Good engagement** for post type → 13% popularity boost
4. **User history confirms** interest → 3% engagement history boost
5. **Accuracy is prioritized** - This is a safe, reliable recommendation
6. **Social signals ignored** - Following status doesn't matter (accuracy focus)

---

## Summary

The hybrid recommendation system intelligently combines:

1. **Content-Based Filtering** for posts (75% interest weight)
   - PRIMARY FOCUS: Analyzes what the post contains
   - Optimized for accuracy and interest matching
   - Transparent and reproducible recommendations
   - Social signals (following, implicit) disabled for testing consistency

2. **Collaborative Filtering** for events (balanced 40/40/20 split)
   - Organization engagement signals (40%)
   - Time-weighted user behavior (40%)
   - User similarity matching (20%)
   - Social proof and engagement-based discovery

This hybrid approach prioritizes recommendation **accuracy** for posts while maintaining **balanced discovery** for events.

---

## Implementation Notes

**Current Configuration (April 2026):**
- **Post Scoring Phase:** Accuracy Testing Mode
  - Explicit interest matching emphasis: 75% weight
  - Following relationships: Disabled
  - Implicit learning: Disabled
  - Purpose: Validate interest-matching quality and reduce false positives

- **Event Scoring Phase:** Production Mode
  - Balanced collaborative + content approach
  - Organization popularity + user similarity signals
  - Time-weighted engagement decay (30-day window)
  - Purpose: Quality recommendations with social proof

**Quality Assurance:**
- Interest mismatch cap: 0.10 (posts with no matching interests capped at 10%)
- Weak match cap: 0.30 (posts with <15% explicit match capped at 30%)
- Ensures feed shows only relevant, high-quality matches

---

**Document Version:** 2.0  
**Last Updated:** April 23, 2026  
**System:** HeronProto Recommendation Engine v1.5  
**Configuration:** Accuracy Testing Phase
