import assert from 'node:assert/strict';
import { createOrganicAPI } from '../src/organic-api.js';
import { compareReference } from '../src/reference-compare.js';

const api = createOrganicAPI();
const outline = [[-40, -25], [40, -25], [40, 25], [-40, 25]];
const box = api.siluetHacmi({ id: 'silhouette-box', kontur: outline, kalinlik: outline.map(([x, z]) => [x, z, 10]), yuvarlama: 2 });
const size = [box.bounds.max[0] - box.bounds.min[0], box.bounds.max[1] - box.bounds.min[1], box.bounds.max[2] - box.bounds.min[2]];
assert.deepEqual(size.map(value => Number(value.toFixed(6))), [80, 20, 50]);
assert.ok(box.field([40, 10, 25]) < 0, 'rounding should cut the sharp profile/depth intersection');

const variable = api.siluetHacmi({
  id: 'silhouette-variable', kontur: outline,
  kalinlik: [[-40, -25, 6], [40, -25, 8], [40, 25, 10], [-40, 25, 7]], yuvarlama: 1,
});
let seed = 0x22_10_26;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
let worstRatio = 0;
for (let i = 0; i < 10_000; i++) {
  const a = [-50 + random() * 100, -14 + random() * 28, -32 + random() * 64];
  const b = [-50 + random() * 100, -14 + random() * 28, -32 + random() * 64];
  const distance = Math.hypot(...a.map((v, axis) => v - b[axis]));
  if (distance < 1e-9) continue;
  const ratio = Math.abs(variable.field(a) - variable.field(b)) / distance;
  worstRatio = Math.max(worstRatio, ratio);
  assert.ok(ratio <= 1.02, `Lipschitz ratio ${ratio} exceeds 1.02`);
}

const source = `return siluetHacmi({id:'silhouette-build',ad:'80×50×20 mm',kontur:[[-40,-25],[40,-25],[40,25],[-40,25]],kalinlik:[[-40,-25,10],[40,-25,10],[40,25,10],[-40,25,10]],yuvarlama:2});`;
const base = process.env.KODLA3D_URL || 'http://127.0.0.1:8765';
const response = await fetch(`${base}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mode: 'organic', quality: 'normal', code: source }),
  signal: AbortSignal.timeout(60_000),
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.equal(result.ok, true, JSON.stringify(result));
assert.equal(result.components, 1);
assert.equal(result.mesh.boundaryEdges, 0);
assert.equal(result.mesh.nonManifoldEdges, 0);
for (const [axis, expected] of [80, 20, 50].entries()) assert.ok(Math.abs(result.size[axis] - expected) <= 0.5, `size axis ${axis}: ${result.size[axis]} vs ${expected}`);
const stlResponse = await fetch(`${base}${result.files.stl}`);
assert.equal(stlResponse.status, 200);
const stl = Buffer.from(await stlResponse.arrayBuffer());
const comparison = compareReference(stl, { poligon: { width: 240, height: 160, noktalar: [[40, 30], [200, 30], [200, 130], [40, 130]] } }, 'right', { mmPerPx: 0.5 });
assert.ok(comparison.iou >= 0.98, `self contour IoU ${comparison.iou}`);
assert.ok(comparison.overlayPng.length > 100);
console.log(JSON.stringify({ status: 'passed', boxSizeMm: result.size, components: result.components, triangles: result.mesh.triangles, variableThicknessLipschitzPairs: 10_000, worstLipschitzRatio: worstRatio, ownContourIoU: comparison.iou, workerMs: result.profile.workerTotalMs }, null, 2));
