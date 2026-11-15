const VALID_RANGES = {
  Avg_Daily_Usage_Hours: { min: 1, max: 9 },
  Daily_Unlocks: { min: 60, max: 280 },
  Study_Hours: { min: 0.3, max: 8.5 },
  Physical_Activity_Hours: { min: 0, max: 4.2 },
  Sleep_Hours_Per_Night: { min: 3.5, max: 10 },
};
const CHOICES = {
  Academic_Level: ['High School', 'Undergraduate', 'Graduate'],
  Purpose_Of_Use: ['Education', 'Entertainment', 'Networking', 'News'],
};
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validate(inputs, partial = false) {
  if (!isObject(inputs)) return ['Request body must be a JSON object.'];
  const errors = [];
  const fields = partial ? Object.keys(inputs) : [...Object.keys(VALID_RANGES), ...Object.keys(CHOICES)];
  for (const field of fields) {
    const value = inputs[field];
    if (Object.hasOwn(VALID_RANGES, field)) {
      if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) {
        errors.push(`Field '${field}' must be a finite number.`);
      }
    } else if (Object.hasOwn(CHOICES, field)) {
      if (!CHOICES[field].includes(value)) errors.push(`Field '${field}' must be one of: ${CHOICES[field].join(', ')}.`);
    } else {
      errors.push(`Unknown feature '${field}'.`);
    }
  }
  return errors;
}

function reject(res, errors) {
  return res.status(400).json({ success: false, error: 'Validation failed', details: errors });
}

function validateAssessmentInput(req, res, next) {
  const errors = validate(req.body);
  if (errors.length) return reject(res, errors);
  // The engine owns range clamping so its adjustment warnings reach the client.
  req.sanitizedInputs = Object.fromEntries(
    [...Object.keys(VALID_RANGES), ...Object.keys(CHOICES)].map(field => [field, req.body[field]])
  );
  next();
}

function validateSimulationInput(req, res, next) {
  if (!isObject(req.body)) return reject(res, ['Simulation requires base and changes objects.']);
  const errors = [...validate(req.body.base), ...validate(req.body.changes, true)];
  if (errors.length) return reject(res, errors);
  next();
}

module.exports = { VALID_RANGES, CHOICES, validateAssessmentInput, validateSimulationInput };
