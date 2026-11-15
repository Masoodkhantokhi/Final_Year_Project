/** Bounded HTTP requests to the local Python ML service. */
const baseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

async function request(endpoint, body, timeout = 10000) {
  let response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (cause) {
    const error = new Error('ML service is unavailable. Check that the Python service is running.', { cause });
    error.status = cause.name === 'TimeoutError' ? 504 : 503;
    throw error;
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || data.message || 'ML request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

module.exports = {
  async checkHealth() {
    try { return await request('/health', undefined, 3000); }
    catch (error) { return { status: 'unavailable', error: error.message }; }
  },
  getMetadata: () => request('/meta'),
  assess: inputs => request('/assess', inputs),
  predict: inputs => request('/predict', inputs),
  explain: inputs => request('/explain', inputs),
  simulate: (base, changes) => request('/simulate', { base, changes }),
  getResources: () => request('/resources'),
};
