import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.KODLA3D_PORT || 8765);
const examples = await (await fetch(`http://127.0.0.1:${port}/api/examples`)).json();
const horse = examples.find(example => example.name === 'at-kafasi');
assert.ok(horse, 'at-kafasi model example is available');
const parameters = JSON.parse(await readFile(new URL('../models/at-kafasi.parameters.json', import.meta.url), 'utf8'));
const values = Object.fromEntries(parameters.parameters.map(item => [item.id, item.default]));
const response = await fetch(`http://127.0.0.1:${port}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: horse.code, mode: 'cad', example: 'at-kafasi', parameters: values })
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.ok(result.ok && result.solids === 1 && result.volume > 0);
const parts = new Map(result.parts.map(part => [part.id, part]));
const variantResponse = await fetch(`http://127.0.0.1:${port}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: horse.code, mode: 'cad', example: 'at-kafasi', parameters: { ...values, kulakUzunlugu: 45 } })
});
const variant = await variantResponse.json();
assert.equal(variantResponse.status, 200, JSON.stringify(variant));
const variantParts = new Map(variant.parts.map(part => [part.id, part]));
console.log('parameter-bounds', JSON.stringify({base: parts.get('kulak-sol')?.bounds, changed: variantParts.get('kulak-sol')?.bounds}));
assert.ok(variantParts.get('kulak-sol').bounds.max[2] > parts.get('kulak-sol').bounds.max[2] + 5, 'longer ear parameter must extend the ear');
assert.ok(variantParts.get('kulak-sag').bounds.max[2] > parts.get('kulak-sag').bounds.max[2] + 5, 'symmetric ear parameter must extend both ears');
for (const id of ['boyun', 'bas', 'yele', 'kaide']) assert.deepEqual(variantParts.get(id).bounds, parts.get(id).bounds, `${id} bounds must not change when only ear length changes`);
for (const id of ['kulak-sol', 'kulak-sag']) assert.ok(parts.has(id), `${id} has a named tree node`);
for (const id of ['kulak-sol', 'kulak-sag']) {
  const part = parts.get(id);
  assert.deepEqual(part.parameters, { yukseklik: 160, kulakUzunlugu: 39, taraf: id === 'kulak-sol' ? 'sol' : 'sag' });
  assert.ok(part.bounds?.min.every(Number.isFinite) && part.bounds.max.every(Number.isFinite), `${id} bounds are finite`);
  assert.ok(part.groupId && parts.has(part.groupId), `${id} belongs to a boolean parent`);
  const contributedFaces = Object.entries(result.faceSources).filter(([, owners]) => owners.includes(id)).map(([face]) => face);
  assert.ok(contributedFaces.length > 0, `${id} owns visible faces on the final fused BRep`);
}
assert.ok(result.parts.some(part => part.type === 'cut'), 'feature cuts are retained in the model tree');
assert.ok(result.previewMesh.groups > 0 && result.files.preview, 'final mesh includes face-addressable preview groups');
console.log(JSON.stringify({ status: 'passed', solids: result.solids, faces: result.faces, triangles: result.mesh.triangles, previewGroups: result.previewMesh.groups, ears: ['kulak-sol','kulak-sag'].map(id => ({ id, bounds: parts.get(id).bounds, attributedFaces: Object.values(result.faceSources).filter(owners => owners.includes(id)).length })) }));



