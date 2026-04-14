# HeronProto Workspace Structure Overview

## Project Architecture
**Tech Stack:** React + Express + MongoDB + Socket.io
- **Frontend:** React 18 (SPA in `/src`)
- **Backend:** Node.js/Express (in `/backend`)
- **Database:** MongoDB (Mongoose ORM)
- **Real-time:** Socket.io
- **Media:** Cloudinary
- **Port Configuration:** Frontend runs via Vite/build, Backend on port 5000

---

## 1. BACKEND STRUCTURE (`/backend`)

### 1.1 Core Directories

```
/backend
├── config/           # Configuration files
│   └── db.js        # MongoDB connection with retry logic
├── models/          # MongoDB Mongoose schemas
├── routes/          # Express API routes
├── controllers/     # Business logic controllers
├── services/        # Core service classes
├── scripts/         # Utility & evaluation scripts
├── Middleware/      # Express middleware (auth, logging, etc.)
├── socket/          # WebSocket handlers
└── utils/           # Helper utilities
```

### 1.2 Database Models

**Key Models in `/backend/models`:**

| Model | File | Purpose |
|-------|------|---------|
| **User** | `users.js` | User profiles with interests, organizations, auth |
| **Post** | `posts.js` | User-generated posts with media arrays |
| **Event** | `event.js` | Events organized by UMAK organizations |
| **EventRegistration** | `eventRegistration.js` | Event attendance tracking |
| **Comment** | `comment.js` | Post/event comments |
| **Message** | `message.js` | Direct messaging |
| **Notification** | `notification.js` | System notifications |
| **Activity** | `activity.js` | User activity tracking |

**User Interest Categories (from `users.js`):**
- Music, Dance, Theatre, Cultural-Arts, Visual-Arts, Performance
- Photography, Film, Fashion, Writing, Sculpture, Animation, Photogrammetry
- Plus sub-categories (vocal-arts, modern-music, technical-production, etc.)

**Valid Organizations (from `event.js`):**
- CAST, CULTURA, UMAK Jammers, UMAK Chorale, UMAK Dance Extreme
- UMAK Siglahi, UMAK Brass Band, UTPC

### 1.3 Service Layer (`/backend/services`)

| File | Purpose |
|------|---------|
| **recommendations.js** | Core recommendation engine with ML scoring |
| **metricsEvaluator.js** | ML metrics calculation (Cosine Similarity, RMSE, MAE, MRR) |
| **eventService.js** | Event-specific business logic |
| **sessionStore.js** | Session management |

**Key Functions in `recommendations.js`:**
- Weight-based organization matching (directMatch: 0.5, collaborativeMatch: 0.3, tagMatch: 0.2)
- Organization category mapping with primary/secondary interests
- Tag extraction and matching algorithms
- ML feature extraction from posts/events

**Key Functions in `metricsEvaluator.js`:**
- `cosineSimilarity()` - Vector similarity (0-1, handles NaN with fallback 0.5)
- `extractFeatures()` - Content feature extraction with weights
- `calculateMRR()` - Mean Reciprocal Rank
- `calculateRMSE()` - Root Mean Square Error
- `calculateMAE()` - Mean Absolute Error
- `calculateRelevanceScore()` - Combined similarity + engagement score
- `interestToVector()` - Convert interests to embedding vectors

---

## 2. RECOMMENDATION SYSTEM FILES

### 2.1 Backend Recommendation Pipeline

**Main Service: `backend/services/recommendations.js`**
- Calculates recommendation scores using 3-tier weighting system
- Handles organization-based filtering (VALID_ORGANIZATIONS)
- Integrates engagement metrics (likes, shares, comments, views)
- Supports both post and event recommendations

**Evaluation Engine: `backend/scripts/dynamicRecommendationEvaluator.js`**
- Single-user evaluator class: `SingleUserRecommendationEvaluator`
- **Key Methods:**
  - `evaluateUser(userId, limit)` - Main evaluation function
  - Generates recommendations with breakdowns
  - Calculates ISO 25010 Functional Suitability metrics:
    - **Functional Completeness** - % of user interests covered
    - **Functional Correctness** - % of recommendations actually relevant
    - **Functional Appropriateness** - Content quality based on engagement

**API Routes for Recommendations:**
- **`backend/routes/recommendationEvaluation.js`**
  - `POST /api/recommendations/evaluate` - Gets recommendations with explanations
  - Returns: user profile, recommendations array, explanations, ISO 25010 metrics

### 2.2 Metrics Routes

**File: `backend/routes/metricsRoutes.js`**
- `GET /api/metrics/performance` - Fetch metrics for recommendations
- `POST /api/metrics/performance` - Calculate metrics from user data
- Returns: `{ metrics, explanations, timestamp }`

---

## 3. FRONTEND STRUCTURE (`/src`)

### 3.1 Core Directories

