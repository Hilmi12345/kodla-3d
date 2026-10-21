import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProjectDocument } from '../src/project-manifest.js';

const parameterSchema = JSON.parse(await readFile(new URL('../models/at-kafasi.parameters.json', import.meta.url), 'utf8'));
const samples = [{ name: 'at-kafasi', mode: 'cad', parameterSchema }];
const valid = {
  format: 'kodla3d-project', projectVersion: 1,
  metadata: { name: 'at-kafasi', savedAt: '2026-10-19T00:00:00.000Z' },
  model: { source: 'return new Parca("x", kutu({genislik:1,derinlik:1,yukseklik:1}));', mode: 'cad', quality: 'normal', example: 'at-kafasi', parameters: { yele: false } },
  references: [{ path: 'outputs/at-kafasi/referans.jpg', sha256: 'A'.repeat(64) }],
  engine: { cad: 'Replicad / OpenCascade WASM 1.1.0', organic: 'Manifold SDF 3.5.4', apiVersion: 1, resultSchemaVersion: 1 },
  view: { camera: 'front', projection: 'orthographic' },
  versions: [{ id: 'previous-at-version', savedAt: '2026-10-18T23:00:00.000Z', label: 'Önceki başarılı sürüm', model: { source: 'return new Parca("x", kutu({genislik:1,derinlik:1,yukseklik:1}));', mode: 'cad', quality: 'normal', example: 'at-kafasi', parameters: { yele: true } }, result: { sourceHash: 'B'.repeat(64), size: [10, 10, 10], volume: 1000 } }]
};
const opened = validateProjectDocument(valid, samples);
assert.equal(opened.model.parameters.yele, false);
assert.equal(opened.model.parameters.kulakUzunlugu, 39);
assert.equal(opened.versions[0].model.parameters.yele, true, 'successful version keeps its own parameter snapshot');
const withReference=structuredClone(valid);withReference.references=[{path:'references/on.png',data:'data:image/png;base64,AA==',camera:'front',measurements:{genislikMm:80,yukseklikMm:40,aciDeg:0},polygon:[[2,2],[8,2],[8,8]],imageWidth:10,imageHeight:10,mountingHoles:[{x:4,y:5,diameter:3}]}];
assert.deepEqual(validateProjectDocument(withReference,samples).references,withReference.references,'reference image and measurements remain embedded in the project file');
const mismatch = structuredClone(valid); mismatch.engine.cad = 'different';
assert.equal(validateProjectDocument(mismatch, samples).engine.cad, 'different', 'engine differences remain importable so the UI can warn');
for (const [mutate, pattern] of [
  [doc => { doc.model.source = ''; }, /boş olamaz/],
  [doc => { doc.references[0].path = '../outside.jpg'; }, /göreli dosyalar/],
  [doc => { doc.references[0].sha256 = 'bad'; }, /SHA-256/],
  [doc => { doc.references[0].data = 'https://example.invalid/image.jpg'; }, /görsel verisi/],
  [doc => { doc.references[0].polygon = [[-1,0],[1,1],[2,2]]; }, /görsel verisi/],
  [doc => { doc.references = Array(4).fill(doc.references[0]); }, /En fazla üç/],
  [doc => { doc.metadata.name = '../outside'; }, /dosya adı olarak geçersiz/],
  [doc => { doc.model.parameters.yele = 'false'; }, /true\/false/],
  [doc => { doc.model.mode = 'organic'; }, /motoruyla eşleşmiyor/],
  [doc => { doc.versions[0].result.volume = NaN; }, /ölçü\/hacim/],
  [doc => { doc.versions = Array(11).fill(doc.versions[0]); }, /en fazla 10/]
]) {
  const invalid = structuredClone(valid); mutate(invalid);
  assert.throws(() => validateProjectDocument(invalid, samples), pattern);
}
const tooLong = structuredClone(valid); tooLong.model.source = 'x'.repeat(100001);
assert.throws(() => validateProjectDocument(tooLong, samples), /100 KB/);
const tooMuchHistory = structuredClone(valid);
tooMuchHistory.versions = Array.from({ length: 8 }, (_, index) => ({
  ...valid.versions[0], id: `large-${index}`, model: { ...valid.versions[0].model, source: 'x'.repeat(90000) }
}));
assert.throws(() => validateProjectDocument(tooMuchHistory, samples), /700 KB/);
console.log(JSON.stringify({ status: 'passed', checked: ['round-trip-normalization', 'successful-version-snapshot', 'version-count-limit', 'version-byte-limit', 'invalid-version-measurement', 'engine-mismatch-warning-path', 'source-limit', 'reference-traversal', 'reference-hash', 'typed-parameters', 'mode-consistency'] }));
