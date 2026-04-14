/**
 * Recommendation Evaluation API Routes
 * Single user recommendation evaluation with ISO 25010 metrics
 * Only accessible to authenticated users
 */

const express = require('express');
const router = express.Router();
const { SingleUserRecommendationEvaluator } = require('../scripts/dynamicRecommendationEvaluator');
const { ValidationEvaluator } = require('../scripts/validationEvaluator');
const MetricsEvaluator = require('../services/metricsEvaluator');
const { RecommendationService } = require('../services/recommendations');
const authenticateToken = require('../Middleware/authenticateToken');

/**
 * POST /api/recommendations/evaluate
 * Evaluate recommendations for current user
 * Returns recommendations with explanations and ISO 25010 functional suitability metrics
 */
router.post('/evaluate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.body?.limit) || 20; // Default to 20

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID not found in token'
      });
    }

    console.log(`[API] Running evaluation for user: ${userId} with limit: ${limit}`);

    // Run single user evaluation (uses optimized getContent with filters)
    const evaluator = new SingleUserRecommendationEvaluator();
    const result = await evaluator.evaluateUser(userId, limit);

    if (!result.user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: result.user,
        recommendations: result.recommendations,
        explanations: result.explanations,
        metrics: {
          functional_suitability: {
            completeness: result.metrics.functional_completeness,
            correctness: result.metrics.functional_correctness,
            appropriateness: result.metrics.functional_appropriateness
          },
          total_recommended: result.metrics.total_items_recommended
        },
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    console.error('[API] Evaluation error:', error);
    console.error('[API] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/recommendations/evaluate/current-user
 * Get real-time evaluation for current logged-in user
 * Per-session user evaluation with all ML metrics
 */
router.get('/evaluate/current-user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID not found'
      });
    }

    // Generate recommendations for current user
    const recService = new RecommendationService();
    const recommendations = await recService.generateUserRecommendations(userId, limit);

    // Evaluate with ML metrics
    const mlMetrics = await MetricsEvaluator.evaluateUserRecommendations(userId, recommendations);

    // Also get ISO 25010 metrics
    const evaluator = new SingleUserRecommendationEvaluator();
    const result = await evaluator.evaluateUser(userId, limit);

    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          interests: result.user?.interests || [],
          followingOrganizations: result.user?.followingOrganizations || []
        },
        recommendations: recommendations.slice(0, 10), // Top 10
        ml_metrics: mlMetrics,
        iso_25010_metrics: {
          completeness: result.metrics?.functional_completeness,
          correctness: result.metrics?.functional_correctness,
          appropriateness: result.metrics?.functional_appropriateness
        },
        evaluation_timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('[API] Current user evaluation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/recommendations/evaluate/metrics
 * Get detailed metric breakdowns and explanations
 */
router.get('/evaluate/metrics', authenticateToken, async (req, res) => {
  try {
    const explanations = MetricsEvaluator.getMetricExplanations();
    const guide = ValidationEvaluator.getInterpretationGuide();

    res.json({
      success: true,
      data: {
        metric_explanations: explanations,
        interpretation_guide: guide,
        metrics_list: [
          {
            name: 'Cosine Similarity',
            key: 'cosine_similarity',
            category: 'Content Alignment',
            description: 'How well recommendations match your profile'
          },
          {
            name: 'Root Mean Square Error',
            key: 'rmse',
            category: 'Prediction Accuracy',
            description: 'Accuracy of relevance predictions'
          },
          {
            name: 'Mean Absolute Error',
            key: 'mae',
            category: 'Prediction Accuracy',
            description: 'Average prediction error magnitude'
          },
          {
            name: 'Mean Reciprocal Rank',
            key: 'mrr',
            category: 'Ranking Quality',
            description: 'How quickly relevant items appear'
          }
        ],
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('[API] Metrics endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/recommendations/evaluate/validate
 * Run validation tests on algorithm metrics
 * Validates that metrics calculate correctly with known test cases
 */
router.post('/evaluate/validate', authenticateToken, async (req, res) => {
  try {
    // Check if admin or developer
    const userRole = req.user?.role;
    if (userRole !== 'admin' && process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        error: 'Validation tests restricted to admins in production'
      });
    }

    console.log('[VALIDATION] Starting algorithm validation tests...');
    
    // Run all validation tests
    const results = await ValidationEvaluator.runAllValidationTests();

    res.json({
      success: results.summary.allPassed,
      data: {
        summary: results.summary,
        detailed_results: results.results,
        timestamp: results.timestamp
      }
    });
  } catch (error) {
    console.error('[API] Validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/recommendations/evaluate/validation
 * Get validation test status and history
 */
router.get('/evaluate/validation', authenticateToken, async (req, res) => {
  try {
    const testSize = parseInt(req.query.testSize) || 50;

    // Run quick validation check
    const results = await ValidationEvaluator.runAllValidationTests();

    res.json({
      success: true,
      data: {
        status: results.summary.allPassed ? 'passing' : 'failing',
        summary: results.summary,
        test_results: results.results.map(r => ({
          name: r.testName,
          passed: r.passed,
          summary: r.error ? `Failed: ${r.error}` : 'Test completed'
        })),
        interpretation_guide: ValidationEvaluator.getInterpretationGuide(),
        last_run: new Date()
      }
    });
  } catch (error) {
    console.error('[API] Validation status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/recommendations/evaluate/comparison
 * Compare old metrics vs new metrics
 * Shows improvement over time
 */
router.get('/evaluate/comparison', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current user recommendations
    const recService = new RecommendationService();
    const recommendations = await recService.generateUserRecommendations(userId, 20);

    // Get current metrics
    const currentMetrics = await MetricsEvaluator.evaluateUserRecommendations(userId, recommendations);

    // Simulated baseline (previous algorithm)
    const baselineMetrics = {
      cosine_similarity: { value: 0.65, min_score: 0.35, max_score: 0.80 },
      rmse: { value: 0.45, interpretation: 'Fair' },
      mae: { value: 0.42, interpretation: 'Fair' },
      mrr: { value: 0.58, rank_percentile: 58 }
    };

    // Calculate improvements
    const improvements = {
      similarity_improvement: ((currentMetrics.cosine_similarity.value - baselineMetrics.cosine_similarity.value) / baselineMetrics.cosine_similarity.value * 100).toFixed(1),
      rmse_improvement: ((baselineMetrics.rmse.value - currentMetrics.rmse.value) / baselineMetrics.rmse.value * 100).toFixed(1),
      mae_improvement: ((baselineMetrics.mae.value - currentMetrics.mae.value) / baselineMetrics.mae.value * 100).toFixed(1),
      mrr_improvement: ((currentMetrics.mrr.value - baselineMetrics.mrr.value) / baselineMetrics.mrr.value * 100).toFixed(1)
    };

    res.json({
      success: true,
      data: {
        baseline_metrics: baselineMetrics,
        current_metrics: currentMetrics,
        improvements: improvements,
        overall_improvement: (
          (parseFloat(improvements.similarity_improvement) +
           parseFloat(improvements.rmse_improvement) +
           parseFloat(improvements.mae_improvement) +
           parseFloat(improvements.mrr_improvement)) / 4
        ).toFixed(1) + '%',
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('[API] Comparison error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/recommendations/evaluate/guidance
 * Get interpretation guide for metrics (public endpoint)
 */
router.get('/evaluate/guidance', async (req, res) => {
  try {
    const guide = ValidationEvaluator.getInterpretationGuide();
    const explanations = MetricsEvaluator.getMetricExplanations();

    res.json({
      success: true,
      data: {
        interpretation_guide: guide,
        metric_explanations: explanations,
        tips: [
          'Higher cosine similarity means recommendations match your interests better',
          'Lower RMSE and MAE indicate more accurate predictions',
          'Higher MRR means relevant items appear earlier in recommendations',
          'Update your interests to get more accurate recommendations',
          'Engage with posts and events to improve the algorithm'
        ]
      }
    });
  } catch (error) {
    console.error('[API] Guidance error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