```
/src
├── components/       # Reusable React components
│   ├── modals/      # Modal components (RecommendationModal, etc.)
│   ├── post/        # Post display components
│   ├── posts/       # Posts feed
│   ├── navbar/      # Navigation
│   ├── leftBar/     # Sidebar navigation
│   ├── rightBar/    # Right sidebar
│   ├── comments/    # Comment components
│   ├── chat/        # Chat interface
│   ├── admin/       # Admin dashboard
│   └── ...          # Other component folders
├── pages/           # Full page components
├── services/        # API service clients
├── context/         # React context (state management)
├── hooks/           # Custom React hooks
├── utils/           # Frontend utilities
├── config/          # Frontend config
└── styles/          # Global styles
```

### 3.2 Recommendation Modal (`src/components/modals/RecommendationModal.jsx`)

**Properties:**
```javascript
<RecommendationModal isOpen={boolean} onClose={() => void} />
```

**Features:**
- 4 main tabs:
  1. **Recommendations** - Shows top recommended posts/events with cards
  2. **Performance Metrics** - ISO 25010 functional suitability scores
  3. **Evaluation Data** - Raw metrics (Cosine Similarity, RMSE, MAE, MRR)
  4. **Debug Info** - System information (for dev mode)

**Data Flow:**
1. Fetch evaluation via `POST /api/recommendations/evaluate`
2. Display recommendations with matching reasons (tag, keyword, org, engagement)
3. Show ISO 25010 metrics as gauges/percentages
4. Render performance metrics with explanations

**Key State:**
- `activeTab` - Currently selected tab
- `loading` - Fetch state
- `data` - Recommendation data structure
- `error` - Error messages

**Styling:**
- `src/components/modals/recommendationModal.scss` - SCSS styles for modal

### 3.3 Frontend API Service (`src/services/recommendationService.js`)

**Key Functions:**
- `calculateEventScore()` - Score events by user interests
- `getRecommendedEvents()` - Fetch/rank events
- `getPersonalizedFeed()` - Combine recommendations into feed

**Integration Points:**
- Uses `process.env.REACT_APP_API_URL` (from `.env`)
- Calls `/api/recommendations/evaluate` endpoint
- Integrates with user interest context

---

## 4. API ENDPOINT PATTERNS

### Recommendation Endpoints

```
POST   /api/recommendations/evaluate
       ├─ Body: { limit?: number }  (default 20)
       ├─ Auth: Required (JWT token)
       └─ Response:
           {
             success: boolean,
             data: {
               user: { id, interests, followingOrganizations, ... },
               recommendations: [ 
                 { 
                   _id, title, desc, tags, organization,
                   similarity: number,
                   breakdown: {
                     components: {
                       tagMatches: [ { tag, weight } ],
                       keywordMatches: [ string ],
                       organizationMatch: { organization, weight },
                       engagement: { likes, shares, comments, registrations }
                     }
                   },
                   score: number
                 }
               ],
               explanations: [ string ],
               metrics: {
                 functional_suitability: {
                   completeness: number (0-100),
                   correctness: number (0-100),
                   appropriateness: number (0-100)
                 }
               }
             }
           }

GET    /api/metrics/performance
POST   /api/metrics/performance
       ├─ Auth: Required
       ├─ Body (POST): { recommendations: [ ... ] }
       └─ Response:
           {
             success: boolean,
             data: {
               metrics: {
                 cosine_similarity: number,
                 mrr: number,
                 rmse: number,
                 mae: number
               },
               explanations: { ... }
             }
           }
```

### Related User/Post Endpoints

```
GET    /api/users/:userId
GET    /api/users/:userId/following
GET    /api/posts?status=upcoming
GET    /api/events?status=upcoming
```

---

## 5. CURRENT EVALUATION METRICS

### ML Metrics Calculated

| Metric | Formula | Purpose | Range |
|--------|---------|---------|-------|
| **Cosine Similarity** | `dot(A,B) / (‖A‖·‖B‖)` | Content-user similarity | 0 - 1 |
| **MRR** | `Σ(1/rank_i) / count` | Rank of first relevant rec | 0 - 1 |
| **RMSE** | `√(Σ(pred-actual)²/n)` | Prediction error | 0 - ∞ |
| **MAE** | `Σ\|pred-actual\|/n` | Mean absolute error | 0 - ∞ |

### ISO 25010 Functional Suitability Metrics

| Metric | Calculation | Purpose | Range |
|--------|-------------|---------|-------|
| **Completeness** | `(covered_interests / total_interests) × 100` | % interests covered in recs | 0 - 100% |
| **Correctness** | `(relevant_items / total_items) × 100` | % meaningful recommendations | 0 - 100% |
| **Appropriateness** | Score based on engagement + media + description | Content quality for user goals | 0 - 100% |

### Feature Scoring Components

- **Tag Matches** - Weighted by order, normalized by count (max 1.0 per tag)
- **Organization Matches** - Strong signal (weight 0.95)
- **Engagement Metrics** - Likes (norm by 100), Shares (norm by 50), Comments (norm by 20)
- **Recency** - Exponential decay (½ per 30 days)
- **Location** - If applicable (weight 0.5)

---

## 6. KEY CONFIGURATION FILES

### Environment Variables (`.env` / `.env.example`)

