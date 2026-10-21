import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = process.env.KODLA3D_URL || 'http://127.0.0.1:8765';
const examplesResponse = await fetch(`${base}/api/examples`);
assert.equal(examplesResponse.status, 200);
const examples = await examplesResponse.json();
const example = examples.find(item => item.name === 'organik-at-kafasi-v4');
assert.ok(example, 'V4 must be listed as a separate example');
assert.equal(example.mode, 'organic');
const parameters = Object.fromEntries(example.parameterSchema.parameters.map(item => [item.id, item.default]));
const started = performance.now();
const response = await fetch(`${base}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mode: 'organic', quality: 'normal', example: example.name, parameters, code: example.code }),
  signal: AbortSignal.timeout(60_000),
});
const result = await response.json();
const wallMs = performance.now() - started;
assert.equal(response.status, 200, JSON.stringify(result));
assert.equal(result.ok, true, JSON.stringify(result));
assert.equal(result.meshReport.status, 'complete');
assert.equal(result.components, 1, `V4 should be a single component: ${JSON.stringify(result.mesh)}`);
assert.equal(result.meshReport.topology.connectedComponents.length, 1);
assert.equal(result.meshReport.topology.connectedComponents[0].closed, true);
assert.equal(result.mesh.boundaryEdges, 0);
assert.equal(result.mesh.nonManifoldEdges, 0);
assert.ok(Math.abs(result.size[2] - 160) <= 0.5, `height ${result.size[2]} mm`);
const stlResponse = await fetch(`${base}${result.files.stl}`);
assert.equal(stlResponse.status, 200);
const stl = Buffer.from(await stlResponse.arrayBuffer());
const triangleCount = stl.readUInt32LE(80);
let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let triangle = 0; triangle < triangleCount; triangle++) {
  const start = 84 + triangle * 50 + 12;
  for (let corner = 0; corner < 3; corner++) {
    const offset = start + corner * 12, y = stl.readFloatLE(offset + 4), z = stl.readFloatLE(offset + 8);
    if (z < 82) continue;
    minY = Math.min(minY, y); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
}
const frontHeadRatio = (maxY - minY) / (maxZ - minZ);
assert.ok(frontHeadRatio >= 0.35 && frontHeadRatio <= 0.45, `head front ratio ${frontHeadRatio}`);
const baseStats = { areaMm2: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
for (let triangle = 0; triangle < triangleCount; triangle++) {
  const start = 84 + triangle * 50 + 12;
  const vertices = [];
  for (let corner = 0; corner < 3; corner++) {
    const offset = start + corner * 12;
    vertices.push([stl.readFloatLE(offset), stl.readFloatLE(offset + 4), stl.readFloatLE(offset + 8)]);
  }
  if (!vertices.every(([, , z]) => z < 0.2)) continue;
  const [[ax, ay], [bx, by], [cx, cy]] = vertices;
  baseStats.areaMm2 += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
  for (const [x, y] of vertices) {
    baseStats.minX = Math.min(baseStats.minX, x); baseStats.maxX = Math.max(baseStats.maxX, x);
    baseStats.minY = Math.min(baseStats.minY, y); baseStats.maxY = Math.max(baseStats.maxY, y);
  }
}
const footprintMm2 = (baseStats.maxX - baseStats.minX) * (baseStats.maxY - baseStats.minY);
const baseCoverage = baseStats.areaMm2 / footprintMm2;
assert.ok(Number.isFinite(baseCoverage) && baseCoverage >= 0.8, `flat base coverage ${(baseCoverage * 100).toFixed(2)}% must be >=80% of its projected footprint`);
assert.ok(result.profile.workerTotalMs < 45_000, `normal worker time ${result.profile.workerTotalMs.toFixed(1)} ms must stay under 45000 ms`);
const referencePath = fileURLToPath(new URL('../outputs/at-kafasi/referans.jpg', import.meta.url));
const referenceStatus = existsSync(referencePath) ? 'photo present; IoU not part of this structural regression' : 'photo unavailable; IoU skipped';
const visualResponse = await fetch(`${base}${result.files.visual}`);
assert.equal(visualResponse.status, 200);
const visual = Buffer.from(await visualResponse.arrayBuffer());
assert.deepEqual([...visual.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
console.log(JSON.stringify({ status: 'passed', example: example.name, sizeMm: result.size, volumeMm3: result.volume, components: result.components, boundaryEdges: result.mesh.boundaryEdges, nonManifoldEdges: result.mesh.nonManifoldEdges, triangles: result.mesh.triangles, frontHeadRatio, baseAreaMm2: Number(baseStats.areaMm2.toFixed(2)), baseFootprintMm2: Number(footprintMm2.toFixed(2)), baseCoveragePercent: Number((baseCoverage * 100).toFixed(2)), workerMs: result.profile.workerTotalMs, phasesMs: result.profile.phasesMs, wallMs: Number(wallMs.toFixed(1)), sixViewsPngBytes: visual.length, reference: referenceStatus }, null, 2));
