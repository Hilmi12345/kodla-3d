import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(await readFile(path.join(root,'docs','AI-FIXTURES.json'),'utf8'));
const port=19600+Math.floor(Math.random()*900);
const runs=await mkdtemp(path.join(os.tmpdir(),'kodla3d-ai-fixtures-'));
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,KODLA3D_PORT:String(port),KODLA3D_RUNS_DIR:runs,KODLA3D_WORKER_TIMEOUT_MS:'20000'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let serverOutput='';
server.stdout.on('data',chunk=>serverOutput+=chunk.toString());
server.stderr.on('data',chunk=>serverOutput+=chunk.toString());
const base=`http://127.0.0.1:${port}`;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function post(body){
  const response=await fetch(`${base}/api/build`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:randomUUID(),...body}),signal:AbortSignal.timeout(30000)});
  return {status:response.status,data:await response.json()};
}
async function buildExample(spec,examples){
  const example=examples.find(item=>item.name===spec.example);
  assert.ok(example,`missing API example: ${spec.example}`);
  const parameters=example.parameterSchema?Object.fromEntries(example.parameterSchema.parameters.map(item=>[item.id,item.default])):undefined;
  const {status,data}=await post({mode:spec.mode,quality:spec.quality,example:spec.example,code:example.code,...(parameters?{parameters}:{})});
  assert.equal(status,200,`${spec.id}: ${JSON.stringify(data)}`);
  assert.equal(data.ok,true);
  assert.equal(data.geometryType,spec.mode);
  assert.equal(data.meshReport.status,'complete');
  assert.ok(data.mesh.triangles>0);
  assert.ok(data.size.length===3&&data.size.every(Number.isFinite));
  if(spec.expected.solids!==undefined)assert.equal(data.solids,spec.expected.solids,spec.id);
  if(spec.expected.components!==undefined)assert.equal(data.components,spec.expected.components,spec.id);
  return {id:spec.id,status:'passed',example:spec.example,mode:spec.mode,size:data.size,solids:data.solids??null,components:data.components??null,triangles:data.mesh.triangles,boundaryEdges:data.meshReport.topology.boundaryEdges,nonManifoldEdges:data.meshReport.topology.nonManifoldEdges,formats:data.formats,sourceHash:data.sourceHash};
}

try{
  let healthy=false;
  for(let i=0;i<100;i++){try{const response=await fetch(`${base}/api/health`);if(response.ok){healthy=true;break;}}catch{}await wait(100);}
  assert.ok(healthy,`fixture server did not start: ${serverOutput}`);
  const examples=await(await fetch(`${base}/api/examples`)).json();
  const successful=[];
  for(const spec of fixture.successExamples)successful.push(await buildExample(spec,examples));

  const results=[];
  let check=await post({mode:'cad',quality:'normal',code:'   '});
  const empty=fixture.edgeCases.find(item=>item.id==='empty-source');
  assert.equal(check.status,empty.expectedHttp);assert.equal(check.data.code,empty.expectedCode);
  results.push({id:empty.id,status:'passed',http:check.status,code:check.data.code});

  const separateCode=`const a=kure({id:'kabuk-a',ad:'Kabuk A',merkez:[-8,0,0],yaricap:3});
const b=kure({id:'kabuk-b',ad:'Kabuk B',merkez:[8,0,0],yaricap:3});
return grup({id:'ayrik-iki-kabuk',ad:'Ayrık iki kabuk',parcalar:[a,b]});`;
  check=await post({mode:'organic',quality:'normal',code:separateCode});
  assert.equal(check.status,200,JSON.stringify(check.data));assert.equal(check.data.components,2);
  assert.equal(check.data.meshReport.topology.connectedComponents.length,2);
  results.push({id:'separate-shells',status:'passed',http:check.status,components:check.data.components,connectedComponents:check.data.meshReport.topology.connectedComponents.length});

  const tiny=fixture.edgeCases.find(item=>item.id==='sub-resolution-sphere');
  check=await post({mode:'organic',quality:tiny.quality,code:`return kure({id:'mikro-kure',ad:'0.2 mm örnek',merkez:[0,0,0],yaricap:0.1});`});
  assert.equal(check.status,tiny.expectedHttp);assert.equal(check.data.errorCode,tiny.expectedCode);
  results.push({id:tiny.id,status:'passed',http:check.status,code:check.data.errorCode,error:check.data.error});

  const overflow=fixture.edgeCases.find(item=>item.id==='grid-budget-overflow');
  check=await post({mode:overflow.mode,quality:overflow.quality,code:`return kure({id:'butce-asimi',ad:'Çözünürlük bütçesi sınaması',merkez:[0,0,0],yaricap:1000});`});
  assert.equal(check.status,overflow.expectedHttp,JSON.stringify(check.data));
  assert.equal(check.data.errorCode,overflow.expectedCode);
  results.push({id:overflow.id,status:'passed',http:check.status,errorCode:check.data.errorCode,error:check.data.error});

  const invalid=fixture.edgeCases.find(item=>item.id==='invalid-v2-parameter');
  check=await post({mode:'cad',quality:'normal',example:'at-kafasi-v2',parameters:{yanakDolgunlugu:17},code:'return null;'});
  assert.equal(check.status,invalid.expectedHttp);assert.equal(check.data.code,invalid.expectedCode);assert.equal(check.data.context.parameterPath,invalid.parameterPath);
  results.push({id:invalid.id,status:'passed',http:check.status,code:check.data.code,parameterPath:check.data.context.parameterPath});

  const crash=fixture.edgeCases.find(item=>item.id==='worker-crash');
  check=await post({mode:'cad',quality:'normal',code:'process.exit(7);'});
  assert.equal(check.status,crash.expectedHttp,JSON.stringify(check.data));assert.equal(check.data.code,crash.expectedCode);
  results.push({id:crash.id,status:'passed',http:check.status,code:check.data.code});
  const recovery=await buildExample(fixture.successExamples[0],examples);
  results.push({id:'cad-after-crash-recovery',status:'passed',example:recovery.example,triangles:recovery.triangles});

  const output={schemaVersion:1,verifiedAt:new Date().toISOString(),port,successExamples:successful,edgeCases:results,scope:{limitations:fixture.notCovered,realSmallModelRun:false,userVisualApproval:false,physicalPrint:false}};
  const resultFile=process.env.KODLA3D_FIXTURE_RESULTS?path.resolve(process.env.KODLA3D_FIXTURE_RESULTS):path.join(root,'docs','AI-FIXTURE-SONUCLARI.json');
  await writeFile(resultFile,JSON.stringify(output,null,2));
  console.log(JSON.stringify({status:'passed',successExamples:successful.length,edgeCases:results.length,smallFeatureProbe:results.find(item=>item.id===tiny.id),gridOverflow:results.find(item=>item.id===overflow.id)},null,2));
}finally{
  server.kill();await wait(250);await rm(runs,{recursive:true,force:true});
}
