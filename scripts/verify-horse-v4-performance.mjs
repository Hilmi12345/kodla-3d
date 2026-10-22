import assert from 'node:assert/strict';

const base = process.env.KODLA3D_URL || 'http://127.0.0.1:8765';
// 2026-10-22: fotoğraf silüetli V4 sonrası yeni taban hacim.
const baselineVolumeMm3 = 552598.3497076674;
const list = await fetch(`${base}/api/examples`);
assert.equal(list.status, 200);
const examples = await list.json();
const exampleName = process.argv[2] || 'organik-at-kafasi-v4';
const example = examples.find(item => item.name === exampleName);
assert.ok(example, `${exampleName} must be listed as an example`);
const parameters = Object.fromEntries(example.parameterSchema.parameters.map(item => [item.id, item.default]));
const response = await fetch(`${base}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mode: 'organic', quality: 'normal', example: example.name, parameters, code: example.code }),
  signal: AbortSignal.timeout(60_000),
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.equal(result.ok, true, JSON.stringify(result));
const workerMs = result.profile.workerTotalMs;
const volumeDelta = exampleName === 'organik-at-kafasi-v4' ? Math.abs(result.volume - baselineVolumeMm3) / baselineVolumeMm3 : null;
if (exampleName === 'organik-at-kafasi-v4') {
  assert.ok(workerMs < 45_000, `V4 normal worker time ${workerMs.toFixed(1)} ms must stay under 45000 ms`);
  assert.ok(volumeDelta <= 0.001, `V4 volume changed by ${(volumeDelta * 100).toFixed(5)}%, maximum is 0.1%`);
}
console.log(JSON.stringify({
  status: 'passed', example: exampleName, quality: 'normal', workerMs: Number(workerMs.toFixed(1)),
  phasesMs: result.profile.phasesMs, volumeMm3: result.volume,
  ...(volumeDelta === null ? {} : { baselineVolumeMm3, volumeDeltaPercent: Number((volumeDelta * 100).toFixed(6)) }),
  sizeMm: result.size,
}, null, 2));
