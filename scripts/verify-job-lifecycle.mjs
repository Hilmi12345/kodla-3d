import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = 18769 + Math.floor(Math.random() * 1000);
const runs = await mkdtemp(path.join(os.tmpdir(), 'kodla3d-job-life-'));
const server = spawn(process.execPath, ['server.mjs'], { cwd:root, env:{ ...process.env, KODLA3D_PORT:String(port), KODLA3D_RUNS_DIR:runs, KODLA3D_WORKER_TIMEOUT_MS:'3500' }, stdio:['ignore','pipe','pipe'], windowsHide:true });
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
const base = `http://127.0.0.1:${port}`;
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
async function untilHealthy() {
  for (let attempt=0; attempt<100; attempt++) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
      serverOutput += `health=${response.status} ${await response.text()} `;
    } catch (error) { serverOutput += `${error.message} `; }
    await wait(100);
  }
  throw new Error(`Isolated job test server did not start. ${serverOutput}`);
}
function runCli(args) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/kodla3d.mjs',...args],{cwd:root,env:{...process.env,KODLA3D_URL:base},stdio:['ignore','pipe','pipe'],windowsHide:true});
    let stdout='',stderr=''; child.stdout.on('data',chunk=>stdout+=chunk); child.stderr.on('data',chunk=>stderr+=chunk);
    child.on('error',reject); child.on('exit',code=>code===0?resolve({stdout,stderr}):reject(new Error(`CLI exited ${code}: ${stderr} ${stdout}`)));
  });
}
try {
  await untilHealthy();
  const health=await(await fetch(`${base}/api/health`)).json();
  assert.equal(health.ok,true);
  assert.equal(health.service,'Kodla 3D');
  assert.match(health.nodeVersion,/^v\d+\.\d+\.\d+$/);
  assert.match(health.rootId,/^[a-f0-9]{16}$/);
  assert.equal(health.dependencies['replicad-opencascadejs'],'1.1.0');
  const examples=await(await fetch(`${base}/api/examples`)).json();
  assert.ok(examples.some(example=>example.name==='kutu'&&example.mode==='cad'));
  const v2Example=examples.find(example=>example.name==='at-kafasi-v2'&&example.mode==='cad');
  assert.ok(v2Example?.parameterSchema?.parameters.some(parameter=>parameter.id==='yanakDolgunlugu'));
  const syntaxFailure=await fetch(`${base}/api/build`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:crypto.randomUUID(),mode:'cad',quality:'normal',code:'return {'})});
  const syntaxError=await syntaxFailure.json();
  assert.equal(syntaxFailure.status,422);
  assert.equal(syntaxError.errorCode,'MODEL_SYNTAX_ERROR');
  assert.ok(Number.isInteger(syntaxError.sourceLine));
  assert.match(syntaxError.sourceHash,/^[a-f0-9]{64}$/);
  const parameterFailure=await fetch(`${base}/api/build`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:crypto.randomUUID(),mode:'cad',quality:'normal',example:'at-kafasi',parameters:{kulakUzunlugu:500},code:'return null;'})});
  const parameterError=await parameterFailure.json();
  assert.equal(parameterFailure.status,400);
  assert.equal(parameterError.code,'INVALID_REQUEST');
  assert.equal(parameterError.context.parameterPath,'kulakUzunlugu');
  const v2ParameterFailure=await fetch(`${base}/api/build`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:crypto.randomUUID(),mode:'cad',quality:'normal',example:'at-kafasi-v2',parameters:{yanakDolgunlugu:17},code:'return null;'})});
  const v2ParameterError=await v2ParameterFailure.json();
  assert.equal(v2ParameterFailure.status,400);
  assert.equal(v2ParameterError.context.parameterPath,'yanakDolgunlugu');
  const cancelledId = crypto.randomUUID();
  const cancelledBuild = fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:cancelledId, mode:'cad', quality:'normal', code:'while (true) {}' }) });
  await wait(1500);
  const running = await (await fetch(`${base}/api/jobs/${cancelledId}`)).json();
  assert.equal(running.status,'running');
  assert.ok(running.stage);
  const cancel = await fetch(`${base}/api/jobs/${cancelledId}`, {method:'DELETE'});
  assert.equal(cancel.status,200);
  const cancelledResponse = await cancelledBuild;
  assert.equal(cancelledResponse.status,409);
  assert.equal((await (await fetch(`${base}/api/jobs/${cancelledId}`)).json()).status,'cancelled');

  const code = `const model = kutu({ ad: 'job-recovery', genislik: 30, derinlik: 20, yukseklik: 10 });\nreturn model;`;
  const recovered = await fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:crypto.randomUUID(), mode:'cad', quality:'normal', code }) });
  const result = await recovered.json();
  assert.equal(recovered.status,200,JSON.stringify(result));
  assert.equal(result.job.status,'completed');
  assert.equal(result.cache.hit,false);
  assert.ok(result.profile.phasesMs.stlMeshingAndExport >= 0);
  assert.equal(result.visual.format,'png');
  assert.equal(result.visual.width,720);
  assert.equal(result.visual.height,408);
  assert.deepEqual(result.visual.cameras,['front','back','right','left','top','iso']);
  const visualResponse=await fetch(`${base}${result.files.visual}`);
  assert.equal(visualResponse.status,200);
  const visualBytes=Buffer.from(await visualResponse.arrayBuffer());
  assert.deepEqual([...visualBytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(visualBytes.readUInt32BE(16),result.visual.width);
  assert.equal(visualBytes.readUInt32BE(20),result.visual.height);

  const repeated = await fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:crypto.randomUUID(), mode:'cad', quality:'normal', code }) });
  const cachedResult = await repeated.json();
  assert.equal(repeated.status,200);
  assert.equal(cachedResult.cache.hit,true);
  const stlResponse = await fetch(`${base}${cachedResult.files.stl}`);
  assert.equal(stlResponse.status,200);
  assert.equal((await stlResponse.arrayBuffer()).byteLength,cachedResult.fileSizes.stl);
  const cachedVisualBytes=Buffer.from(await(await fetch(`${base}${cachedResult.files.visual}`)).arrayBuffer());
  assert.deepEqual(cachedVisualBytes,visualBytes,'Cache hit preserves the exact fixed-view PNG bytes.');
  const cacheStats = await (await fetch(`${base}/api/cache/stats`)).json();
  assert.equal(cacheStats.hits,1);
  assert.equal(cacheStats.entries,1);
  const qualityChange = await fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:crypto.randomUUID(), mode:'cad', quality:'taslak', code }) });
  const qualityResult = await qualityChange.json();
  assert.equal(qualityChange.status,200);
  assert.equal(qualityResult.cache.hit,true,'The SDF quality field does not change CAD geometry or its fixed meshing tolerances.');

  const timeoutId = crypto.randomUUID();
  const timedBuild = await fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:timeoutId, mode:'cad', quality:'normal', code:'while (true) {}' }) });
  assert.equal(timedBuild.status,408);
  assert.equal((await (await fetch(`${base}/api/jobs/${timeoutId}`)).json()).status,'timed-out');
  const timeoutRecoveryCode = `const model = kutu({ ad: 'job-after-timeout', genislik: 31, derinlik: 20, yukseklik: 10 });\nreturn model;`;
  const recoveredAgain = await fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:crypto.randomUUID(), mode:'cad', quality:'normal', code:timeoutRecoveryCode }) });
  assert.equal(recoveredAgain.status,200);
  assert.equal((await recoveredAgain.json()).job.status,'completed');

  const crashId = crypto.randomUUID();
  const crashed = await fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:crashId, mode:'cad', quality:'normal', code:'process.exit(7);' }) });
  assert.equal(crashed.status,500);
  assert.equal((await (await fetch(`${base}/api/jobs/${crashId}`)).json()).status,'failed');
  const crashRecoveryCode = `const model = kutu({ ad: 'job-after-crash', genislik: 32, derinlik: 20, yukseklik: 10 });\nreturn model;`;
  const recoveredAfterCrash = await fetch(`${base}/api/build`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId:crypto.randomUUID(), mode:'cad', quality:'normal', code:crashRecoveryCode }) });
  assert.equal(recoveredAfterCrash.status,200);
  assert.equal((await recoveredAfterCrash.json()).job.status,'completed');
  const cliOut=path.join(runs,'cli-output');
  const cliResult=JSON.parse((await runCli(['build','--file',path.join(root,'models','kutu.js'),'--out',cliOut])).stdout);
  assert.equal(cliResult.ok,true);
  assert.ok(cliResult.savedFiles.some(file=>file.endsWith('model.stl')));
  assert.ok(cliResult.savedFiles.some(file=>file.endsWith('views.png')));
  console.log('API/CLI verified: structured errors, polling/cancel/timeout/crash recovery, cache PNG identity, quality invalidation, and file downloads.');
} finally {
  server.kill();
  await wait(250);
  await rm(runs,{recursive:true,force:true});
}
