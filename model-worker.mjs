import { readFile, writeFile } from 'node:fs/promises';
import { writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import initOpenCascade from 'replicad-opencascadejs';
import * as replicad from 'replicad';
import * as cadApi from './src/model-api.js';
import { createOrganicAPI } from './src/organic-api.js';
import { MODEL_SCHEMA_VERSION } from './src/api-schema.js';
import { analyzeBinaryStl } from './src/mesh-report.js';
import { renderSixViewsPng } from './src/mesh-views.js';

const folder = process.argv[2];
const mode = process.argv[3] || 'cad';
const qualityName = process.argv[4] || 'normal';
const jobId = process.argv[5] || null;
const progressPath = process.argv[6] || null;
const cadMeshQualityName = process.argv[7] || 'normal';
const MAX_OUTPUT_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_OUTPUT_BYTES = 250 * 1024 * 1024;
let reservedOutputBytes = 0;
const qualityProfiles = { taslak: 1.4, normal: 0.8, ince: 0.55 };
const cadMeshProfiles = { taslak: { tolerance: 0.2, angularTolerance: 0.2 }, normal: { tolerance: 0.08, angularTolerance: 0.1 }, ince: { tolerance: 0.02, angularTolerance: 0.05 } };
const cadMeshQuality = cadMeshProfiles[cadMeshQualityName] || cadMeshProfiles.normal;
const startedAt = process.hrtime.bigint();
const phases = {};
let activePhase = 'startup';
let phaseStartedAt = startedAt;
let peakRssBytes = process.memoryUsage().rss;
let peakHeapUsedBytes = process.memoryUsage().heapUsed;
const memorySampler = setInterval(() => {
  const memory = process.memoryUsage();
  peakRssBytes = Math.max(peakRssBytes, memory.rss);
  peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsed);
}, 20);
function markPhase(name) {
  const now = process.hrtime.bigint();
  phases[activePhase] = Number(now - phaseStartedAt) / 1e6;
  activePhase = name;
  phaseStartedAt = now;
  writeProgress();
}
function writeProgress(status = 'running') {
  if (!progressPath) return;
  try {
    const now = process.hrtime.bigint();
    const completedPhasesMs = { ...phases, [activePhase]: Number(now - phaseStartedAt) / 1e6 };
    const tempPath = `${progressPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify({ jobId, status, stage: activePhase, elapsedMs: Number(now - startedAt) / 1e6, phasesMs: completedPhasesMs }));
    renameSync(tempPath, progressPath);
  } catch {}
}
function validateSourceSyntax(source) {
  try { new Script(`function __kodla3dModel() {\n${source}\n}`, { filename: 'model-source.js' }); }
  catch (error) {
    const match = error.stack?.match(/model-source\.js:(\d+)(?::(\d+))?/);
    if (match) { error.sourceLine = Number(match[1]) - 1; if (match[2]) error.sourceColumn = Number(match[2]); }
    throw error;
  }
}
// API bounds are conservative (nested smooth-union padding compounds). Shrink them with a field scan
// so the sampling budget reflects the real shape. A sample counts when its field is within one step
// of the surface; a 1.25-step margin covers the ≤0.87-step gap to the nearest sample (1-Lipschitz
// field). Pass 1 is coarse over the declared box; pass 2 rescans only thin slabs at the faces of
// that result with a 3× finer step. Never grows past the declared bounds.
function scanOrganicBounds(field, box, step, slab = Infinity) {
  const extent = box.max.map((v, i) => v - box.min[i]);
  const counts = extent.map(length => Math.ceil(length / step) + 1);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < counts[0]; i++) for (let j = 0; j < counts[1]; j++) for (let k = 0; k < counts[2]; k++) {
    const p = [i, j, k].map((n, axis) => Math.min(box.max[axis], box.min[axis] + n * step));
    if (slab !== Infinity && p.every((v, axis) => v - box.min[axis] > slab && box.max[axis] - v > slab)) continue;
    if (!(field(p) > -step)) continue;
    for (let axis = 0; axis < 3; axis++) { if (p[axis] < min[axis]) min[axis] = p[axis]; if (p[axis] > max[axis]) max[axis] = p[axis]; }
  }
  if (!Number.isFinite(min[0])) return null;
  return { min: min.map((v, axis) => Math.max(box.min[axis], v - 1.25 * step)), max: max.map((v, axis) => Math.min(box.max[axis], v + 1.25 * step)) };
}
function tightOrganicBounds(field, bounds) {
  const step = Math.max(...bounds.max.map((v, i) => v - bounds.min[i])) / 60;
  if (!(step > 0) || !Number.isFinite(step)) return bounds;
  const coarse = scanOrganicBounds(field, bounds, step);
  if (!coarse) return bounds;
  // Extremes sit within 2.25 coarse steps of the coarse box faces.
  return scanOrganicBounds(field, coarse, step / 3, 2.5 * step) || coarse;
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function reserveOutput(name, bytes) {
  const size = typeof bytes === 'number' ? bytes : bytes?.byteLength;
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_OUTPUT_FILE_BYTES) throw new Error(`${name} çıktısı dosya sınırını aşıyor (en fazla ${Math.round(MAX_OUTPUT_FILE_BYTES / 1024 / 1024)} MiB).`);
  if (reservedOutputBytes + size > MAX_TOTAL_OUTPUT_BYTES) throw new Error(`Toplam çıktı sınırı aşılıyor (en fazla ${Math.round(MAX_TOTAL_OUTPUT_BYTES / 1024 / 1024)} MiB).`);
  reservedOutputBytes += size;
}
function temizSTL(bytes) {
  const input = Buffer.from(bytes);
  const count = input.readUInt32LE(80);
  if (input.length !== 84 + count * 50) throw new Error('STL üçgen tablosu tutarsız.');
  const output = Buffer.alloc(input.length);
  input.copy(output, 0, 0, 84);
  let kept = 0;
  for (let i = 0; i < count; i++) {
    const offset = 84 + i * 50;
    const vertices = [0, 1, 2].map(v => [0, 1, 2].map(a => input.readFloatLE(offset + 12 + v * 12 + a * 4)));
    const same = (a, b) => a.every((value, axis) => value === b[axis]);
    if (same(vertices[0], vertices[1]) || same(vertices[1], vertices[2]) || same(vertices[0], vertices[2])) continue;
    input.copy(output, 84 + kept * 50, offset, offset + 50);
    kept++;
  }
  output.writeUInt32LE(kept, 80);
  return { bytes: output.subarray(0, 84 + kept * 50), triangles: kept, removedDegenerate: count - kept };
}
function meshSnapshot(report) {
  const components = report.topology?.connectedComponents || [];
  const volumeMm3 = report.status === 'complete' && components.every(component => component.closed && Number.isFinite(component.signedVolumeMm3))
    ? components.reduce((total, component) => total + component.signedVolumeMm3, 0) : null;
  return { status: report.status, triangles: report.triangles, bounds: report.bounds, signedVolumeMm3: volumeMm3, connectedComponents: components.length, checks: report.checks, topology: report.topology };
}
function manifoldMeshToStl(shape) {
  const mesh = shape.getMesh();
  try {
    const count = mesh.triVerts.length / 3;
    if (!Number.isInteger(count) || count === 0) throw new Error('Organik model boş mesh üretti.');
    const output = Buffer.alloc(84 + count * 50);
    output.write('Kodla3D Manifold SDF mesh; mm', 0, 80, 'ascii');
    output.writeUInt32LE(count, 80);
    const vertex = index => {
      const offset = index * mesh.numProp;
      const value = [mesh.vertProperties[offset], mesh.vertProperties[offset + 1], mesh.vertProperties[offset + 2]];
      if (!value.every(Number.isFinite)) throw new Error('Organik mesh NaN/sonsuz koordinat içeriyor.');
      return value;
    };
    for (let i = 0; i < count; i++) {
      const a = vertex(mesh.triVerts[i * 3]);
      const b = vertex(mesh.triVerts[i * 3 + 1]);
      const c = vertex(mesh.triVerts[i * 3 + 2]);
      const u = b.map((v, k) => v - a[k]);
      const v = c.map((x, k) => x - a[k]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const length = Math.hypot(...normal);
      if (length === 0) throw new Error(`Organik mesh sıfır alanlı üçgen içeriyor: ${i}.`);
      const offset = 84 + i * 50;
      for (let axis = 0; axis < 3; axis++) output.writeFloatLE(normal[axis] / length, offset + 4 + axis * 4);
      for (const [corner, point] of [a, b, c].entries()) for (let axis = 0; axis < 3; axis++) output.writeFloatLE(point[axis], offset + 12 + corner * 12 + axis * 4);
    }
    return { bytes: output, triangles: count, removedDegenerate: 0 };
  } finally {}
}
function topologyCounts(shape) {
  const mesh = shape.getMesh();
  try {
    const edges = new Map();
    for (let i = 0; i < mesh.triVerts.length; i += 3) {
      for (const [a, b] of [[mesh.triVerts[i], mesh.triVerts[i + 1]], [mesh.triVerts[i + 1], mesh.triVerts[i + 2]], [mesh.triVerts[i + 2], mesh.triVerts[i]]]) {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    const counts = [...edges.values()];
    return { boundaryEdges: counts.filter(count => count === 1).length, nonManifoldEdges: counts.filter(count => count > 2).length };
  } finally {}
}
let result;
let wasmInstance;
let outputShape;
try {
  markPhase('wasmInit');
  if (mode === 'cad') {
    if (!(cadMeshQualityName in cadMeshProfiles)) throw new Error('CAD ağ ayarı taslak, normal veya ince olmalı.');
    const wasm = await readFile(new URL('./node_modules/replicad-opencascadejs/dist/replicad_single.wasm', import.meta.url));
    wasmInstance = await initOpenCascade({ wasmBinary: wasm });
    replicad.setOC(wasmInstance);
    cadApi.setOpenCascadeKernel(wasmInstance);
  } else if (mode === 'organic') {
    const { instantiateManifold } = await import('manifold-3d/lib/wasm.js');
    wasmInstance = await instantiateManifold();
  } else throw new Error(`Bilinmeyen geometri modu: ${mode}.`);

  markPhase('sourceAndGeometry');
  const source = await readFile(path.join(folder, 'model.js'), 'utf8');
  validateSourceSyntax(source);
  let parameters = {};
  try { parameters = JSON.parse(await readFile(path.join(folder, 'parameters.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('Parametre dosyası JSON nesnesi olmalı.');
  if (mode === 'cad') {
    const run = new Function('api', 'replicad', 'parameters', `"use strict"; const {kutu,silindir,birlestir,cikar,daireselLoft,profilLoft,profilDondur,profilSupur,dogrusalDesen,Parca}=api; const referansProfili=({ad,yon='on',tolerans}={})=>{const c=parameters?.referans?.konturlar?.[yon];if(!c||!Array.isArray(c.noktalar)||c.noktalar.length<3)throw new Error('referansProfili: '+yon+' konturu parameters.referans.konturlar içinde yok.');if(tolerans!==undefined&&(!Number.isFinite(tolerans)||tolerans<0))throw new Error('referansProfili toleransı negatif olmayan mm olmalı.');return c.noktalar.map(p=>[...p]);};\n${source}\n;return typeof model !== 'undefined' ? model : null;`);
    const modelValue = run(cadApi, replicad, parameters);
    const model = modelValue instanceof cadApi.Parca ? modelValue : new cadApi.Parca('model', modelValue);
    outputShape = model.sekil;
    if (!outputShape || typeof outputShape.blobSTEP !== 'function' || outputShape.isNull) throw new Error('Kod bir Parca veya Replicad katı modeli döndürmeli: return model;');
    markPhase('validationAndMeasurement');
    const analyzer = new wasmInstance.BRepCheck_Analyzer(outputShape.wrapped, true);
    const valid = analyzer.IsValid(outputShape.wrapped);
    analyzer.delete();
    const volume = replicad.measureVolume(outputShape);
    if (!valid || !Number.isFinite(volume) || volume <= 0 || !outputShape.solids.length) throw new Error('Geçerli, pozitif hacimli bir katı model üretilemedi.');
    const [min, max] = outputShape.boundingBox.bounds;
    const bbox = { min, max };
    markPhase('stlMeshingAndExport');
    const rawStlBytes = new Uint8Array(await outputShape.blobSTL({ binary: true, ...cadMeshQuality }).arrayBuffer());
    reserveOutput('STL', rawStlBytes.byteLength);
    const meshBeforeRepair = analyzeBinaryStl(rawStlBytes);
    const stl = temizSTL(rawStlBytes);
    const meshAfterRepair = analyzeBinaryStl(stl.bytes);
    if (meshAfterRepair.status === 'invalid') throw new Error('CAD STL boş veya sonlu olmayan koordinat içeriyor; dışa aktarım durduruldu.');
    const meshReport = { ...meshAfterRepair, repair: { applied: stl.removedDegenerate > 0, method: 'Yalnız aynı köşeleri tekrarlayan sıfır uzunluklu üçgenleri STL yazımında atar; toleransla vertex birleştirme veya agresif kapatma yok.', removedDegenerateTriangles: stl.removedDegenerate, before: meshSnapshot(meshBeforeRepair), after: meshSnapshot(meshAfterRepair) } };
    await writeFile(path.join(folder, 'model.stl'), stl.bytes);
    const visual = renderSixViewsPng(stl.bytes); reserveOutput('Altı görünüş PNG',visual.bytes.length); await writeFile(path.join(folder,'views.png'),visual.bytes);
    const previewMesh = outputShape.mesh(cadMeshQuality);
    const previewVertices = Float32Array.from(previewMesh.vertices);
    const previewNormals = Float32Array.from(previewMesh.normals);
    const previewTriangles = Uint32Array.from(previewMesh.triangles);
    const previewGroups = Int32Array.from(previewMesh.faceGroups.flatMap(group => [group.start, group.count, group.faceId]));
    const previewBytes = previewVertices.byteLength + previewNormals.byteLength + previewTriangles.byteLength + previewGroups.byteLength;
    reserveOutput('Önizleme ağı', previewBytes);
    await writeFile(path.join(folder, 'preview.bin'), Buffer.concat([
      Buffer.from(previewVertices.buffer), Buffer.from(previewNormals.buffer),
      Buffer.from(previewTriangles.buffer), Buffer.from(previewGroups.buffer)
    ]));
    markPhase('stepExport');
    const stepBytes = new Uint8Array(await outputShape.blobSTEP().arrayBuffer());
    reserveOutput('STEP', stepBytes.byteLength);
    markPhase('diskWrite');
    await writeFile(path.join(folder, 'model.step'), stepBytes);
    result = {
      ok: true, schemaVersion: MODEL_SCHEMA_VERSION, geometryType: 'cad', unit: 'mm', name: model.ad || 'model',
      size: max.map((v, i) => v - min[i]), bbox, volume, solids: outputShape.solids.length, faces: outputShape.faces.length,
      mesh: { triangles: stl.triangles, removedDegenerate: stl.removedDegenerate },
      meshReport, visual:{ format:'png', file:'views.png', width:visual.width, height:visual.height, cameras:visual.cameras, triangles:visual.triangles, renderer:visual.renderer, bytes:visual.bytes.length },
      engine: { name: 'Replicad / OpenCascade WASM', version: '1.1.0' }, quality: { preset: cadMeshQualityName, stlToleranceMm: cadMeshQuality.tolerance, angularTolerance: cadMeshQuality.angularTolerance },
      parts: model.nodes.map(node => ({ ...node, solids: node.id === model.rootId ? outputShape.solids.length : undefined, bounds: node.id === model.rootId ? { min, max } : node.bounds })),
      faceSources: model.faceSources,
      previewMesh: { vertices: previewVertices.length, indices: previewTriangles.length, groups: previewMesh.faceGroups.length, bytes: previewBytes },
      parameters,
      formats: ['stl', 'step', 'js'], warnings: [], sourceHash: sha256(source),
      fileSizes: { stl: stl.bytes.length, step: stepBytes.length, preview: previewVertices.byteLength + previewNormals.byteLength + previewTriangles.byteLength + previewGroups.byteLength }
    };
  } else {
    const api = createOrganicAPI();
    const run = new Function('api', 'parameters', `"use strict"; const {OrganikParca,kure,elipsoid,kapsul,yumusakBirlestir,yumusakCikar,grup,gorunum,tasi,donustur,simetrik,parcaBul,parcaDegistir,bolgeselSekillendir,egriDetayi,gozKapagi,dudakCizgisi,yeleTutami,burunDeligi}=api;\n${source}\n;return typeof model !== 'undefined' ? model : null;`);
    const model = run(api, parameters);
    if (!(model instanceof api.OrganikParca)) throw new Error('Organik modda kod OrganikParca döndürmeli: return model;');
    if (!model.visible) throw new Error('Model görünür değil; STL için en az bir görünür parça gerekir.');
    if (!(qualityName in qualityProfiles)) throw new Error('Kalite taslak, normal veya ince olmalı.');
    const edgeLengthMm = qualityProfiles[qualityName];
    const bounds = tightOrganicBounds(model.field, model.bounds);
    const extent = bounds.max.map((v, i) => v - bounds.min[i]);
    const estimatedGridCells = extent.reduce((product, length) => product * Math.ceil(length / edgeLengthMm), 1) * 2;
    const maxGridCells = 4_000_000;
    if (!Number.isFinite(estimatedGridCells) || estimatedGridCells > maxGridCells) throw new Error(`Organik örnekleme bütçesi aşıldı (${Math.ceil(estimatedGridCells).toLocaleString('tr-TR')} hücre tahmini; sınır ${maxGridCells.toLocaleString('tr-TR')}). Taslak kalite seçin veya modeli küçültün.`);
    // The level-set grid must fully enclose the model; sample all 26 points on its box boundary.
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
      if (x !== 0 && x !== 2 && y !== 0 && y !== 2 && z !== 0 && z !== 2) continue;
      const point = [0, 1, 2].map((axis, i) => bounds.min[axis] + (bounds.max[axis] - bounds.min[axis]) * [x, y, z][i] / 2);
      if (model.field(point) > 1e-6) throw new Error('Organik model örnekleme sınırına taşıyor; bounds içine sığdırın.');
    }
    markPhase('levelSetAndMeshing');
    outputShape = wasmInstance.Manifold.levelSet(model.field, bounds, edgeLengthMm);
    markPhase('validationAndMeasurement');
    if (String(outputShape.status()) !== 'NoError' || outputShape.isEmpty() || !Number.isFinite(outputShape.volume()) || outputShape.volume() <= 0) throw new Error(`Manifold geçerli hacim üretemedi: ${outputShape.status()}.`);
    const components = outputShape.decompose();
    const solidCount = components.length;
    for (const component of components) component.delete();
    const bbox = outputShape.boundingBox();
    const size = bbox.max.map((v, i) => v - bbox.min[i]);
    const volume = outputShape.volume();
    const topology = topologyCounts(outputShape);
    markPhase('stlMeshingAndExport');
    const stl = manifoldMeshToStl(outputShape);
    reserveOutput('STL', stl.bytes.byteLength);
    const visual = renderSixViewsPng(stl.bytes); reserveOutput('Altı görünüş PNG',visual.bytes.length);
    const organicMeshReport = analyzeBinaryStl(stl.bytes);
    if (organicMeshReport.status === 'invalid') throw new Error('Organik STL boş veya sonlu olmayan koordinat içeriyor; dışa aktarım durduruldu.');
    const organicSnapshot = meshSnapshot(organicMeshReport);
    const meshReport = { ...organicMeshReport, repair: { applied: false, method: 'Manifold STL çıktısı değiştirilmedi.', removedDegenerateTriangles: 0, before: organicSnapshot, after: organicSnapshot } };
    markPhase('diskWrite');
    await writeFile(path.join(folder, 'model.stl'), stl.bytes);
    await writeFile(path.join(folder,'views.png'),visual.bytes);
    result = {
      ok: true, schemaVersion: MODEL_SCHEMA_VERSION, apiVersion: api.apiVersion, geometryType: 'organic', unit: 'mm', name: model.ad,
      size, bbox, volume, components: solidCount, faces: 0,
      mesh: { triangles: stl.triangles, removedDegenerate: 0, surfaceComponents: solidCount, ...topology },
      meshReport, visual:{ format:'png', file:'views.png', width:visual.width, height:visual.height, cameras:visual.cameras, triangles:visual.triangles, renderer:visual.renderer, bytes:visual.bytes.length },
      engine: { name: 'Manifold SDF / WASM', version: '3.5.4' },
      quality: { preset: qualityName, edgeLengthMm, estimatedGridCells, maxGridCells },
      parts: model.nodes.map(node => ({ id: node.id, name: node.name, type: node.type, sourceId: node.sourceId, groupId: node.groupId, visible: node.visible, locked: node.locked, transforms: node.transforms, operations: node.operations, parameters: node.parameters, bounds: node.bounds, components: node.id === model.id ? solidCount : undefined })),
      parameters,
      formats: ['stl', 'js'], warnings: ['Organik geometri üçgen mesh kaynağıdır; parametrik STEP üretmez.', 'SDF elipsoid uzaklığı yaklaşık, küre ve kapsül alanları analitik olarak tanımlıdır.'],
      sourceHash: sha256(source), fileSizes: { stl: stl.bytes.length }
    };
  }
} catch (error) {
  result = { ok: false, error: error.message || String(error), detail: error.stack || String(error), sourceLine: Number.isInteger(error.sourceLine) ? error.sourceLine : null, sourceColumn: Number.isInteger(error.sourceColumn) ? error.sourceColumn : null };
} finally {
  if (outputShape?.delete) outputShape.delete();
  clearInterval(memorySampler);
}
markPhase('resultWrite');
peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
peakHeapUsedBytes = Math.max(peakHeapUsedBytes, process.memoryUsage().heapUsed);
const finishedAt = process.hrtime.bigint();
phases[activePhase] = Number(finishedAt - phaseStartedAt) / 1e6;
result.profile = { phasesMs: phases, workerTotalMs: Number(finishedAt - startedAt) / 1e6, peakRssBytes, peakHeapUsedBytes, memorySamplingIntervalMs: 20 };
await writeFile(path.join(folder, 'result.json'), JSON.stringify(result));
writeProgress(result.ok ? 'completed' : 'failed');



