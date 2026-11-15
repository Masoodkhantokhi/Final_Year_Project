const assert = require('node:assert/strict');
const { startStack, sample } = require('./helpers');

async function main() {
  const stack = await startStack();
  let checks = 0;
  async function request(route, body, status = 200, base = stack.url) {
    const response = await fetch(base + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const json = await response.json();
    assert.equal(response.status, status, `${route}: ${JSON.stringify(json)}`);
    checks++;
    return json.data || json;
  }
  try {
    assert.equal((await request('/api/meta')).features.length, 7);
    const prediction = await request('/api/predict', sample);
    const result = await request('/api/assess', sample);
    assert.equal(prediction.score, result.score);
    assert.ok(result.score >= 0 && result.score <= 10);
    assert.equal(result.drivers.length, 7);
    assert.ok(Math.abs(result.base_value + result.drivers.reduce((sum, d) => sum + d.contribution, 0) - result.score) < 0.02, 'SHAP contributions must reconstruct the prediction');
    assert.equal(result.schedule.length, 7);
    assert.equal(new Set(result.ramp.map(row => row.Week)).size, 4);
    assert.ok(result.videos.length && result.courses.length);
    assert.equal((await request('/api/explain', sample)).drivers.length, 7);
    assert.ok((await request('/api/resources')).resources.length > 0);
    const unchanged = await request('/api/simulate', { base: sample, changes: {} });
    assert.equal(unchanged.score_diff, 0);
    const modified = { Sleep_Hours_Per_Night: 8, Avg_Daily_Usage_Hours: 3 };
    const simulation = await request('/api/simulate', { base: sample, changes: modified });
    assert.equal(simulation.simulated_score, (await request('/api/predict', { ...sample, ...modified })).score);
    const clamped = await request('/api/assess', { ...sample, Sleep_Hours_Per_Night: 99 });
    assert.equal(clamped.row.Sleep_Hours_Per_Night, 10);
    assert.equal(clamped.warnings.length, 1);
    for (const value of [null, true, [], {}, '', ' ', 'NaN', 'Infinity']) {
      await request('/api/predict', { ...sample, Study_Hours: value }, 400);
      await request('/api/simulate', { base: sample, changes: { Study_Hours: value } }, 400);
      await request('/predict', { ...sample, Study_Hours: value }, 400, stack.mlUrl);
      await request('/simulate', { base: sample, changes: { Study_Hours: value } }, 400, stack.mlUrl);
    }
    for (const body of [[], {}, { base: sample, changes: [] }, { base: sample, changes: { unknown: 1 } }, { base: sample, changes: { Academic_Level: 'invalid' } }]) {
      await request('/api/simulate', body, 400);
      await request('/simulate', body, 400, stack.mlUrl);
    }
    const balanced = await request('/api/assess', { ...sample, Sleep_Hours_Per_Night: 8, Study_Hours: 4, Avg_Daily_Usage_Hours: 2.5, Physical_Activity_Hours: 2, Daily_Unlocks: 95, Purpose_Of_Use: 'Education' });
    assert.ok(Array.isArray(balanced.ramp));
    await request('/api/missing', undefined, 404);
    const malformed = await fetch(stack.url + '/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(malformed.status, 400);
    console.log(`PASS: ${checks} API checks, prediction parity, SHAP reconstruction, plans, resources and invalid payloads.`);
  } finally { await stack.stop(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
