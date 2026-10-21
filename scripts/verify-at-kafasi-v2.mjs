import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputRoot=process.env.KODLA3D_OUTPUT_ROOT?path.resolve(process.env.KODLA3D_OUTPUT_ROOT):path.join(root,'outputs');
const dir=path.join(outputRoot,'at-kafasi-v2');
const [report,manifest,source,stl,step,png,reference]=await Promise.all([
  readFile(path.join(dir,'DOGRULAMA.json'),'utf8').then(JSON.parse),
  readFile(path.join(dir,'at-kafasi-v2.kodla3d.json'),'utf8').then(JSON.parse),
  readFile(path.join(dir,'at-kafasi-v2.js'),'utf8'),
  readFile(path.join(dir,'at-kafasi-v2.stl')),
  readFile(path.join(dir,'at-kafasi-v2.step')),
  readFile(path.join(dir,'at-kafasi-v2-gorunumler.png')),
  readFile(path.join(dir,'referans.jpg'))
]);
assert.equal(report.ok,true);
assert.equal(report.model,'at-kafasi-v2');
assert.equal(report.solids,1);
assert.equal(report.meshReport.status,'complete');
assert.equal(report.meshReport.topology.boundaryEdges,0);
assert.equal(report.meshReport.topology.nonManifoldEdges,0);
assert.equal(report.meshReport.topology.connectedComponents.length,1);
assert.equal(report.meshReport.topology.connectedComponents[0].closed,true);
assert.equal(report.meshReport.printability.verdict,'profile-required');
assert.ok(Math.abs(report.sizeMm[2]-160)<1e-4, `yukseklik 160 mm olmali: ${report.sizeMm[2]}`); // 20.10: OpenCascade son basamagi makineye gore oynuyor, tam esitlik kirilgandi
assert.equal(report.visual.width,720);
assert.equal(report.visual.height,408);
assert.deepEqual(report.visual.cameras,['front','back','right','left','top','iso']);
assert.equal(stl.readUInt32LE(80),report.mesh.triangles);
assert.equal(stl.length,84+report.mesh.triangles*50);
assert.ok(step.subarray(0,32).toString('ascii').startsWith('ISO-10303-21;'));
assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
assert.equal(png.readUInt32BE(16),720);
assert.equal(png.readUInt32BE(20),408);
assert.equal(createHash('sha256').update(reference).digest('hex'),report.referenceSha256);
assert.equal(manifest.format,'kodla3d-project');
assert.equal(manifest.model.example,'at-kafasi-v2');
assert.equal(manifest.model.source,source);
assert.deepEqual(manifest.model.parameters,report.parameters);
assert.equal(manifest.versions[0].result.sourceHash,report.sourceHash);
console.log(JSON.stringify({status:'passed',sizeMm:report.sizeMm,volumeCm3:Number((report.volumeMm3/1000).toFixed(2)),solids:report.solids,triangles:report.mesh.triangles,stepBytes:step.length,pngBytes:png.length,closedMesh:true,projectManifest:true}));

