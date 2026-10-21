import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initOpenCascade from 'replicad-opencascadejs';
import * as replicad from 'replicad';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.KODLA3D_PORT||8765);
const base=`http://127.0.0.1:${port}`;
const wasm=await readFile(path.join(root,'node_modules','replicad-opencascadejs','dist','replicad_single.wasm'));
const oc=await initOpenCascade({wasmBinary:wasm});
replicad.setOC(oc);
const {instantiateManifold}=await import('manifold-3d/lib/wasm.js');
replicad.setManifold(await instantiateManifold());

async function buildAndReopen(name){
  const source=await readFile(path.join(root,'models',`${name}.js`),'utf8');
  const response=await fetch(`${base}/api/build`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:source})});
  const result=await response.json();
  assert.equal(response.status,200,`${name} build: ${JSON.stringify(result)}`);
  assert.ok(result.ok&&result.geometryType==='cad'&&result.solids>0);
  const [stepResponse,stlResponse]=await Promise.all([fetch(base+result.files.step),fetch(base+result.files.stl)]);
  assert.equal(stepResponse.status,200);assert.equal(stlResponse.status,200);
  const [stepBytes,stlBytes]=await Promise.all([stepResponse.arrayBuffer(),stlResponse.arrayBuffer()]);
  const reopenedStep=await replicad.importSTEP(new Blob([stepBytes]));
  assert.ok(reopenedStep.solids.length>0,`${name} STEP import should contain solids`);
  const reopenedVolume=replicad.measureVolume(reopenedStep.asShape3D());
  const [min,max]=reopenedStep.boundingBox.bounds;
  const reopenedBounds=max.map((value,index)=>value-min[index]);
  assert.ok(Math.abs(reopenedVolume-result.volume)/result.volume<0.002,`${name} STEP volume changed: ${reopenedVolume} vs ${result.volume}`);
  assert.ok(reopenedBounds.every((value,index)=>Math.abs(value-result.size[index])<0.08),`${name} STEP bounds changed: ${reopenedBounds} vs ${result.size}`);

  const reopenedStl=await replicad.importSTLAsMesh(new Blob([stlBytes]));
  assert.equal(reopenedStl.isEmpty,false,`${name} STL import should not be empty`);
  assert.equal(reopenedStl.numTri(),result.mesh.triangles,`${name} STL triangle count should survive import`);
  assert.ok(reopenedStl.volume()>0,`${name} STL imported volume should be positive`);
  return {name,api:{sizeMm:result.size,volumeMm3:result.volume,solids:result.solids,triangles:result.mesh.triangles},step:{bytes:stepBytes.byteLength,reopenedSolids:reopenedStep.solids.length,reopenedBoundsMm:reopenedBounds,reopenedVolumeMm3:reopenedVolume},stl:{bytes:stlBytes.byteLength,reopenedTriangles:reopenedStl.numTri(),reopenedVolumeMm3:reopenedStl.volume()}};
}

const evidence=[];
for(const name of ['kutu','aparat']) evidence.push(await buildAndReopen(name));
const horseDirectory=path.join(root,'outputs','at-kafasi-v2');
const horseMetrics=JSON.parse(await readFile(path.join(horseDirectory,'DOGRULAMA.json'),'utf8'));
const [horseStepBytes,horseStlBytes]=await Promise.all([
  readFile(path.join(horseDirectory,'at-kafasi-v2.step')),
  readFile(path.join(horseDirectory,'at-kafasi-v2.stl'))
]);
const horseStep=await replicad.importSTEP(new Blob([horseStepBytes]));
const horseStepVolume=replicad.measureVolume(horseStep.asShape3D());
const [horseMin,horseMax]=horseStep.boundingBox.bounds;
const horseStepBounds=horseMax.map((value,index)=>value-horseMin[index]);
assert.equal(horseStep.solids.length,1);
assert.ok(Math.abs(horseStepVolume-horseMetrics.volumeMm3)/horseMetrics.volumeMm3<0.002);
assert.ok(horseStepBounds.every((value,index)=>Math.abs(value-horseMetrics.sizeMm[index])<0.08));
const horseStl=await replicad.importSTLAsMesh(new Blob([horseStlBytes]));
assert.equal(horseStl.isEmpty,false);
assert.equal(horseStl.numTri(),horseMetrics.mesh.triangles);
assert.ok(horseStl.volume()>0);
evidence.push({name:'at-kafasi-v2 (existing versioned artifact)',api:{sizeMm:horseMetrics.sizeMm,volumeMm3:horseMetrics.volumeMm3,solids:horseMetrics.solids,triangles:horseMetrics.mesh.triangles},step:{bytes:horseStepBytes.byteLength,reopenedSolids:horseStep.solids.length,reopenedBoundsMm:horseStepBounds,reopenedVolumeMm3:horseStepVolume},stl:{bytes:horseStlBytes.byteLength,reopenedTriangles:horseStl.numTri(),reopenedVolumeMm3:horseStl.volume()}});
console.log(JSON.stringify({status:'passed',importer:'independent Replicad/OpenCascade process instance',evidence},null,2));
