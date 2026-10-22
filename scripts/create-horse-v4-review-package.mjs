import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageDir = path.join(root, 'outputs', 'at-kafasi-v4');
const base = process.env.KODLA3D_URL || 'http://127.0.0.1:8765';
await mkdir(packageDir, { recursive: true });

const examplesResponse = await fetch(`${base}/api/examples`);
assert.equal(examplesResponse.status, 200);
const examples = await examplesResponse.json();
const example = examples.find(item => item.name === 'organik-at-kafasi-v4');
assert.ok(example, 'V4 must be listed as a separate example');
const parameters = Object.fromEntries(example.parameterSchema.parameters.map(item => [item.id, item.default]));
const response = await fetch(`${base}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mode: 'organic', quality: 'normal', example: example.name, parameters, code: example.code }),
  signal: AbortSignal.timeout(60_000),
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.equal(result.ok, true, JSON.stringify(result));

const [stlResponse, viewsResponse] = await Promise.all([
  fetch(`${base}${result.files.stl}`), fetch(`${base}${result.files.visual}`),
]);
assert.equal(stlResponse.status, 200);
assert.equal(viewsResponse.status, 200);
const [stl, views] = await Promise.all([stlResponse.arrayBuffer(), viewsResponse.arrayBuffer()]);
const stlBuffer = Buffer.from(stl);
const triangleCount = stlBuffer.readUInt32LE(80);
let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let triangle = 0; triangle < triangleCount; triangle++) {
  const start = 84 + triangle * 50 + 12;
  for (let corner = 0; corner < 3; corner++) {
    const offset = start + corner * 12;
    const y = stlBuffer.readFloatLE(offset + 4), z = stlBuffer.readFloatLE(offset + 8);
    if (z < 82) continue;
    minY = Math.min(minY, y); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
}
const frontHeadRatio = (maxY - minY) / (maxZ - minZ);
const stlPath = path.join(packageDir, 'at-kafasi-v4.stl');
const viewsPath = path.join(packageDir, 'alti-gorunus.png');
await Promise.all([writeFile(stlPath, Buffer.from(stl)), writeFile(viewsPath, Buffer.from(views))]);

const referencePath = path.join(root, 'outputs', 'at-kafasi', 'referans.jpg');
const referenceAvailable = existsSync(referencePath);
const review = {
  example: example.name,
  quality: 'normal',
  sizeMm: result.size,
  volumeMm3: result.volume,
  components: result.components,
  mesh: { triangles: result.mesh.triangles, boundaryEdges: result.mesh.boundaryEdges, nonManifoldEdges: result.mesh.nonManifoldEdges },
  profile: { frontHeadRatio, workerMs: result.profile.workerTotalMs },
  views: { path: path.basename(viewsPath), width: result.visual.width, height: result.visual.height, cameras: result.visual.cameras },
  stl: { path: path.basename(stlPath), bytes: stl.byteLength },
  reference: { path: referencePath, available: referenceAvailable, overlay: null, iou: null, status: 'missing locally; no real photo overlay or IoU was generated' },
};
await Promise.all([
  writeFile(path.join(packageDir, 'inceleme.json'), `${JSON.stringify(review, null, 2)}\n`),
  writeFile(path.join(packageDir, 'iou-yineleme.json'), `${JSON.stringify({ status: 'skipped', reason: 'outputs/at-kafasi/referans.jpg is not present in this checkout', iterations: [] }, null, 2)}\n`),
  writeFile(path.join(packageDir, referenceAvailable ? 'REFERANS-VAR.md' : 'REFERANS-EKSIK.md'), [
    '# Referans fotoğrafı bu checkout’ta yok',
    '',
    'Kullanıcı doğruladı: `outputs/at-kafasi/referans.jpg` yalnız diğer bilgisayarda bulunuyor ve bu işlemde paylaşılmayacak.',
    'Bu nedenle gerçek referans bindirmesi oluşturulmadı ve fotoğrafa göre IoU hesaplanmadı. `iou-yineleme.json` bunu “skipped” olarak kaydeder.',
    'Paket içindeki `alti-gorunus.png` üretilen V4 modelini gösterir; sentetik/temsilî bir fotoğraf bindirmesi değildir.',
    '',
  ].join('\n')),
]);
console.log(JSON.stringify({ status: 'created', packageDir, viewsPath, stlPath, reviewPath: path.join(packageDir, 'inceleme.json'), referenceAvailable, workerMs: result.profile.workerTotalMs, sizeMm: result.size, volumeMm3: result.volume, triangles: result.mesh.triangles }, null, 2));
