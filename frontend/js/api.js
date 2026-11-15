/** HTTP client for the dashboard's assessment and simulation flows. */
async function request(endpoint, body) {
  const response = await fetch(`/api${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.details?.join(' ') || json.error || 'Request failed');
  return json.data ?? json;
}

export const api = {
  async getHealth() {
    try { return await request('/health'); }
    catch (error) { return { status: 'error', error: error.message }; }
  },
  assess: inputs => request('/assess', inputs),
  simulate: (base, changes) => request('/simulate', { base, changes }),
};
