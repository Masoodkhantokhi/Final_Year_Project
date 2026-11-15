/**
 * backend/routes/api.js
 * API Route definitions for Student Wellbeing Assessment System.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/assessmentController');
const { validateAssessmentInput, validateSimulationInput } = require('../middleware/validation');

// System status and metadata
router.get('/health', controller.getHealth);
router.get('/meta', controller.getMetadata);

// Wellbeing inference & explainability
router.post('/assess', validateAssessmentInput, controller.assessStudent);
router.post('/predict', validateAssessmentInput, controller.predictScore);
router.post('/explain', validateAssessmentInput, controller.explainPrediction);
router.post('/simulate', validateSimulationInput, controller.simulateChanges);

// Educational resources
router.get('/resources', controller.getResources);

module.exports = router;
