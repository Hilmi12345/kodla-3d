import assert from 'node:assert/strict';

const port = Number(process.env.KODLA3D_PORT || 8765);
const code = `
const sol = kutu({ad:'sol-parca',genislik:12,derinlik:10,yukseklik:8});
const sagShape = replicad.makeBaseBox(12,10,8).translate(4,0,0);
const sag = new Parca('sag-kulak', sagShape, {id:'sag-kulak',parameters:{kulakUzunlugu:39}});
return birlestir(sol,sag,'birlesik-kulak');
`;
const response = await fetch(`http://127.0.0.1:${port}/api/build`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'cad', code })
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.ok(result.ok && result.geometryType === 'cad');
assert.ok(result.solids === 1 && result.volume > 0, 'overlapping source pieces produce one measured union solid');
const sourceIds = new Set(Object.values(result.faceSources).flat());
assert.ok(sourceIds.has('sol-parca-1') && sourceIds.has('sag-kulak'), 'final BRep faces map to both stable source parts');
const left = result.parts.find(part => part.id === 'sol-parca-1');
const right = result.parts.find(part => part.id === 'sag-kulak');
const root = result.parts.find(part => part.type === 'union');
assert.ok(left && right && root, 'worker returns both source nodes and a union root');
assert.equal(left.groupId, root.id);
assert.equal(right.groupId, root.id);
assert.deepEqual(right.parameters, { kulakUzunlugu: 39 });
assert.ok(left.bounds.min[0] < left.bounds.max[0] && right.bounds.min[0] < right.bounds.max[0]);
assert.ok(result.previewMesh && result.files.preview, 'CAD preview carries indexed triangle face groups');
const previewResponse = await fetch(`http://127.0.0.1:${port}${result.files.preview}`);
assert.equal(previewResponse.status, 200);
const bytes = new Uint8Array(await previewResponse.arrayBuffer());
assert.equal(bytes.byteLength, result.previewMesh.bytes);
const f32 = new Float32Array(bytes.buffer, bytes.byteOffset, (result.previewMesh.vertices + result.previewMesh.vertices) );
const indexOffset = result.previewMesh.vertices * 8;
const indexCount = result.previewMesh.indices;
const indexData = new Uint32Array(bytes.buffer, bytes.byteOffset + indexOffset, indexCount);
const groupOffset = indexOffset + indexCount * 4;
const groupData = new Int32Array(bytes.buffer, bytes.byteOffset + groupOffset, result.previewMesh.groups * 3);
assert.ok(f32.every(Number.isFinite), 'preview coordinates and normals are finite');
const groupedOwners = new Set();
for (let i = 0; i < groupData.length; i += 3) {
  const start = groupData[i], count = groupData[i + 1], faceId = String(groupData[i + 2]);
  assert.ok(start >= 0 && count > 0 && start + count <= indexCount && count % 3 === 0, 'face group uses valid triangle-index range');
  assert.ok(indexData.subarray(start, start + count).every(index => index < result.previewMesh.vertices / 3));
  for (const id of result.faceSources[faceId] || []) groupedOwners.add(id);
}
assert.ok(groupedOwners.has(left.id) && groupedOwners.has(right.id), 'renderable triangle groups retain both source identities');
console.log(JSON.stringify({ status: 'passed', solidCount: result.solids, faces: result.faces, meshTriangles: result.mesh.triangles, previewGroups: result.previewMesh.groups, sourceIds: [...groupedOwners], previewBytes: bytes.byteLength }));
