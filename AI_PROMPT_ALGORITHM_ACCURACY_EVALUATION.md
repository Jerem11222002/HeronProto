# ALGORITHM ACCURACY EVALUATION PROMPT

## OBJECTIVE
Implement a comprehensive evaluation system to validate the accuracy and performance of the hybrid filtering recommendation algorithm, specifically measuring how well recommendations match user interests after recent database population increases.

## CURRENT SITUATION

### What Works
- ✅ Hybrid filtering recommendations are generating relevant posts for users
- ✅ Visible improvements after seeding users and posts
- ✅ Performance metrics tab exists in RecommendationModal
- ✅ Basic evaluation infrastructure in place (DynamicRecommendationEvaluator)

### The Problem
- ❌ Metrics show no improvement despite observed recommendation quality improvements
- ❌ Metrics accuracy needs validation
- ❌ Performance evaluation lacks statistical rigor
- ❌ Current evaluation may not accurately reflect actual algorithm performance

---

## REQUIREMENTS

### 1. **Test Metrics Accuracy**
Validate that existing metrics properly evaluate recommendation quality:

- Verify metric calculations against known test cases
- Compare metrics against ground truth data
- Identify and fix calculation errors in:
  - Precision/Recall calculations
  - NDCG (Normalized Discounted Cumulative Gain)
  - Coverage metrics
  - Calibration metrics

### 2. **Per-Session User Evaluation**
Test hybrid filtering performance for the currently logged-in user:

- Generate top-K recommendations (default: top-10)
- Identify relevant items based on:
  - User's interest tags/categories
  - User's engagement history (likes, comments, shares)
  - User's follow relationships
- Compare recommended items against relevant items
- Calculate performance metrics for that specific user
- Provide real-time feedback in the modal

### 3. **Implement New Evaluation Metrics**

#### **Cosine Similarity**
- **Purpose:** Measure similarity between user profile vector and recommended item vectors
- **Implementation:**
  - Convert user interests to vector representation
  - Convert each recommended item to vector representation
  - Calculate cosine similarity scores
  - Report average similarity across recommendations (0-1 scale, higher is better)
- **Interpretation:** How well recommendations align with user profile

#### **Root Mean Square Error (RMSE)**
- **Purpose:** Measure prediction accuracy of relevance scores
- **Implementation:**
  - For each recommended item, predict its relevance score
  - Compare predicted score against actual engagement (binary: relevant/not relevant)
  - Calculate RMSE of prediction errors
  - Report as decimal (lower is better)
- **Interpretation:** Average magnitude of prediction mistakes

#### **Mean Absolute Error (MAE)**
- **Purpose:** Average divergence between predicted and actual relevance
- **Implementation:**
  - For each recommendation, calculate |predicted_score - actual_relevance|
  - Average all absolute errors
  - Report as percentage (lower is better)
- **Interpretation:** Average prediction error without squaring (more interpretable than RMSE)

#### **Mean Reciprocal Rank (MRR)**
- **Purpose:** Measure ranking quality of first relevant item
- **Implementation:**
  - In top-K recommendations, find position of first relevant item
  - Calculate 1/rank for that position
  - Average across all users/sessions
  - Report as decimal (0-1 scale, higher is better)
- **Interpretation:** How quickly algorithm finds relevant content (rewards earlier relevance)

---

## IMPLEMENTATION DETAILS

### Architecture
Create a new evaluation module: `backend/scripts/enhancedAlgorithmEvaluator.js`

**Operations:**
1. **Single-User Session Evaluation:**
   - Input: Current user ID (from JWT/context)
   - Process: Generate recommendations → calculate all 4 new metrics
   - Output: Real-time metrics for current user

2. **Batch Evaluation (All Users):**
   - Query all users in database
   - For each user: generate recommendations + calculate metrics
   - Aggregate results (mean, median, std dev, min, max)
   - Cache results for 5-10 minutes

