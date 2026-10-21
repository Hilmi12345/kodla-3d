import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2];
if (!file) throw new Error('Kullanım: node scripts/verify-glb-file.mjs <model.glb>');
const bytes = await readFile(path.resolve(file));
assert.ok(bytes.length >= 28, 'GLB beklenen minimum uzunluktan kısa.');
assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'GLB magic geçersiz.');
assert.equal(bytes.readUInt32LE(4), 2, 'GLB sürümü 2 olmalı.');
assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB toplam byte uzunluğu başlıkla eşleşmiyor.');

let offset = 12;
let json = null;
let binaryBytes = 0;
while (offset < bytes.length) {
  assert.ok(offset + 8 <= bytes.length, 'GLB chunk başlığı eksik.');
  const length = bytes.readUInt32LE(offset);
  const type = bytes.readUInt32LE(offset + 4);
  const start = offset + 8;
  const end = start + length;
  assert.ok(end <= bytes.length, 'GLB chunk dosya sınırını aşıyor.');
  if (type === 0x4e4f534a) json = JSON.parse(bytes.toString('utf8', start, end).trimEnd());
  else if (type === 0x004e4942) binaryBytes = length;
  offset = end;
}
assert.equal(offset, bytes.length, 'GLB chunk tablosu dosya uzunluğuna oturmuyor.');
assert.equal(json?.asset?.version, '2.0', 'glTF JSON 2.0 değil.');
assert.ok(binaryBytes > 0, 'GLB binary chunk boş.');
assert.ok(json.meshes?.length, 'GLB mesh içermiyor.');
assert.ok(json.meshes.some(mesh => mesh.primitives?.some(primitive => primitive.mode === 4)), 'GLB triangle primitive içermiyor.');
const node = json.nodes?.find(item => Number.isInteger(item.mesh));
assert.ok(node, 'GLB mesh node bulunamadı.');
const matrixScale = node.matrix?.length === 16 ? [node.matrix[0], node.matrix[5], node.matrix[10]] : node.scale;
assert.deepEqual(matrixScale, [0.001, 0.001, 0.001], 'mm→m ölçek dönüşümü bulunamadı.');
const positionIndex = json.meshes[node.mesh].primitives.find(item => item.attributes?.POSITION !== undefined).attributes.POSITION;
const position = json.accessors[positionIndex];
assert.equal(position?.type, 'VEC3', 'POSITION accessor VEC3 değil.');
assert.ok(Number.isInteger(position.count) && position.count > 0 && position.count % 3 === 0, 'POSITION vertex sayısı geçersiz.');
assert.ok(position.min?.every(Number.isFinite) && position.max?.every(Number.isFinite), 'POSITION bounds finite değil.');
console.log(JSON.stringify({ status: 'passed', file: path.resolve(file), bytes: bytes.length, version: json.asset.version, triangles: position.count / 3, matrixScale, boundsMeters: position.max.map((value, axis) => (value - position.min[axis]) * 0.001), binaryBytes }));