```env
# Frontend
REACT_APP_API_URL=http://localhost:5000

# Backend MongoDB
MONGO_URI=mongodb+srv://...

# Email Service
RESEND_API_KEY=re_...

# Media/Cloud Storage
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...

# JWT Secrets
JWT_SECRET=...
ADMIN_JWT_SECRET=...

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5000

# DB Retry
DB_RETRY_DELAY=5000
```

### Entry Points

| File | Purpose |
|------|---------|
| `server.js` | Backend Express server with route registration |
| `src/index.js` | React DOM render entry point |
| `src/App.js` | Root React component |
| `package.json` | Dependencies (React, Express, Mongoose, etc.) |

---

## 7. UTILITY SCRIPTS (`/backend/scripts`)

**Key Diagnostic Tools:**
- `dynamicRecommendationEvaluator.js` - **⭐ Main evaluation engine**
- `metricsEvaluator.js` - Forwards to service version
- `dbDiagnostic.js` - Database health check
- `seedUserRecommendationCheck.js` - Seed test data for recommendations
- `tagQualityAudit.js` - Tag consistency audit
- `weightOptimizationTester.js` - A/B test weight parameters

**Data Migration:**
- `migrateEvents.js`, `migrateUserIds.js`, `migratePreferences.js`
- `fixEventData.js`, `fixPostTags.js`, `fixSharedPostField.js`

**Media Handling:**
- `backfillMediaFields.js` - Add media array to posts
- `generateSampleImages.js` - Create test media
- `checkCloudinaryUrls.js` - Verify image URLs

---

## 8. TESTING & DEBUGGING

**Root-level Test/Debug Files:**
- `testFeedLogic.js` - Feed endpoint test
- `testFeedsAPI.js` - API response verification
- `testModel.js` - Model validation
- `checkEvents.js` - Event data integrity
- `checkEventEngagement.js` - Engagement metrics
- `runEvaluation.js` - Single evaluation run

**Test Configuration:**
- `jest.config.js` - Unit test configuration
- `tests/` - Test suite directory

---

## 9. QUICK FILE REFERENCE

### Essential Files by Feature

**Recommendation System:**
- Backend: `backend/services/recommendations.js`, `backend/scripts/dynamicRecommendationEvaluator.js`
- Routes: `backend/routes/recommendationEvaluation.js`, `backend/routes/metricsRoutes.js`
- Frontend: `src/services/recommendationService.js`, `src/components/modals/RecommendationModal.jsx`

**Database Models:**
- Users: `backend/models/users.js`
- Posts: `backend/models/posts.js`
- Events: `backend/models/event.js`
- Registrations: `backend/models/eventRegistration.js`

**Styling:**
- Modal: `src/components/modals/recommendationModal.scss`
- Global: `src/style.scss`, `src/layout.scss`

**Configuration:**
- DB Connection: `backend/config/db.js`
- Environment: `.env`, `.env.example`
- Package Config: `package.json`, `jsconfig.json`

---

## 10. DATA FLOW DIAGRAM

```
User Opens RecommendationModal
            ↓
React Component: RecommendationModal.jsx
            ↓
fetch POST /api/recommendations/evaluate
            ↓
Backend Route: recommendationEvaluation.js
            ↓
SingleUserRecommendationEvaluator.evaluateUser(userId)
            ├─ Get User Interests/Preferences (from MongoDB)
            ├─ Fetch Top Posts & Events (from MongoDB)
            ├─ Rank by RecommendationService scores
            ├─ Calculate Metrics (metricsEvaluator.js)
            ├─ Calculate ISO 25010 metrics
            └─ Generate Breakdowns
            ↓
Response: { recommendations, metrics, explanations }
            ↓
Frontend Displays:
├─ Recommendations Tab (cards with reasons)
├─ Performance Tab (ISO 25010 gauges)
├─ Metrics Tab (Cosine Similarity, RMSE, MAE, MRR)
└─ Debug Info Tab (system data)
```

---

## 11. IMPORTANT NOTES

✅ **Existing Implementation:**
- Complete recommendation pipeline from backend to frontend
- ISO 25010 Functional Suitability metrics implemented
- ML metrics (Cosine Similarity, MRR, RMSE, MAE) calculated
- Tag-based matching with organization weighting
- Engagement metrics integration

⚠️ **Key Dependencies:**
- MongoDB connection required (MONGO_URI env var)
- JWT authentication for all recommendation endpoints
- Cloudinary for media/image URLs
- Node.js v16+, React 18+

🔍 **Debug Entry Points:**
- Browser console (Frontend errors)
- Terminal logs (Backend service logs)
- RecommendationModal Debug tab (metrics breakdown)
- Database audit scripts in `/backend/scripts`

---

## 12. NEXT STEPS (If Needed)

Potential areas for expansion:
1. **Vector Database Integration** - Replace RMSE/cosine with embeddings (Pinecone, Weaviate)
2. **Collaborative Filtering** - User-user similarity recommendations
3. **A/B Testing Framework** - Compare weight configurations
4. **Real-time Ranking** - WebSocket updates for trending posts
5. **Multi-language Support** - i18n for recommendations explanations
6. **Cache Layer** - Redis for frequently accessed recommendations
