import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base=process.env.KODLA3D_URL??`http://127.0.0.1:${process.env.KODLA3D_PORT??8765}`;
const docs=await readFile(path.join(root,'docs','HTTP-API.md'),'utf8');
assert.ok(docs.includes('/api/compare')&&docs.includes('/api/reference/contour'));
const curl=process.platform==='win32'?'curl.exe':'curl';
async function post(endpoint,fixture){
 const payload=await readFile(path.join(root,'scripts','fixtures',fixture),'utf8');
 const {stdout,stderr,code}=await new Promise((resolve,reject)=>{
  const child=spawn(curl,['--silent','--show-error','--write-out','\n%{http_code}','--request','POST',`${base}${endpoint}`,'-H','Content-Type: application/json','--data-binary',`@${path.join(root,'scripts','fixtures',fixture)}`],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.once('error',reject);child.once('exit',code=>resolve({stdout,stderr,code}));
 });
 assert.equal(code,0,stderr);const at=stdout.lastIndexOf('\n');const status=Number(stdout.slice(at+1));const result=JSON.parse(stdout.slice(0,at));assert.equal(status,200,JSON.stringify(result));return result;
}
const comparison=await post('/api/compare','reference-compare.json');
assert.ok(Number.isFinite(comparison.iou)&&comparison.iou>=0&&comparison.iou<=1);assert.ok(comparison.overlayPng.length>100);assert.ok(comparison.fazlaPng.length>100&&comparison.eksikPng.length>100);
const contour=await post('/api/reference/contour','reference-contour.json');
assert.equal(contour.kapali,true);assert.ok(contour.noktalar.length>=3);assert.ok(contour.profilLoft&&contour.profilSupur&&contour.profilDondur);
console.log(JSON.stringify({status:'passed',curl:true,compareIoU:comparison.iou,contourPoints:contour.noktalar.length,scale:contour.olcek}));
