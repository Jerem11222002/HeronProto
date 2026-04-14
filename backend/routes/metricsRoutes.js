/**
 * Performance Metrics API Routes
 * Provides recommendation system evaluation metrics
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../Middleware/authenticateToken');
const MetricsEvaluator = require('../services/metricsEvaluator');

/**
 * GET /api/metrics/performance
 * Get performance metrics for user's recommendations
 */
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { recommendations = '[]' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID not found'
      });
    }

    // Parse recommendations from query or body
    let recs = [];
    try {
      recs = typeof recommendations === 'string' ? JSON.parse(recommendations) : recommendations;
    } catch (e) {
      recs = [];
    }

    // Evaluate recommendations
    const metrics = await MetricsEvaluator.evaluateUserRecommendations(userId, recs);
    
    if (!metrics) {
      return res.status(500).json({
        success: false,
        error: 'Could not evaluate recommendations'
      });
    }

    // Get explanations
    const explanations = MetricsEvaluator.getMetricExplanations();

    res.json({
      success: true,
      data: {
        metrics,
        explanations,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('[MetricsAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/metrics/performance
 * Post recommendation data for evaluation
 */
router.post('/performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { recommendations = [] } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID not found'
      });
    }

    // Evaluate recommendations
    const metrics = await MetricsEvaluator.evaluateUserRecommendations(userId, recommendations);
    
    if (!metrics) {
      return res.status(500).json({
        success: false,
        error: 'Could not evaluate recommendations'
      });
    }

    // Get explanations
    const explanations = MetricsEvaluator.getMetricExplanations();

    res.json({
      success: true,
      data: {
        metrics,
        explanations,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('[MetricsAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
