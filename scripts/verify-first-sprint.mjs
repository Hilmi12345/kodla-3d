import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.KODLA3D_PORT || 8765);
const base = `http://127.0.0.1:${port}`;
const outputRoot = process.env.KODLA3D_OUTPUT_ROOT ? path.resolve(process.env.KODLA3D_OUTPUT_ROOT) : path.join(root, 'outputs');
const outDir = path.join(outputRoot, 'organik-boyun');
await mkdir(outDir, { recursive: true });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function post(payload) {
  const response = await fetch(`${base}/api/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return { status: response.status, body: await response.json() };
}
async function checkSTL(bytes, expectedCount) {
  const count = bytes.readUInt32LE(80);
  if (bytes.length !== 84 + count * 50 || count !== expectedCount) throw new Error('Binary STL header/count/length do not match.');
  let nonFinite = 0, zeroArea = 0;
  for (let i = 0; i < count; i++) {
    const offset = 84 + i * 50;
    const v = [0, 1, 2].map(c => [0, 1, 2].map(a => bytes.readFloatLE(offset + 12 + c * 12 + a * 4)));
    if (v.flat().some(x => !Number.isFinite(x))) nonFinite++;
    const same = (a, b) => a.every((x, axis) => x === b[axis]);
    if (same(v[0], v[1]) || same(v[1], v[2]) || same(v[0], v[2])) zeroArea++;
  }
  if (nonFinite || zeroArea) throw new Error(`STL invalid coordinates=${nonFinite}; zero-area=${zeroArea}`);
  return { triangles: count, bytes: bytes.length, nonFiniteVertices: nonFinite, zeroAreaTriangles: zeroArea, sha256: sha256(bytes) };
}
const report = { generatedAt: new Date().toISOString(), server: base, status: 'passed', cad: [], organicQuality: [], organicOperations: {}, invalidInputs: [], sourceHash: null };
for (const name of ['kutu', 'aparat']) {
  const code = await readFile(path.join(root, 'models', `${name}.js`), 'utf8');
  const { status, body } = await post({ code }); // verify old client request still defaults to CAD
  if (status !== 200 || !body.ok || body.geometryType !== 'cad' || !body.files.step || !body.files.stl || body.unit !== 'mm') throw new Error(`${name} CAD contract regression: ${JSON.stringify(body)}`);
  const [stlResponse, stepResponse] = await Promise.all([fetch(base + body.files.stl), fetch(base + body.files.step)]);
  const stl = Buffer.from(await stlResponse.arrayBuffer());
  const step = Buffer.from(await stepResponse.arrayBuffer());
  const stlReport = await checkSTL(stl, body.mesh.triangles);
  if (!step.toString('ascii').includes('ISO-10303')) throw new Error(`${name} STEP header missing.`);
  if (body.sourceHash !== sha256(Buffer.from(code))) throw new Error(`${name} source hash mismatch.`);
  report.cad.push({ name, sizeMm: body.size, volumeMm3: body.volume, solids: body.solids, faces: body.faces, engine: body.engine, stl: stlReport, stepBytes: step.length, sourceHash: body.sourceHash, profile: body.profile });
}
const source = await readFile(path.join(root, 'models', 'organik-boyun.js'));
report.sourceHash = sha256(source);
for (const quality of ['taslak', 'normal', 'ince']) {
  const { status, body } = await post({ code: source.toString('utf8'), mode: 'organic', quality });
  if (status !== 200 || !body.ok || body.geometryType !== 'organic' || body.schemaVersion !== 1 || body.apiVersion !== 1 || body.unit !== 'mm' || body.files.step || !body.files.stl || !body.files.js) throw new Error(`${quality} organic contract failure: ${JSON.stringify(body)}`);
  if (body.sourceHash !== report.sourceHash) throw new Error(`${quality} source hash mismatch.`);
  const [stlResponse, jsResponse] = await Promise.all([fetch(base + body.files.stl), fetch(base + body.files.js)]);
  const stl = Buffer.from(await stlResponse.arrayBuffer());
  const returnedSource = Buffer.from(await jsResponse.arrayBuffer());
  if (!returnedSource.equals(source)) throw new Error(`${quality} returned source differs from the modeled source.`);
  const stlReport = await checkSTL(stl, body.mesh.triangles);
  if (body.mesh.boundaryEdges !== 0 || body.mesh.nonManifoldEdges !== 0 || body.mesh.removedDegenerate !== 0) throw new Error(`${quality} topology report has invalid edges or triangles.`);
  const file = `organik-boyun-${quality}.stl`;
  await writeFile(path.join(outDir, file), stl);
  report.organicQuality.push({ quality, edgeLengthMm: body.quality.edgeLengthMm, estimatedGridCells: body.quality.estimatedGridCells, maxGridCells: body.quality.maxGridCells, sizeMm: body.size, volumeMm3: body.volume, surfaceComponents: body.mesh.surfaceComponents, topology: { boundaryEdges: body.mesh.boundaryEdges, nonManifoldEdges: body.mesh.nonManifoldEdges }, stl: { ...stlReport, file }, peakRssBytes: body.profile.peakRssBytes, workerTotalMs: body.profile.workerTotalMs, sourceHash: body.sourceHash });
}
await writeFile(path.join(outDir, 'organik-boyun.js'), source);
report.qualityComparison = {
  taslakVsInceRelativeVolume: (report.organicQuality[0].volumeMm3 - report.organicQuality[2].volumeMm3) / report.organicQuality[2].volumeMm3,
  normalVsInceRelativeVolume: (report.organicQuality[1].volumeMm3 - report.organicQuality[2].volumeMm3) / report.organicQuality[2].volumeMm3
};
const subtraction = await post({ mode: 'organic', quality: 'normal', code: `const ana=kure({ad:'dis',merkez:[0,0,0],yaricap:10}); const kesici=kure({ad:'ic_oyuk',merkez:[0,0,0],yaricap:5}); return yumusakCikar({ad:'oyuklu_kure',ana,kesici,genislik:1});` });
const baseSphere = await post({ mode: 'organic', quality: 'normal', code: `return kure({yaricap:10});` });
if (subtraction.status !== 200 || !subtraction.body.ok || subtraction.body.volume >= baseSphere.body.volume || subtraction.body.mesh.boundaryEdges || subtraction.body.mesh.nonManifoldEdges) throw new Error('Smooth subtraction invariant failed.');
report.organicOperations.smoothSubtraction = { volumeWithCavityMm3: subtraction.body.volume, solidSphereVolumeMm3: baseSphere.body.volume, surfaceComponents: subtraction.body.mesh.surfaceComponents, boundaryEdges: subtraction.body.mesh.boundaryEdges, nonManifoldEdges: subtraction.body.mesh.nonManifoldEdges, note: 'Inner and outer shells of a hollow solid are separate surface components; this does not mean two disconnected printable pieces.' };
const separated = await post({ mode: 'organic', quality: 'normal', code: `const a=kure({merkez:[-6.5,0,0],yaricap:5}); const b=kure({merkez:[6.5,0,0],yaricap:5}); return yumusakBirlestir({parcalar:[a,b],genislik:2});` });
if (separated.status !== 200 || separated.body.mesh.surfaceComponents !== 2) throw new Error('Separated surfaces unexpectedly merged.');
report.organicOperations.separatedSurfaces = { components: separated.body.mesh.surfaceComponents, gapMm: 3, blendingWidthMm: 2 };
const badRadius = await post({ mode: 'organic', quality: 'normal', code: `return kure({yaricap:0});` });
if (badRadius.status !== 422 || badRadius.body.ok) throw new Error('Invalid radius did not return 422.');
report.invalidInputs.push({ case: 'zero sphere radius', status: badRadius.status, error: badRadius.body.error });
const overflow = await post({ mode: 'organic', quality: 'ince', code: `return elipsoid({merkez:[0,0,0],yariCaplar:[100,100,100]});` });
if (overflow.status !== 422 || !overflow.body.error.includes('bütçesi')) throw new Error('Grid budget limit did not return a clear 422.');
report.invalidInputs.push({ case: 'over 4 million estimated grid cells', status: overflow.status, error: overflow.body.error });
const invalidMode = await post({ mode: 'other', code: 'return kure();' });
const invalidQuality = await post({ mode: 'organic', quality: 'extreme', code: 'return kure();' });
if (invalidMode.status !== 400 || invalidQuality.status !== 400) throw new Error('Invalid mode/quality allowlist failed.');
report.invalidInputs.push({ case: 'unknown mode', status: invalidMode.status, error: invalidMode.body.error }, { case: 'unknown quality', status: invalidQuality.status, error: invalidQuality.body.error });
const recovery = await post({ mode: 'organic', quality: 'taslak', code: source.toString('utf8') });
if (recovery.status !== 200 || !recovery.body.ok) throw new Error('Build lock did not recover after a failed build.');
report.recoveryAfterError = { status: recovery.status, ok: recovery.body.ok };
await writeFile(path.join(outDir, 'DOGRULAMA.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outDir, 'README.md'), `# Organik boyun ve baş örneği\n\nKaynak: [organik-boyun.js](organik-boyun.js). Bu, motor/API örneğidir; at kafası taraması veya gerçekçi anatomi iddiası değildir.\n\n- Taslak: 1,4 mm level-set edgeLength.\n- Normal: 0,8 mm.\n- İnce: 0,55 mm.\n- STL'ler, ölçümler, topology kontrolleri, kaynak hash'i ve worker süreleri [DOGRULAMA.json](DOGRULAMA.json) içinde.\n- Organik üçgen mesh; STEP yok. Fiziksel baskı yapılmadı.\n\nKarşılaştırma önizlemesi: ` + '`' + `http://127.0.0.1:5174/experimental/manifold/preview.html` + '`' + ` (hard/smooth spike meshes).\n`);
console.log(JSON.stringify({ output: outDir, cad: report.cad.map(x => ({ name: x.name, sizeMm: x.sizeMm, triangles: x.stl.triangles, stepBytes: x.stepBytes })), organic: report.organicQuality.map(x => ({ quality: x.quality, edgeLengthMm: x.edgeLengthMm, triangles: x.stl.triangles, volumeMm3: x.volumeMm3, surfaceComponents: x.surfaceComponents, peakRssBytes: x.peakRssBytes })), qualityComparison: report.qualityComparison, subtraction: report.organicOperations.smoothSubtraction, separatedSurfaces: report.organicOperations.separatedSurfaces, invalidInputs: report.invalidInputs, recovery: report.recoveryAfterError }, null, 2));
