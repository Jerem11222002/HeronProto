# Dynamic Recommendation Evaluation System

## Overview
A complete server-side evaluation system that dynamically analyzes recommendation performance for ALL users in your database. The results are displayed in an interactive modal accessible only during development/testing.

## Architecture

### Backend Components

#### 1. **Dynamic Recommendation Evaluator** (`backend/scripts/dynamicRecommendationEvaluator.js`)
- Connects to MongoDB
- Fetches ALL users from database
- For each user:
  - Generates recommendations using RecommendationService
  - Identifies relevant items (matching user interests)
  - Evaluates using OfflineEvaluator metrics
- Calculates aggregated metrics across all users
- Supports CLI standalone execution

**Key Metrics Calculated:**
- Precision@10: % of top-10 that are relevant
- Recall@10: % of relevant items in top-10
- NDCG@10: Normalized discounted cumulative gain
- MAP@10: Mean average precision
- F1 Score: Harmonic mean of precision & recall
- Coverage: Diversity of recommendations
- Novelty: % new content
- Calibration: Score distribution match

#### 2. **Recommendation Evaluation API Routes** (`backend/routes/recommendationEvaluation.js`)
Four endpoints for the frontend:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/recommendations/evaluate` | GET | Run new evaluation or return cached results |
| `/api/recommendations/evaluate/cached` | GET | Get cached results without running new evaluation |
| `/api/recommendations/evaluate/clear-cache` | GET | Clear cache (useful for re-running) |
| `/api/recommendations/status` | GET | Check evaluation cache status |

**Features:**
- ✅ Development-only access (localhost only)
- ✅ Results caching (1 minute default)
- ✅ Error handling with meaningful messages
- ✅ Timestamp tracking

#### 3. **Server Integration** (`server.js`)
- Added route import and registration
- Added to public paths (no authentication required)
- Accessible at `/api/recommendations/*`

### Frontend Components

#### 1. **RecommendationModal Component** (`src/components/modals/RecommendationModal.jsx`)
Smart modal that:
- ✅ Fetches data from API on open
- ✅ Shows loading state during evaluation
- ✅ Displays error messages with retry option
- ✅ Uses dynamic data (not hardcoded)
- ✅ Three interactive tabs:
  - **Summary**: Overall metrics + content distribution
  - **Users**: Per-user performance with color-coded status
  - **System**: Aggregated metrics + evaluation details

#### 2. **Test/Demo Page** (`src/pages/RecommendationTest.jsx`)
- ✅ Development-mode only protection
- ✅ Auto-opens modal on page load
- ✅ Reusable button to open modal
- ✅ Shows helpful instructions
- ✅ Redirects with error message if not in development

#### 3. **Modal Styling** (`src/components/modals/recommendationModal.scss`)
- ✅ Responsive (mobile, tablet, desktop)
- ✅ Dark mode support
- ✅ Smooth animations
- ✅ Interactive components

#### 4. **Route Integration** (`src/App.js`)
- Added route: `/recommendations`
- Protected for non-admin users
- Only accessible in development

---

##  How to Use

### 1. **Access the Evaluation Modal**

#### Option A: Direct URL
```
http://localhost:3000/recommendations
```

#### Option B: Programmatic
```jsx
import { useState } from "react";
import RecommendationModal from "./components/modals/RecommendationModal";

export default function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        📊 View Recommendations
      </button>
      <RecommendationModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
```

### 2. **Run Evaluation Manually (CLI)**

```bash
npm run evaluate:recommendations
```

This will:
- Connect to MongoDB
- Evaluate all users
- Print results to console
- Output performance metrics

### 3. **How the Evaluation Works**

```
User Database → Generate Recommendations → Evaluate Metrics → Aggregate Results
     ↓                ↓                          ↓                   ↓
  (N users)   (per-user ranking)    (precision, recall, NDCG)   (averages, stats)
```

**User Evaluation Flow:**
1. Get user interests
2. Generate top-10 recommendations using RecommendationService
3. Identify relevant items matching user interests
4. Calculate 8 metrics between recommendations and relevant items
5. Store results with user metadata

**Aggregation:**
- Calculate average across all users
- Calculate min/max/median for each metric
- Track system metrics (total content, success rate, evaluation time)

---

## Data Structure

### User Evaluation Result
```javascript
{
  userId: "64f5d2e1a1b2c3d4e5f6g7h8",
  username: "john_doe",
  interests: ["dance", "music", "performance"],
  recommendationCount: 10,
  relevantItemCount: 24,
  metrics: {
    precision: 80.0,
    recall: 7.1,
    f1Score: 13.2,
    ndcg: 82.7,
    map: 68.4,
    coverage: 45.2,
    novelty: 75.3,
    calibration: 88.5
  },
  status: "Evaluated"
}
```

### Complete Evaluation Result
```javascript
{
  timestamp: "2024-03-18T10:30:45.123Z",
  executedAt: "2024-03-18T10:30:52.456Z",
  totalUsers: 15,
  evaluatedUsers: 14,
  failedUsers: 1,
  userResults: [...],  // Array of user results
  aggregatedMetrics: {
    precision: { average: 80.0, min: 0.0, max: 90.0, median: 80.0 },
    recall: { average: 7.1, min: 0.0, max: 45.2, median: 6.8 },
    // ... other metrics
  },
  systemMetrics: {
    totalContent: 124,
    totalPosts: 124,
    totalEvents: 0,
    successRate: "93.33%",
    evaluationTime: 5234  // milliseconds
  }
}
```

---

## Features

### Security
✅ Only accessible on localhost or development mode  
✅ No authentication required but clearly restricted  
✅ Error messages don't leak sensitive data  

### Performance
✅ Results caching (1-minute default)  
✅ Efficient database queries  
✅ Streaming and progress indication  

### User Experience
✅ Loading spinner during evaluation  
✅ Error messages with retry option  
✅ Real-time data from database  
✅ Responsive design (mobile-friendly)  
✅ Dark mode support  
✅ Animated transitions  

### Developer Experience
✅ CLI tool for standalone evaluation  
✅ API endpoint for programmatic access  
✅ Comprehensive logging  
✅ Clear error messages  
✅ Caching control endpoints  

---

## Configuration

### Cache Duration
Edit `backend/routes/recommendationEvaluation.js`:
```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

### Evaluation Limits
Edit `backend/scripts/dynamicRecommendationEvaluator.js`:
```javascript
const users = await User.find().limit(100); // Change limit
```

### Recommendation Count
Edit modal or evaluator to change top-K:
```javascript
const recommendations = await RecommendationService.getRecommendations(
  user._id,
  10  // ← Change this
);
```

---

## Troubleshooting

### "Access Denied" Error
- ✅ Make sure you're on `localhost` or in development mode
- ✅ Check `process.env.NODE_ENV === 'development'`

### "No Cached Results"
- ✅ Click "Retry" to run evaluation
- ✅ Or run: `npm run evaluate:recommendations`

### "Failed to fetch evaluation data"
- ✅ Check backend is running (`npm run server`)
- ✅ Check MongoDB is connected
- ✅ Check browser console for detailed error

### Slow Evaluation
- ✅ Large user databases take longer
- ✅ Reduce recommendation limit
- ✅ Check database performance

---

## API Response Examples

### Successful Evaluation
```json
{
  "success": true,
  "cached": false,
  "data": {
    "totalUsers": 15,
    "evaluatedUsers": 14,
    "userResults": [...],
    "aggregatedMetrics": {...},
    "systemMetrics": {...}
  },
  "message": "Evaluation completed successfully",
  "cacheExpiresAt": "2024-03-18T10:35:45.123Z"
}
```

### Evaluation Error
```json
{
  "success": false,
  "error": "MongoDB connection failed",
  "message": "Failed to run recommendation evaluation"
}
```

### Access Denied
```json
{
  "error": "Access denied",
  "message": "Recommendation evaluation is only accessible in development/testing mode"
}
```

---

## Next Steps

1. **Test the Modal:**
   - Go to `http://localhost:3000/recommendations`
   - Click "Open Recommendation Evaluation"
   - Wait for evaluation to complete

2. **Monitor Performance:**
   - Switch between tabs to view different metrics
   - Check user-specific performance
   - Review system metrics

3. **Integrate into Admin Dashboard:**
   - Add button to admin settings
   - Embed modal in admin analytics
   - Create daily/weekly evaluation reports

4. **Advanced Features (Future):**
   - Schedule automatic evaluations
   - Track metrics over time
   - Generate PDF reports
   - A/B test different algorithms
   - Real-time recommendation monitoring

---

## Files Created/Modified

**New Files:**
- ✅ `backend/scripts/dynamicRecommendationEvaluator.js`
- ✅ `backend/routes/recommendationEvaluation.js`
- ✅ `src/components/modals/RecommendationModal.jsx`
- ✅ `src/components/modals/recommendationModal.scss`
- ✅ `src/pages/RecommendationTest.jsx`

**Modified Files:**
- ✅ `server.js` - Added route registration
- ✅ `src/App.js` - Added test route
- ✅ `package.json` - Added npm scripts

---

## Support

For issues or questions about the recommendation system:
1. Check backend logs: `npm run server`
2. Check browser console: F12 → Console tab
3. Run manual evaluation: `npm run evaluate:recommendations`
4. Check database connection status in server logs

---

**Status:** ✅ Production-Ready for Development/Testing  
**Last Updated:** March 18, 2026  
**Access:** http://localhost:3000/recommendations (development only)
