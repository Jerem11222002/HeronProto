# Single User Recommendation System with ISO 25010 Metrics

## Overview

The recommendation system has been redesigned to show **personalized recommendations for the current user** with detailed explanations and **ISO 25010 Functional Suitability metrics** for evaluation.

## System Architecture

### Components

#### 1. **Backend Evaluator** (`backend/scripts/dynamicRecommendationEvaluator.js`)

Evaluates recommendations for a single authenticated user.

**Key Classes:**
- `SingleUserRecommendationEvaluator`: Orchestrates the evaluation process
- `ISO25010FunctionalSuitability`: Calculates ISO 25010 metrics

**Main Methods:**

```javascript
// Evaluate a user's recommendations
evaluateUser(userId)
  ├── connectDB()              // Connect to MongoDB
  ├── getUser(userId)          // Fetch user profile
  ├── getContent()             // Fetch all posts and events
  ├── generateRecommendationsWithExplanations()  // Get recommendations with reasons
  └── evaluateRecommendations() // Calculate ISO 25010 metrics
```

#### 2. **API Routes** (`backend/routes/recommendationEvaluation.js`)

Single endpoint for authenticated users:

```
POST /api/recommendations/evaluate
  - Requires authentication token
  - Gets current user from token
  - Returns recommendations with explanations and metrics
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "username": "john_doe",
      "email": "john@example.com",
      "interests": ["technology", "design"]
    },
    "recommendations": [
      {
        "_id": "post_id",
        "title": "Post title",
        "score": 8.5,
        ...
      }
    ],
    "explanations": [
      {
        "itemId": "post_id",
        "itemTitle": "Post title",
        "itemType": "post",
        "reasons": [
          {
            "type": "tag_match",
            "label": "Interest Tags",
            "value": "technology, innovation",
            "weight": "High"
          },
          {
            "type": "engagement",
            "label": "Popular Content",
            "value": "45 likes, 120 views",
            "weight": "Medium"
          }
        ],
        "relevanceScore": 8.5
      }
    ],
    "metrics": {
      "functional_suitability": {
        "completeness": 85.5,    // % of interests covered
        "correctness": 92.3,     // % of items actually relevant
        "appropriateness": 78.9  // % engaging/quality items
      },
      "total_recommended": 10
    },
    "timestamp": "2026-03-18T10:30:00Z"
  }
}
```

#### 3. **Frontend Modal** (`src/components/modals/RecommendationModal.jsx`)

Interactive React modal with 3 tabs:

**Tab 1: Recommendations**
- List of recommended items
- Why each item was recommended (matching reasons)
- Relevance score for each item
- Reason badges with colors and weights

**Tab 2: Performance Metrics (ISO 25010)**
- Functional Completeness: % of user interests covered
- Functional Correctness: % of recommended items that are relevant
- Functional Appropriateness: % of items with good engagement/quality
- Overall Functional Suitability Score

**Tab 3: Your Profile**
- User information
- User interests
- Number of recommendations generated
- Generation timestamp

### 4. **Test Page** (`src/pages/RecommendationTest.jsx`)

User-friendly page for accessing recommendations:
- Auto-opens the modal
- Shows what to expect
- Button to re-open modal

## ISO 25010 Functional Suitability Metrics

ISO/IEC 25010 defines product quality. The **Functional Suitability** category includes:

### 1. **Functional Completeness** (0-100%)
- **Definition**: Degree to which the set of functions covers all specified tasks
- **Calculation**: How many user interests are covered by recommendations
- **Formula**: (Covered Interests / Total Interests) × 100%
- **Example**: If user has 5 interests and 4 are covered in recommendations → 80%

### 2. **Functional Correctness** (0-100%)
- **Definition**: Degree to which the product provides correct results
- **Calculation**: How many recommended items actually match user interests
- **Formula**: (Correct Items / Total Recommendations) × 100%
- **Example**: Out of 10 recommendations, 8 match user interests → 80%

### 3. **Functional Appropriateness** (0-100%)
- **Definition**: Degree to which functions facilitate task accomplishment
- **Calculation**: Based on engagement signals (likes, views) and content quality
- **Formula**: Sum of (Engagement Score + Media Type Score + Description Score) / Items
- **Scoring**: 
  - Engagement (likes/views) → 30 points
  - Media content availability → 35 points
  - Good description → 35 points

### Overall Score
- **Formula**: (Completeness + Correctness + Appropriateness) / 3
- **Interpretation**:
  - ≥80%: ✅ Excellent fit for your needs
  - ≥60%: 👍 Good match for your interests
  - <60%: 📈 Room for improvement

## Recommendation Explanation Reasons

### Reason Types

1. **Tag Match** (tag_match) - High Weight
   - User interests directly match content tags
   - Example: User interested in "technology" → Post tagged "technology"

2. **Organization Match** (org_match) - High Weight
   - Content from organization user follows
   - Example: User interested in "Apple" → Apple Inc. post

