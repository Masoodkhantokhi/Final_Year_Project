/**
 * frontend/js/api.js
 * Frontend HTTP client for Student Wellbeing REST API
 */

const API_BASE = '/api';

export const api = {
  /**
   * Check gateway and ML service health
   */
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch (err) {
      console.error('Health check failed:', err);
      return { status: 'error', error: err.message };
    }
  },

  /**
   * Fetch system metadata (ranges, choices, metrics)
   */
  async getMetadata() {
    try {
      const res = await fetch(`${API_BASE}/meta`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.error('Failed to load metadata:', err);
      throw err;
    }
  },

  /**
   * Run full student assessment
   */
  async assess(inputs) {
    try {
      const res = await fetch(`${API_BASE}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || (json.details ? json.details.join(', ') : 'Assessment failed'));
      }
      return json.data;
    } catch (err) {
      console.error('Assessment API error:', err);
      throw err;
    }
  },

  /**
   * Raw prediction
   */
  async predict(inputs) {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Prediction failed');
    return json.data;
  },

  /**
   * Explainability drivers
   */
  async explain(inputs) {
    const res = await fetch(`${API_BASE}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Explanation failed');
    return json.data;
  },

  /**
   * What-If simulation
   */
  async simulate(base, changes) {
    try {
      const res = await fetch(`${API_BASE}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base, changes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Simulation failed');
      return json.data;
    } catch (err) {
      console.error('Simulation API error:', err);
      throw err;
    }
  },

  /**
   * Educational resources
   */
  async getResources() {
    const res = await fetch(`${API_BASE}/resources`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Resources fetch failed');
    return json.data.resources;
  },
};
