import assert from 'node:assert/strict';
import { decodeReferenceImage, maskFromBilevel, maskFromColorKey, maskFromPolygon } from '../src/reference-mask.js';
import pngjs from 'pngjs';
import jpeg from 'jpeg-js';

const { PNG }=pngjs,width=800,height=600,rgba=Buffer.alloc(width*height*4),binary=Buffer.alloc(width*height*4);
const polygon=[[120,100],[680,100],[680,200],[320,200],[320,500],[120,500]];
let expectedPixels=0;
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const inside=(x>=120&&x<680&&y>=100&&y<200)||(x>=120&&x<320&&y>=200&&y<500);
  const offset=(y*width+x)*4,photo=inside?[45,55,62]:[238,232,215],mask=inside?[255,255,255]:[0,0,0];
  rgba.set([...photo,255],offset);binary.set([...mask,255],offset);if(inside)expectedPixels++;
}
const photoPng=PNG.sync.write({width,height,data:rgba}),maskPng=PNG.sync.write({width,height,data:binary});
const photo=decodeReferenceImage(photoPng),readyMask=decodeReferenceImage(maskPng),fromBilevel=maskFromBilevel(readyMask),fromColorKey=maskFromColorKey(photo,{threshold:40}),fromPolygon=maskFromPolygon(width,height,polygon);
const count=mask=>mask.reduce((sum,value)=>sum+value,0),intersection=(a,b)=>a.reduce((sum,value,index)=>sum+(value&&b[index]?1:0),0);
function iou(a,b){const common=intersection(a,b);return common/(count(a)+count(b)-common);}
for(const [name,mask] of [['ready PNG',fromBilevel],['corner color key',fromColorKey],['polygon',fromPolygon]]){
  assert.ok(mask instanceof Uint8Array&&mask.length===width*height,`${name}: Uint8Array boyutu`);
  assert.ok(iou(fromBilevel,mask)>=0.98,`${name}: IoU ${iou(fromBilevel,mask)}`);
}
assert.equal(count(fromBilevel),expectedPixels);
assert.equal(count(fromPolygon),expectedPixels);
assert.equal(iou(fromBilevel,fromColorKey),1);
const jpegBytes=jpeg.encode({width,height,data:rgba},100).data,jpegImage=decodeReferenceImage(jpegBytes),jpegMask=maskFromColorKey(jpegImage,{threshold:56}),jpegIou=iou(fromBilevel,jpegMask);
assert.ok(jpegImage.width===width&&jpegImage.height===height);
assert.ok(jpegIou>=0.98,`JPEG color-key IoU ${jpegIou}`);
assert.throws(()=>decodeReferenceImage(Buffer.from('not an image')),/PNG veya JPEG/);
assert.throws(()=>maskFromPolygon(width,height,[[0,0],[10,10]]),/en az 3/);
console.log(JSON.stringify({status:'passed',fixture:'800x600 generated L silhouette',expectedPixels,readyMaskPixels:count(fromBilevel),colorKeyPixels:count(fromColorKey),polygonPixels:count(fromPolygon),jpegIoU:Number(jpegIou.toFixed(5)),pngBytes:photoPng.length,jpegBytes:jpegBytes.length}));
