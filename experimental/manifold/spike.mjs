import { instantiateManifold } from 'manifold-3d/lib/wasm.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'outputs');
await mkdir(outDir, { recursive: true });
const startAll = performance.now();
const wasm = await instantiateManifold();
const { Manifold } = wasm;
const results = [];
let peakRssBytes = process.memoryUsage().rss;
let peakHeapUsedBytes = process.memoryUsage().heapUsed;
const memorySampler = setInterval(() => { const memory=process.memoryUsage(); peakRssBytes=Math.max(peakRssBytes,memory.rss); peakHeapUsedBytes=Math.max(peakHeapUsedBytes,memory.heapUsed); },5);

function sphereField(point, center, radius) {
  const d = Math.hypot(point[0]-center[0], point[1]-center[1], point[2]-center[2]);
  return radius-d; // positive inside, matching this binding's levelSet contract
}
function smoothMax(a, b, width) {
  const h = Math.max(width-Math.abs(a-b), 0) / width;
  return Math.max(a,b) + h*h*width*0.25;
}
function smoothUnion(values, width) { return values.reduce((a,b) => smoothMax(a,b,width)); }
function writeBinaryStl(mesh, filename) {
  const count = mesh.triVerts.length / 3;
  const data = Buffer.alloc(84 + count * 50);
  data.write('Manifold WASM spike; dimensions in mm', 0, 80, 'ascii');
  data.writeUInt32LE(count, 80);
  const coords = (vertex) => {
    const i = vertex * mesh.numProp;
    return [mesh.vertProperties[i], mesh.vertProperties[i+1], mesh.vertProperties[i+2]];
  };
  for (let i=0; i<count; i++) {
    const offset=84+i*50;
    const a=coords(mesh.triVerts[i*3]), b=coords(mesh.triVerts[i*3+1]), c=coords(mesh.triVerts[i*3+2]);
    const cross=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
    const len=Math.hypot(...cross)||1;
    for(let k=0;k<3;k++) data.writeFloatLE(cross[k]/len,offset+4+k*4);
    for(const [j,v] of [a,b,c].entries()) for(let k=0;k<3;k++) data.writeFloatLE(v[k],offset+12+j*12+k*4);
    data.writeUInt16LE(0,offset+48);
  }
  return writeFile(path.join(outDir,filename),data);
}
function validate(name, solid) {
  const mesh=solid.getMesh();
  const edges=new Map();
  for(let i=0;i<mesh.triVerts.length;i+=3) {
    for(const [a,b] of [[mesh.triVerts[i],mesh.triVerts[i+1]],[mesh.triVerts[i+1],mesh.triVerts[i+2]],[mesh.triVerts[i+2],mesh.triVerts[i]]]) {
      const key=a<b?`${a}:${b}`:`${b}:${a}`;
      edges.set(key,(edges.get(key)||0)+1);
    }
  }
  const counts=[...edges.values()];
  const box=solid.boundingBox();
  return {name,status:solid.status(),components:solid.decompose().length,volumeMm3:solid.volume(),surfaceAreaMm2:solid.surfaceArea(),bboxMm:{min:box.min,max:box.max},vertices:mesh.vertProperties.length/mesh.numProp,triangles:mesh.triVerts.length/3,boundaryEdges:counts.filter(n=>n===1).length,overusedEdges:counts.filter(n=>n>2).length,edgeIncidenceCounts:[...new Set(counts)].sort()};
}
function record(name,solid,ms,file) {
  const report=validate(name,solid);
  report.elapsedMs=ms;
  report.stl=file;
  results.push(report);
  return report;
}

// Identical two-sphere construction: true implicit-field blending vs exact Boolean union.
{
  const centers=[[-5,0,0],[5,0,0]], radius=9, width=4;
  const started=performance.now();
  const hard=Manifold.union(centers.map(c=>Manifold.sphere(radius,48).translate(c)));
  const hardMs=performance.now()-started;
  const smoothStarted=performance.now();
  const smooth=Manifold.levelSet(p=>smoothUnion(centers.map(c=>sphereField(p,c,radius)),width),{min:[-15,-13,-12],max:[15,13,12]},0.8);
  const smoothMs=performance.now()-smoothStarted;
  await writeBinaryStl(hard.getMesh(),'pair-hard.stl');
  await writeBinaryStl(smooth.getMesh(),'pair-smooth.stl');
  record('two-sphere-hard-boolean',hard,hardMs,'pair-hard.stl');
  record('two-sphere-smooth-sdf',smooth,smoothMs,'pair-smooth.stl');
  hard.delete(); smooth.delete();
}

// A rounded, bent neck made from variable-radius capsule segments and a smooth head join.
function variableCapsule(p,a,b,rA,rB) {
  const ab=b.map((v,i)=>v-a[i]);
  const ap=p.map((v,i)=>v-a[i]);
  const t=Math.max(0,Math.min(1,(ap[0]*ab[0]+ap[1]*ab[1]+ap[2]*ab[2])/(ab[0]**2+ab[1]**2+ab[2]**2)));
  const q=a.map((v,i)=>v+ab[i]*t);
  const radius=rA+(rB-rA)*t;
  return radius-Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
}
{
  const pathPoints=[[-2,0,0],[-3,0,6],[-2,0,12],[0,0,18],[2,0,22]];
  const started=performance.now();
  const shape=Manifold.levelSet(p=>{
    const neck=pathPoints.slice(0,-1).map((a,i)=>variableCapsule(p,a,pathPoints[i+1],5-i*0.35,4.3-i*0.35));
    const head=8-Math.hypot((p[0]-4)/1.0,(p[1])/0.86,(p[2]-22)/1.0);
    return smoothUnion([...neck,head],3);
  },{min:[-13,-11,-7],max:[14,11,32]},0.7);
  const elapsed=performance.now()-started;
  await writeBinaryStl(shape.getMesh(),'curved-neck-head.stl');
  record('curved-neck-head-sdf',shape,elapsed,'curved-neck-head.stl');
  shape.delete();
}

// Verify close but separate surfaces remain separate when the smooth blend width cannot reach them.
{
  const centers=[[-6.5,0,0],[6.5,0,0]], radius=5, width=2;
  const started=performance.now();
  const shape=Manifold.levelSet(p=>smoothUnion(centers.map(c=>sphereField(p,c,radius)),width),{min:[-13,-8,-8],max:[13,8,8]},0.65);
  const elapsed=performance.now()-started;
  record('nearby-but-separated-sdf',shape,elapsed,null);
  shape.delete();
}

// A 2 mm-radius thin capsule tests feature survival at two sampling spacings.
for (const edgeLength of [0.8,1.4]) {
  const started=performance.now();
  const shape=Manifold.levelSet(p=>variableCapsule(p,[-8,0,0],[8,4,12],2,2),{min:[-11,-4,-3],max:[11,8,15]},edgeLength);
  const elapsed=performance.now()-started;
  record(`thin-capsule-edge-${edgeLength}`,shape,elapsed,null);
  shape.delete();
}

clearInterval(memorySampler); const finalMemory=process.memoryUsage(); peakRssBytes=Math.max(peakRssBytes,finalMemory.rss); peakHeapUsedBytes=Math.max(peakHeapUsedBytes,finalMemory.heapUsed);
const report={generatedAt:new Date().toISOString(),packageVersion:'3.5.4',license:'Apache-2.0',runtime:process.version,wasm:'manifold-3d package WASM instantiated successfully on Windows/Node',totalMs:performance.now()-startAll,peakRssBytes,peakHeapUsedBytes,memorySamplingIntervalMs:5,results};
await writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

