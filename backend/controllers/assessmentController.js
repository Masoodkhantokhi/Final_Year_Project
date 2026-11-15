/**
 * backend/controllers/assessmentController.js
 * Handles requests for wellbeing assessment, predictions, explanations, and simulations.
 */

const mlService = require('../services/mlService');

/**
 * Health check endpoint: verifies Node server and downstream Python ML service
 */
async function getHealth(req, res, next) {
  try {
    const mlHealth = await mlService.checkHealth();
    const isMlOk = mlHealth.status === 'ok';

    res.status(isMlOk ? 200 : 503).json({
      status: isMlOk ? 'healthy' : 'degraded',
      gateway: {
        status: 'ok',
        uptime: process.uptime(),
        node_version: process.version,
      },
      ml_service: mlHealth,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get system metadata: choices, valid ranges, friendly names, disclaimers
 */
async function getMetadata(req, res, next) {
  try {
    const meta = await mlService.getMetadata();
    res.json({
      success: true,
      data: meta,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Perform a full student assessment (prediction, SHAP drivers, advice, plan, resources)
 */
async function assessStudent(req, res, next) {
  try {
    const inputs = req.sanitizedInputs || req.body;
    const assessmentResult = await mlService.assess(inputs);
    res.json({
      success: true,
      data: assessmentResult,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Predict raw score and band only
 */
async function predictScore(req, res, next) {
  try {
    const inputs = req.sanitizedInputs || req.body;
    const prediction = await mlService.predict(inputs);
    res.json({
      success: true,
      data: prediction,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get SHAP explanation drivers
 */
async function explainPrediction(req, res, next) {
  try {
    const inputs = req.sanitizedInputs || req.body;
    const explanation = await mlService.explain(inputs);
    res.json({
      success: true,
      data: explanation,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Simulate what-if adjustments
 */
async function simulateChanges(req, res, next) {
  try {
    const { base, changes } = req.body;
    const simulation = await mlService.simulate(base, changes);
    res.json({
      success: true,
      data: simulation,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Fetch curated resources
 */
async function getResources(req, res, next) {
  try {
    const resources = await mlService.getResources();
    res.json({
      success: true,
      data: resources,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHealth,
  getMetadata,
  assessStudent,
  predictScore,
  explainPrediction,
  simulateChanges,
  getResources,
};
