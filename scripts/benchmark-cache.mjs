import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = 17769 + Math.floor(Math.random()*1000);
const runs = await mkdtemp(path.join(os.tmpdir(),'kodla3d-cache-bench-'));
const server = spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,KODLA3D_PORT:String(port),KODLA3D_RUNS_DIR:runs},stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs=''; server.stdout.on('data',b=>logs+=b.toString()); server.stderr.on('data',b=>logs+=b.toString());
const base=`http://127.0.0.1:${port}`;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  let healthy=false;
  for(let i=0;i<100;i++) { try { healthy=(await fetch(`${base}/api/health`)).ok; if(healthy) break; } catch {} await wait(100); }
  assert.ok(healthy,`Benchmark server failed to start. ${logs}`);
  const code=`const model = kutu({ ad: 'cache-benchmark', genislik: 30, derinlik: 20, yukseklik: 10 });\nreturn model;`;
  const samples=[];
  let expectedHash=null, expectedSize=null;
  for(let run=0;run<5;run++) {
    const started=performance.now();
    const response=await fetch(`${base}/api/build`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:crypto.randomUUID(),mode:'cad',quality:'normal',code})});
    const wallMs=performance.now()-started;
    const result=await response.json();
    assert.equal(response.status,200,JSON.stringify(result));
    const stlResponse=await fetch(`${base}${result.files.stl}`);
    const bytes=Buffer.from(await stlResponse.arrayBuffer());
    const stlSha256=createHash('sha256').update(bytes).digest('hex');
    expectedHash ??= stlSha256; expectedSize ??= bytes.length;
    assert.equal(stlSha256,expectedHash,'Cache output STL hash must stay identical.');
    assert.equal(bytes.length,expectedSize);
    assert.equal(result.cache.hit,run>0);
    samples.push({run:run+1,cacheHit:result.cache.hit,wallMs,cacheRestoreMs:result.cache.restoreMs??null,workerMs:result.profile.workerTotalMs,stlBytes:bytes.length,stlSha256});
  }
  const sorted=samples.map(sample=>sample.wallMs).sort((a,b)=>a-b);
  const warmWall=samples.slice(1).map(sample=>sample.wallMs).sort((a,b)=>a-b);
  const report={generatedAt:new Date().toISOString(),method:'Five identical 30x20x10 mm CAD builds on an isolated local server; first worker run compared with four in-memory cache restorations. Wall time includes request/response and STL fetch+hash.',models:1,repeats:5,firstRunWallMs:samples[0].wallMs,warmMedianWallMs:warmWall[Math.floor(warmWall.length/2)],medianWallMs:sorted[2],samples,cacheStats:await(await fetch(`${base}/api/cache/stats`)).json()};
  const output=path.join(root,'docs','cache-benchmark.json');
  await writeFile(output,`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({output,medianWallMs:report.medianWallMs,samples:samples.map(s=>({run:s.run,cacheHit:s.cacheHit,wallMs:Math.round(s.wallMs),cacheRestoreMs:s.cacheRestoreMs,workerMs:Math.round(s.workerMs)}))},null,2));
} finally {
  server.kill(); await wait(250); await rm(runs,{recursive:true,force:true});
}
