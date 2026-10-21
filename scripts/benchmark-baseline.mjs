import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const models = ['kutu', 'aparat', 'at-kafasi'];
const runsPerModel = 3;
const packageVersions = Object.fromEntries(await Promise.all(['replicad', 'replicad-opencascadejs', 'three', 'vite'].map(async name => [name, JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version])));
const results = [];
for (const name of models) {
  const source = await readFile(path.join(root, 'models', `${name}.js`));
  const samples = [];
  for (let run = 0; run < runsPerModel; run++) {
    const start = performance.now();
    const response = await fetch('http://127.0.0.1:8765/api/build', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: source.toString('utf8') })
    });
    const wallMs = performance.now() - start;
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(`${name} #${run + 1}: ${result.error || response.status}`);
    const stlResponse = await fetch(`http://127.0.0.1:8765${result.files.stl}`);
    const stl = Buffer.from(await stlResponse.arrayBuffer());
    samples.push({
      run: run + 1,
      cacheState: run === 0 ? 'ilk ölçüm; uygulama sunucusu zaten çalışıyor' : 'yeni worker; olası OS dosya önbelleği sıcak',
      wallMs,
      profile: result.profile,
      geometry: { name: result.name, sizeMm: result.size, volumeMm3: result.volume, solids: result.solids, faces: result.faces, triangles: result.mesh.triangles, stlBytes: stl.byteLength, stlSha256: createHash('sha256').update(stl).digest('hex') }
    });
  }
  results.push({ name, sourceSha256: createHash('sha256').update(source).digest('hex'), samples });
}
const report = {
  generatedAt: new Date().toISOString(),
  machine: { platform: process.platform, release: os.release(), arch: process.arch, cpuModel: os.cpus()[0]?.model, logicalCpuCount: os.cpus().length, totalMemoryBytes: os.totalmem(), availableMemoryBytes: os.freemem() },
  runtime: { node: process.version, packages: packageVersions, server: 'http://127.0.0.1:8765/api/build; one fresh child worker per request' },
  repeatsPerModel: runsPerModel,
  method: 'Every request launches a fresh WASM worker; the server is already running, so this is not a cold application startup test. Later samples may benefit from OS filesystem cache. Wall time includes HTTP and response. Worker RSS is sampled every 20ms and can miss short peaks. STL meshing/write remain one Replicad blobSTL call. STEP round-trip is not timed by this harness.',
  results
};
const output = path.join(root, 'docs', 'baseline-measurements.json');
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, models: results.map(x => ({ name: x.name, samples: x.samples.map(s => ({ wallMs: Math.round(s.wallMs), workerTotalMs: Math.round(s.profile.workerTotalMs), peakRssBytes: s.profile.peakRssBytes, triangles: s.geometry.triangles, stlBytes: s.geometry.stlBytes })) })) }, null, 2));