3. **Metric Validation:**
   - Create test dataset with known user-item relationships
   - Run evaluator on test dataset
   - Verify metrics against expected results
   - Log validation results

### API Endpoints Required

| Endpoint | Purpose | Params |
|----------|---------|--------|
| `GET /api/recommendations/evaluate/current-user` | Evaluate logged-in user's recommendations | `userId` (optional) |
| `GET /api/recommendations/evaluate/metrics` | Get detailed metric breakdowns | None |
| `GET /api/recommendations/evaluate/validation` | Run metric validation tests | `testSize` (default: 50) |
| `GET /api/recommendations/evaluate/comparison` | Compare old vs new metrics | None |

### Frontend Integration

**Update RecommendationModal with new tabs:**
- **Metrics Accuracy**: Validation status and any calculation errors
- **Current User Performance**: Real-time evaluation of logged-in user
- **New Metrics**: Display Cosine Similarity, RMSE, MAE, MRR with interpretations
- **Trend Analysis**: Show improvement over time (if previous evaluations exist)

---

## VALIDATION & TESTING

### Test Cases
1. **Known User-Item Pairs:**
   - Create synthetic user with 5 known relevant items
   - Generate recommendations
   - Verify all 4 metrics correctly identify relevant items

2. **Edge Cases:**
   - User with no engagement history → MRR = undefined, handle gracefully
   - User with all recommendations relevant → Metrics should be optimal
   - User with no relevant recommendations → Metrics should show poor performance

3. **Metric Consistency:**
   - Run same user evaluation twice → results should match exactly
   - Run evaluation with shuffled order → results should be consistent

### Success Criteria
- ✅ All 4 metrics calculate without errors
- ✅ Metrics improve when algorithm performs better (test with modified recommendations)
- ✅ Metrics decline when algorithm performs worse
- ✅ User sees real-time accurate metrics for their current session
- ✅ Validation tests pass (metrics correctly identify known relationships)
- ✅ Observed recommendation improvements correlate with metric improvements

---

## DELIVERABLES

### Code Files to Create/Modify
- `backend/scripts/enhancedAlgorithmEvaluator.js` (new)
- `backend/routes/recommendationEvaluation.js` (update with new endpoints)
- `src/components/modals/RecommendationModal.jsx` (add new metric displays)
- `src/components/modals/recommendationModal.scss` (style new metrics)

### Documentation
- Updated metric definitions in RecommendationModal
- Interpretation guides for each metric
- Test results and validation summary

### Performance Benchmarks
- Baseline metrics for current user population
- RMSE and MAE targets to achieve
- MRR target for ranking quality

---

## PRIORITY & PHASING

### Phase 1 (Immediate)
1. Implement Cosine Similarity calculation
2. Implement RMSE and MAE calculations
3. Add to existing modal

### Phase 2 (Next)
1. Implement Mean Reciprocal Rank
2. Add per-session user evaluation
3. Validate all metrics against test cases

### Phase 3 (Polish)
1. Trend tracking (show improvements over time)
2. Comparative analysis (vs. previous algorithm versions)
3. Performance optimization if needed

---

## SUCCESS METRICS FOR THIS WORK

- [ ] All 4 metrics calculate correctly and consistently
- [ ] Metrics show improvement after seeding (not decline)
- [ ] Current logged-in user sees their personalized evaluation
- [ ] Validation tests pass with known test data
- [ ] Documentation explains what each metric means (non-technical summary)
- [ ] Modal displays are responsive and clear
- [ ] No errors in browser console when running evaluation

---

## CONTEXT REFERENCES
- Modal implementation: `src/components/modals/RecommendationModal.jsx`
- Current evaluator: `backend/scripts/dynamicRecommendationEvaluator.js`
- Existing routes: `backend/routes/recommendationEvaluation.js`
- Hybrid filtering service: Check `backend/services/RecommendationService.js`

---

**Status:** Ready for Implementation  
**Target Completion:** Comprehensive evaluation with all 4 metrics  
**Testing Required:** Against seeded user data and synthetic test cases
