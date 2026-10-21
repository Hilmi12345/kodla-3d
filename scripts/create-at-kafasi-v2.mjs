import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port=18800+Math.floor(Math.random()*900);
const tempRuns=await mkdtemp(path.join(os.tmpdir(),'kodla3d-horse-v2-'));
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,KODLA3D_PORT:String(port),KODLA3D_RUNS_DIR:tempRuns,KODLA3D_WORKER_TIMEOUT_MS:'120000'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let serverLog='';
server.stdout.on('data',chunk=>serverLog+=chunk.toString());
server.stderr.on('data',chunk=>serverLog+=chunk.toString());
const base=`http://127.0.0.1:${port}`;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,init={}){
  const response=await fetch(`${base}${url}`,{...init,signal:AbortSignal.timeout(190000)});
  const type=response.headers.get('content-type')||'';
  return {response,data:type.includes('json')?await response.json():Buffer.from(await response.arrayBuffer())};
}
async function build(example,overrides={}){
  const code=await readFile(path.join(root,'models',`${example}.js`),'utf8');
  const schema=JSON.parse(await readFile(path.join(root,'models',`${example}.parameters.json`),'utf8'));
  const parameters={...Object.fromEntries(schema.parameters.map(item=>[item.id,item.default])),...overrides};
  const {response,data}=await request('/api/build',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jobId:randomUUID(),mode:'cad',quality:'normal',example,parameters,code})});
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.ok,true,JSON.stringify(data));
  return {code,parameters,result:data};
}
async function fetchFile(url){const {response,data}=await request(url);assert.equal(response.status,200,`file download failed: ${url}`);return data;}

try{
  let healthy=false;
  for(let i=0;i<100;i++){try{const {response,data}=await request('/api/health');if(response.ok&&data.ok){healthy=true;break;}}catch{}await wait(100);}
  assert.ok(healthy,`isolated server did not start. ${serverLog}`);
  const old=process.env.KODLA3D_V2_SKIP_V1==='1'?null:await build('at-kafasi');
  const next=await build('at-kafasi-v2',{
    ...(process.env.KODLA3D_V2_YELE==='0'?{yele:false}:{}),
    ...(process.env.KODLA3D_V2_DETAILS==='0'?{detaylar:false}:{})
  });
  const r=next.result;
  console.log('V2 topology candidate:',JSON.stringify({solids:r.solids,triangles:r.mesh.triangles,report:r.meshReport.topology}));
  assert.equal(r.solids,1,'V2 should be a single fused solid');
  assert.equal(r.meshReport.status,'complete','V2 mesh report must be complete');
  assert.equal(r.meshReport.topology.boundaryEdges,0,'V2 must have no open mesh edges');
  assert.equal(r.meshReport.topology.nonManifoldEdges,0,'V2 must have no non-manifold edges');
  assert.ok(r.mesh.triangles<750000,'V2 should remain within the analysis/export triangle budget');
  assert.deepEqual(r.visual.cameras,['front','back','right','left','top','iso']);
  const outputRoot=process.env.KODLA3D_OUTPUT_ROOT?path.resolve(process.env.KODLA3D_OUTPUT_ROOT):path.join(root,'outputs');
  const dir=path.join(outputRoot,'at-kafasi-v2');
  await mkdir(dir,{recursive:true});
  const stl=await fetchFile(r.files.stl),step=await fetchFile(r.files.step),png=await fetchFile(r.files.visual);
  const oldPng=old?await fetchFile(old.result.files.visual):await readFile(path.join(root,'outputs','at-kafasi','coklu-gorunus.png'));
  await writeFile(path.join(dir,'at-kafasi-v2.js'),next.code);
  await writeFile(path.join(dir,'at-kafasi-v2.stl'),stl);
  await writeFile(path.join(dir,'at-kafasi-v2.step'),step);
  await writeFile(path.join(dir,'at-kafasi-v2-gorunumler.png'),png);
  await writeFile(path.join(dir,'at-kafasi-v1-ayni-kamera.png'),oldPng);
  const reference=path.join(dir,'referans.jpg');
  await copyFile(path.join(root,'outputs','at-kafasi','referans.jpg'),reference);
  const referenceHash=createHash('sha256').update(await readFile(reference)).digest('hex');
  const manifest=JSON.parse(await readFile(path.join(root,'outputs','at-kafasi','at-kafasi-calisma.kodla3d.json'),'utf8'));
  const model={source:next.code,mode:'cad',quality:'normal',example:'at-kafasi-v2',parameters:next.parameters};
  manifest.metadata={name:'at-kafasi-v2',savedAt:new Date().toISOString()};
  manifest.model=model;
  manifest.references=[{path:'outputs/at-kafasi-v2/referans.jpg',sha256:referenceHash,attribution:'Doğukan tarafından sağlanan yerel referans; lisans kaydı yok.'}];
  manifest.view={camera:'iso',projection:'perspective'};
  manifest.versions=[{id:JSON.stringify(model),savedAt:new Date().toISOString(),label:`V2 · ${r.size.map(n=>n.toFixed(1)).join('×')} mm · ${(r.volume/1000).toFixed(2)} cm³`,model,result:{sourceHash:r.sourceHash,size:r.size,volume:r.volume}}];
  await writeFile(path.join(dir,'at-kafasi-v2.kodla3d.json'),JSON.stringify(manifest,null,2));
  const oldMetrics=old?.result||JSON.parse(await readFile(path.join(root,'outputs','at-kafasi','DOGRULAMA.json'),'utf8'));
  const validation={ok:true,model:'at-kafasi-v2',sourceHash:r.sourceHash,mode:r.mode,quality:r.quality,parameters:next.parameters,sizeMm:r.size,volumeMm3:r.volume,solids:r.solids,faces:r.faces,mesh:r.mesh,meshReport:r.meshReport,visual:r.visual,files:{stlBytes:stl.length,stepBytes:step.length,pngBytes:png.length},referenceSha256:referenceHash,comparison:{v1SizeMm:oldMetrics.size??oldMetrics.sizeMm,v1VolumeMm3:oldMetrics.volume??oldMetrics.volumeMm3,v1Solids:oldMetrics.solids,v1Faces:oldMetrics.faces,v1Triangles:oldMetrics.mesh?.triangles??oldMetrics.triangles,volumeDeltaPercent:Number(((r.volume-(oldMetrics.volume??oldMetrics.volumeMm3))/(oldMetrics.volume??oldMetrics.volumeMm3)*100).toFixed(2)),viewFilesShareRenderer:Boolean(old)},notVerified:['kullanıcı görsel onayı','fiziksel baskı ve destek yerleşimi','duvar kalınlığı/overhang profili','tek fotoğrafın göstermediği yüzler','referans görselinin yeniden dağıtım lisansı']};
  await writeFile(path.join(dir,'DOGRULAMA.json'),JSON.stringify(validation,null,2));
  console.log(JSON.stringify({status:'passed',directory:dir,sizeMm:r.size,volumeCm3:Number((r.volume/1000).toFixed(2)),solids:r.solids,faces:r.faces,triangles:r.mesh.triangles,boundaryEdges:r.meshReport.topology.boundaryEdges,stepBytes:step.length,pngBytes:png.length,comparison:validation.comparison},null,2));
}finally{
  server.kill();
  await wait(250);
  await rm(tempRuns,{recursive:true,force:true});
}

