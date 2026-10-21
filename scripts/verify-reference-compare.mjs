import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { renderSilhouette } from '../src/mesh-views.js';

const base=process.env.KODLA3D_URL??`http://127.0.0.1:${process.env.KODLA3D_PORT??8765}`;
const runs=path.resolve(process.env.KODLA3D_RUNS_DIR??'.runtime/runs');
const id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',folder=path.join(runs,id);
const triangles=[
 [[0,0,0],[80,0,0],[80,50,0]],[[0,0,0],[80,50,0],[0,50,0]],
 [[0,0,25],[80,50,25],[80,0,25]],[[0,0,25],[0,50,25],[80,50,25]],
 [[0,0,0],[0,50,0],[0,50,25]],[[0,0,0],[0,50,25],[0,0,25]],
 [[80,0,0],[80,0,25],[80,50,25]],[[80,0,0],[80,50,25],[80,50,0]],
 [[0,0,0],[0,0,25],[80,0,25]],[[0,0,0],[80,0,25],[80,0,0]],
 [[0,50,0],[80,50,25],[0,50,25]],[[0,50,0],[80,50,0],[80,50,25]]
];
function makeStl(){const out=Buffer.alloc(84+triangles.length*50);out.write('reference compare fixture');out.writeUInt32LE(triangles.length,80);triangles.forEach((t,i)=>{const at=84+i*50;for(let v=0;v<3;v++)for(let a=0;a<3;a++)out.writeFloatLE(0,at+a*4);for(let v=0;v<3;v++)for(let a=0;a<3;a++)out.writeFloatLE(t[v][a],at+12+v*12+a*4);});return out;}
await mkdir(folder,{recursive:true});const stl=makeStl();await writeFile(path.join(folder,'model.stl'),stl);
try{
 const width=400,height=400,mask=renderSilhouette(stl,{camera:'front',width,height,fit:{mmPerPx:.2}}),png=new PNG({width,height});
 for(let i=0;i<mask.length;i++){const p=i*4,v=mask[i]?255:0;png.data[p]=png.data[p+1]=png.data[p+2]=v;png.data[p+3]=255;}
 await writeFile(path.join(runs,'reference-upload-fixture.png'),PNG.sync.write(png));
 const data=PNG.sync.write(png).toString('base64'),body={runId:id,referans:{maske:data},kamera:'front',olcek:{mmPerPx:.2}};
 const res=await fetch(`${base}/api/compare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await res.json();
 assert.equal(res.status,200,JSON.stringify(result));assert.ok(result.iou>=.99,`self IoU ${result.iou} pixels ${result.modelPixels}/${result.referencePixels} align ${JSON.stringify(result.alignmentPx)}`);assert.ok(result.kenarMesafesiPx.mean<.1,`edge ${JSON.stringify(result.kenarMesafesiPx)} iou ${result.iou} pixels ${result.modelPixels}/${result.referencePixels} align ${JSON.stringify(result.alignmentPx)}`);assert.ok(result.overlayPng.length>100);assert.equal(result.fazla.mimeType,'image/png');assert.equal(result.eksik.mimeType,'image/png');assert.equal(result.fazla.encoding,'base64');assert.ok(result.fazlaPng.length>100&&result.eksikPng.length>100);assert.equal(result.modelPixels,result.referencePixels);
 const fromCode=await fetch(`${base}/api/compare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:"return kutu({ad:'reference-api-box',genislik:80,derinlik:50,yukseklik:25});",mode:'cad',referans:{maske:data},kamera:'front',olcek:{mmPerPx:.2}})}),codeResult=await fromCode.json();assert.equal(fromCode.status,200,JSON.stringify(codeResult));assert.ok(codeResult.iou>=.99,`code+mode self IoU ${codeResult.iou}`);
 const cached=await(await fetch(`${base}/api/compare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).json();assert.equal(cached.cacheHit,true);
 const larger=await(await fetch(`${base}/api/compare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,olcek:{mmPerPx:.2/1.1}})})).json();assert.ok(larger.iou<result.iou-.05,`10% overscale IoU ${larger.iou}`);assert.ok(larger.modelPixels>result.modelPixels);assert.ok(Buffer.from(larger.fazlaPng,'base64').length>100);
 await writeFile(path.join(runs,'reference-compare-overlay.png'),Buffer.from(result.overlayPng,'base64'));
 console.log(JSON.stringify({status:'passed',fixture:'80x50x25 mm box',selfIoU:result.iou,selfEdgeMeanPx:result.kenarMesafesiPx.mean,codeModeIoU:codeResult.iou,overscale10IoU:larger.iou,overscaleModelPixels:larger.modelPixels,expectedModelPixels:result.modelPixels,cacheHit:cached.cacheHit,visualArtifact:path.join(runs,'reference-compare-overlay.png')}));
}finally{await rm(folder,{recursive:true,force:true});}