3. **Popular Content** (engagement) - Medium Weight
   - High engagement (likes, views)
   - Makes content more visible/relevant

4. **Recently Posted** (recency) - Medium Weight
   - Content posted within 7 days
   - Fresh content more likely to be relevant

5. **Media Type** (media) - Low Weight
   - Content has image/video
   - Visual content more engaging

## Usage

### 1. Access the Page
Navigate to `/recommendations` to view recommendations.

### 2. For Developers (CLI Evaluation)

The evaluator can be run from CLI for testing:

```bash
# Evaluate a specific user
node backend/scripts/dynamicRecommendationEvaluator.js <userId>
```

**Output**: Complete evaluation result with all explanations and metrics

### 3. For Runtime (API)

The modal automatically fetches recommendations when opened:

```javascript
fetch('/api/recommendations/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
```

## Data Flow

```
User Opens /recommendations
         ↓
RecommendationTest Page
         ↓
User clicks "Open Recommendations"
         ↓
RecommendationModal Component
         ↓
useEffect Hook Triggers
         ↓
POST /api/recommendations/evaluate
         ↓
API: requiresAuth Token → Gets user._id
         ↓
SingleUserRecommendationEvaluator.evaluateUser(userId)
         ↓
1. Fetch user profile
2. Fetch all posts and events
3. Generate recommendations (RecommendationService)
4. Generate explanations for each
5. Calculate ISO 25010 metrics
         ↓
Return JSON response
         ↓
Modal Displays:
- Recommendations Tab: Items with explanations
- Metrics Tab: ISO 25010 scores
- Profile Tab: User info
```

## Key Differences from Previous System

| Aspect | Previous | Current |
|--------|----------|---------|
| **Scope** | All users in database | Current logged-in user only |
| **Purpose** | System performance evaluation | User personalization |
| **Metrics** | NDCG, Precision, Recall, F1, etc. | ISO 25010 Functional Suitability |
| **Output** | System-wide statistics | Per-user explanations & scores |
| **Access** | Development/localhost only | Authenticated users only |
| **Response Size** | Large (all user data) | Small (single user) |

## Files Modified/Created

### New Files
- `backend/scripts/dynamicRecommendationEvaluator.js` - Updated for single user
- No new route files (reused existing file)

### Modified Files
- `backend/routes/recommendationEvaluation.js` - Changed from GET all-users to POST single-user
- `src/components/modals/RecommendationModal.jsx` - Redesigned for single user
- `src/components/modals/recommendationModal.scss` - Updated styling
- `src/pages/RecommendationTest.jsx` - Simplified without dev-mode check

### Import Changes
- `server.js`: Already imports `recommendationEvaluationRouter` (no changes needed)
- `src/App.js`: Already has `/recommendations` route (no changes needed)

## Security Considerations

1. **Authentication Required**: POST endpoint requires valid JWT token
2. **User-Scoped**: Users can only see their own recommendations
3. **No Admin Access**: Regular users accessing `/recommendations` see their data only
4. **No Data Exposure**: Response only includes current user's data

## Performance Characteristics

- **Typical Response Time**: 500-2000ms (depends on database size)
- **Memory Usage**: Low (single user evaluation)
- **Database Queries**: 4 queries per request
  1. Get user by ID
  2. Get all posts
  3. Get all events
  4. RecommendationService internal queries

## Error Handling

The system handles:
- User not found (404)
- Missing authentication token (401)
- Database connection failures
- Missing user interests
- Empty recommendation results

All errors return appropriate HTTP status codes with descriptive messages.

## Future Enhancements

1. **Caching**: Cache per-user recommendations for 5-10 minutes
2. **Batch Processing**: Evaluate multiple users asynchronously
3. **Historical Tracking**: Store past recommendations for analytics
4. **A/B Testing**: Compare different recommendation algorithms
5. **Feedback Loop**: Track which recommendations user actually interacts with
6. **Personalization**: Use interaction history to refine future recommendations

## Testing the System

### 1. Unit Test
```bash
node backend/scripts/dynamicRecommendationEvaluator.js <userId>
```

### 2. Integration Test
1. Navigate to `/recommendations`
2. Open DevTools (F12)
3. Check Network tab for `/api/recommendations/evaluate` request
4. Verify response includes all 3 tabs of data
5. Check Console for any errors

### 3. Manual Validation
1. Verify recommendations match user interests
2. Check that explanation reasons are accurate
3. Validate ISO 25010 metrics are between 0-100%
4. Verify dark mode styling works
5. Test responsive design on mobile

## Troubleshooting

**Issue**: Modal shows "Error Loading Data"
- **Solution**: Check that user is authenticated and JWT token is valid

**Issue**: Empty recommendations list
- **Solution**: Verify user has interests configured and posts exist in database

**Issue**: ISO 25010 scores all showing 0%
- **Solution**: Ensure user interests match post/event tags exactly (case-insensitive)

**Issue**: "recommendations not found" in browser console
- **Solution**: Verify RecommendationService is correctly returning results
