/**
 * backend/services/mlService.js
 * Communicates with the Python ML microservice over HTTP.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

class MLService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        throw new Error(`ML service returned status ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      return {
        status: 'unavailable',
        error: err.message,
      };
    }
  }

  async getMetadata() {
    const response = await fetch(`${this.baseUrl}/meta`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ML metadata failed: ${errorText}`);
    }
    return await response.json();
  }

  async assess(inputs) {
    const response = await fetch(`${this.baseUrl}/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'ML assessment failed');
    }
    return data;
  }

  async predict(inputs) {
    const response = await fetch(`${this.baseUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'ML prediction failed');
    }
    return data;
  }

  async explain(inputs) {
    const response = await fetch(`${this.baseUrl}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'ML explanation failed');
    }
    return data;
  }

  async simulate(baseInputs, changes) {
    const response = await fetch(`${this.baseUrl}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base: baseInputs, changes }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'ML simulation failed');
    }
    return data;
  }

  async getResources() {
    const response = await fetch(`${this.baseUrl}/resources`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ML resources failed: ${errorText}`);
    }
    return await response.json();
  }
}

module.exports = new MLService(ML_SERVICE_URL);
