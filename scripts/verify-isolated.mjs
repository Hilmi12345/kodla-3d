import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2);
const mode=args[0]?.startsWith('--')?args.shift():null;
const script=args.shift();
if(!script)throw new Error('Usage: node scripts/verify-isolated.mjs [--self-server|--horse-v2] scripts/verify-*.mjs [args...]');
const temp=await mkdtemp(path.join(os.tmpdir(),'kodla3d-verify-'));
const runs=path.join(temp,'runs'),outputs=path.join(temp,'outputs');
await Promise.all([mkdir(runs,{recursive:true}),mkdir(outputs,{recursive:true})]);
async function freePort(){
 const probe=net.createServer();
 await new Promise((resolve,reject)=>probe.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=probe.address().port;
 await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
 return port;
}
const port=await freePort(),base=`http://127.0.0.1:${port}`;
const env={...process.env,KODLA3D_PORT:String(port),KODLA3D_RUNS_DIR:runs,KODLA3D_OUTPUT_ROOT:outputs,KODLA3D_URL:base,KODLA3D_FIXTURE_RESULTS:path.join(temp,'AI-FIXTURE-SONUCLARI.json')};
function run(file,extra=[]){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[file,...extra],{cwd:root,env,stdio:'inherit',windowsHide:true});
  child.once('error',reject);
  child.once('exit',code=>code===0?resolve():reject(new Error(`${path.basename(file)} failed with exit code ${code}`)));
 });
}
let server=null;
async function startServer(){
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:'ignore',windowsHide:true});
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw new Error(`Isolated server exited early (${server.exitCode}).`);
  try{const response=await fetch(`${base}/api/health`);if(response.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error(`Isolated server did not start at ${base}.`);
}
try{
 if(mode==='--horse-v2'){
  await run('scripts/create-at-kafasi-v2.mjs');
  await run('scripts/verify-at-kafasi-v2.mjs');
 }else if(mode==='--exchange-reopen'){
  await startServer();
  await run('scripts/create-at-kafasi-v2.mjs');
  await run(script,args);
 }else if(mode==='--glb'){
  const file=path.join(temp,'verify-fixture.glb');
  const document={asset:{version:'2.0'},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36,target:34962}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],nodes:[{mesh:0,scale:[0.001,0.001,0.001]}],scenes:[{nodes:[0]}],scene:0};
  const json=Buffer.from(JSON.stringify(document));
  const jsonPadding=(4-json.length%4)%4,bin=Buffer.alloc(36),total=12+8+json.length+jsonPadding+8+bin.length;
  const bytes=Buffer.alloc(total);bytes.write('glTF',0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(total,8);let offset=12;bytes.writeUInt32LE(json.length+jsonPadding,offset);bytes.writeUInt32LE(0x4e4f534a,offset+4);json.copy(bytes,offset+8);bytes.fill(0x20,offset+8+json.length,offset+8+json.length+jsonPadding);offset+=8+json.length+jsonPadding;bytes.writeUInt32LE(bin.length,offset);bytes.writeUInt32LE(0x004e4942,offset+4);bin.copy(bytes,offset+8);
  await import('node:fs/promises').then(fs=>fs.writeFile(file,bytes));
  await run(script,[file,...args]);
 }else{
  if(mode!=='--self-server')await startServer();
  await run(script,args);
 }
}finally{
 if(server){server.kill();await new Promise(resolve=>setTimeout(resolve,250));}
 await rm(temp,{recursive:true,force:true});
}

