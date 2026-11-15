/**
 * backend/middleware/validation.js
 * Input validation and sanitization for student wellbeing habits.
 */

const VALID_RANGES = {
  Avg_Daily_Usage_Hours: { min: 1.0, max: 9.0, label: 'Daily social-media time (hours)' },
  Daily_Unlocks: { min: 60, max: 280, label: 'Phone checks per day' },
  Study_Hours: { min: 0.3, max: 8.5, label: 'Study time (hours/day)' },
  Physical_Activity_Hours: { min: 0.0, max: 4.2, label: 'Physical activity (hours/day)' },
  Sleep_Hours_Per_Night: { min: 3.5, max: 10.0, label: 'Sleep duration (hours/night)' },
};

const CHOICES = {
  Academic_Level: ['High School', 'Undergraduate', 'Graduate'],
  Purpose_Of_Use: ['Education', 'Entertainment', 'Networking', 'News'],
};

/**
 * Validate assessment inputs
 */
function validateAssessmentInput(req, res, next) {
  const inputs = req.body;
  if (!inputs || typeof inputs !== 'object') {
    return res.status(400).json({ error: 'Invalid payload. Request body must be a JSON object.' });
  }

  const errors = [];
  const sanitized = {};

  // Validate numeric fields
  for (const [field, bounds] of Object.entries(VALID_RANGES)) {
    if (inputs[field] === undefined || inputs[field] === null || inputs[field] === '') {
      errors.push(`Field '${bounds.label}' (${field}) is required.`);
      continue;
    }

    const val = Number(inputs[field]);
    if (isNaN(val)) {
      errors.push(`Field '${bounds.label}' must be a valid number.`);
      continue;
    }

    // Clamp or flag out of bounds
    if (val < bounds.min || val > bounds.max) {
      // We clamp with a note/adjustment
      sanitized[field] = Math.min(Math.max(val, bounds.min), bounds.max);
    } else {
      sanitized[field] = val;
    }
  }

  // Validate categorical fields
  for (const [field, allowed] of Object.entries(CHOICES)) {
    if (!inputs[field]) {
      errors.push(`Field '${field}' is required.`);
      continue;
    }

    if (!allowed.includes(inputs[field])) {
      errors.push(`Field '${field}' must be one of: ${allowed.join(', ')}.`);
      continue;
    }

    sanitized[field] = inputs[field];
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }

  req.sanitizedInputs = sanitized;
  next();
}

/**
 * Validate simulation payload: base inputs + changes
 */
function validateSimulationInput(req, res, next) {
  const { base, changes } = req.body || {};
  if (!base || typeof base !== 'object') {
    return res.status(400).json({ error: 'Simulation requires a "base" object with current habits.' });
  }
  if (!changes || typeof changes !== 'object') {
    return res.status(400).json({ error: 'Simulation requires a "changes" object with habit adjustments.' });
  }

  // Ensure base has all required fields
  for (const field of Object.keys(VALID_RANGES)) {
    if (base[field] === undefined || isNaN(Number(base[field]))) {
      return res.status(400).json({ error: `Missing or invalid base field '${field}'.` });
    }
  }

  next();
}

module.exports = {
  VALID_RANGES,
  CHOICES,
  validateAssessmentInput,
  validateSimulationInput,
};
