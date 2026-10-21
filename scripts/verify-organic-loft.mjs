import assert from 'node:assert/strict';
import { createOrganicAPI } from '../src/organic-api.js';

const api = createOrganicAPI();
let seed = 0x22_10_26;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
const capsule = api.kapsul({ id: 'loft-capsule', baslangic: [-8, 2, -3], bitis: [12, 2, 5], yaricap: 4 });
const loft = api.kesitZinciri({
  id: 'loft-equivalent',
  noktalar: [[-8, 2, -3], [12, 2, 5]],
  kesitler: [{ rx: 4, ry: 4 }, { rx: 4, ry: 4 }],
});
let maxCapsuleDifference = 0;
for (let i = 0; i < 5000; i++) {
  const point = [-14 + random() * 32, -5 + random() * 14, -10 + random() * 22];
  maxCapsuleDifference = Math.max(maxCapsuleDifference, Math.abs(capsule.field(point) - loft.field(point)));
}
assert.ok(maxCapsuleDifference <= 0.05, `capsule field delta ${maxCapsuleDifference} exceeds 0.05 mm`);

const curved = api.kesitZinciri({
  id: 'loft-lipschitz',
  noktalar: [[-18, 0, 0], [-7, 0, 12], [8, 0, -4], [19, 0, 10]],
  kesitler: [{ rx: 4, ry: 5 }, { rx: 6, ry: 4 }, { rx: 5, ry: 7 }, { rx: 4, ry: 5 }],
});
let worstRatio = 0;
for (let i = 0; i < 10_000; i++) {
  const a = [-24 + random() * 48, -10 + random() * 20, -12 + random() * 34];
  const b = [-24 + random() * 48, -10 + random() * 20, -12 + random() * 34];
  const distance = Math.hypot(...a.map((v, axis) => v - b[axis]));
  if (distance < 1e-9) continue;
  const ratio = Math.abs(curved.field(a) - curved.field(b)) / distance;
  worstRatio = Math.max(worstRatio, ratio);
  assert.ok(ratio <= 1.02, `Lipschitz ratio ${ratio} exceeds 1.02`);
}

const base = process.env.KODLA3D_URL || 'http://127.0.0.1:8765';
const source = `return kesitZinciri({id:'s-egrisi',ad:'S eğrili loft',noktalar:[[-18,0,0],[-7,0,12],[8,0,-4],[19,0,10]],kesitler:[{rx:4,ry:5},{rx:6,ry:4},{rx:5,ry:7},{rx:4,ry:5}]});`;
const response = await fetch(`${base}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mode: 'organic', quality: 'normal', code: source }),
  signal: AbortSignal.timeout(60_000),
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.equal(result.ok, true, JSON.stringify(result));
assert.equal(result.components, 1, `S loft should be one component: ${JSON.stringify(result.mesh)}`);
assert.equal(result.mesh.boundaryEdges, 0);
assert.equal(result.mesh.nonManifoldEdges, 0);
console.log(JSON.stringify({ status: 'passed', maxCapsuleDifferenceMm: maxCapsuleDifference, lipschitzPairs: 10_000, worstLipschitzRatio: worstRatio, curvedComponents: result.components, triangles: result.mesh.triangles, workerMs: result.profile.workerTotalMs }, null, 2));
