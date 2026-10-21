import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { renderSilhouette } from '../src/mesh-views.js';

function boxStl(width,depth,height){
  const x=width/2,y=depth/2,z=height/2;
  const p=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
  const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  const triangles=faces.flatMap(([a,b,c,d])=>[[p[a],p[b],p[c]],[p[a],p[c],p[d]]]);
  const stl=Buffer.alloc(84+triangles.length*50);stl.writeUInt32LE(triangles.length,80);
  triangles.forEach((triangle,index)=>triangle.forEach((point,vertex)=>point.forEach((value,axis)=>stl.writeFloatLE(value,84+index*50+12+vertex*12+axis*4))));
  return stl;
}
const count=mask=>mask.reduce((sum,value)=>sum+value,0);
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function pngChunk(name,data){const type=Buffer.from(name),chunk=Buffer.alloc(12+data.length);chunk.writeUInt32BE(data.length,0);type.copy(chunk,4);data.copy(chunk,8);chunk.writeUInt32BE(crc32(chunk.subarray(4,8+data.length)),8+data.length);return chunk;}
async function savePreview(mask,width,height,file){
  const raw=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++){const row=y*(1+width*4);raw[row]=0;for(let x=0;x<width;x++){const value=mask[y*width+x]?20:255,offset=row+1+x*4;raw.fill(value,offset,offset+3);raw[offset+3]=255;}}
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  await writeFile(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]));
}
const stl=boxStl(80,50,25);
const front=renderSilhouette(stl,{camera:'front',width:400,height:400});
if(process.env.KODLA3D_SILHOUETTE_PREVIEW)await savePreview(front,400,400,process.env.KODLA3D_SILHOUETTE_PREVIEW);
const frontPixels=count(front),expectedFrontPixels=400*200;
assert.equal(front.length,400*400);
assert.ok(Math.abs(frontPixels-expectedFrontPixels)<=expectedFrontPixels*0.01,`önden piksel=${frontPixels}, beklenen=${expectedFrontPixels}`);
assert.ok(front.every(value=>value===0||value===1));

const scaled=renderSilhouette(stl,{camera:'front',width:400,height:400,fit:{mmPerPx:0.5}});
const scaledPixels=count(scaled),expectedScaledPixels=(50/0.5)*(25/0.5);
assert.ok(Math.abs(scaledPixels-expectedScaledPixels)<=expectedScaledPixels*0.01,`ölçekli piksel=${scaledPixels}, beklenen=${expectedScaledPixels}`);
const free=renderSilhouette(stl,{camera:{direction:[0,0,1],up:[0,1,0]},width:400,height:400,fit:{mmPerPx:0.25}});
const freePixels=count(free),expectedFreePixels=(80/0.25)*(50/0.25);
assert.ok(Math.abs(freePixels-expectedFreePixels)<=expectedFreePixels*0.01,`serbest kamera piksel=${freePixels}, beklenen=${expectedFreePixels}`);
for(const camera of ['front','back','right','left','top','iso'])assert.ok(count(renderSilhouette(stl,{camera}))>0,`${camera} maskesi boş olmamalı`);
assert.throws(()=>renderSilhouette(stl,{camera:{direction:[1,0,0],up:[2,0,0]}}),/paralel/);
assert.throws(()=>renderSilhouette(stl,{width:0}),/boyutu/);
console.log(JSON.stringify({status:'passed',fixture:'80x50x25 mm box',frontPixels,expectedFrontPixels,relativeError:Number((Math.abs(frontPixels-expectedFrontPixels)/expectedFrontPixels).toFixed(6)),scaledPixels,freePixels,cameras:6}));
