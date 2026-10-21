import { PNG } from 'pngjs';
import { decodeReferenceImage, maskFromBilevel, maskFromColorKey, maskFromPolygon } from './reference-mask.js';
import { renderSilhouette } from './mesh-views.js';

const bounds = mask => {
  let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1,count=0;
  for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.data[y*mask.width+x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;}
  if(!count)throw new Error('Referans maskesinde model pikseli bulunamadı.');
  return {minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1,count,cx:(minX+maxX+1)/2,cy:(minY+maxY+1)/2};
};
export function buildReferenceMask(ref){
  if(ref?.poligon){const p=ref.poligon;return {width:p.width,height:p.height,data:maskFromPolygon(p.width,p.height,p.noktalar)};}
  const encoded=ref?.maske ?? ref?.gorsel;
  if(typeof encoded!=='string'||encoded.length>36_000_000)throw new Error('referans.maske veya referans.gorsel base64 PNG/JPEG olmalı.');
  const bytes=Buffer.from(encoded.replace(/^data:image\/(?:png|jpeg|jpg);base64,/i,''),'base64');
  const image=decodeReferenceImage(bytes);
  const data=ref.maske!==undefined?maskFromBilevel(image,ref.esik?{threshold:ref.esik,invert:!!ref.ters}:{invert:!!ref.ters}):maskFromColorKey(image,{threshold:ref.anahtar?.esik ?? 48});
  return {width:image.width,height:image.height,data};
}
function shiftMask(mask,dx,dy){
  const w=mask.width,h=mask.height,out=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask.data[y*w+x]){const tx=x+dx,ty=y+dy;if(tx>=0&&tx<w&&ty>=0&&ty<h)out[ty*w+tx]=1;}
  return out;
}
function distanceField(mask,w,h){
  const inf=1e9,d=new Float32Array(w*h);for(let i=0;i<d.length;i++)d[i]=mask[i]?0:inf;
  const rt=Math.SQRT2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x)d[i]=Math.min(d[i],d[i-1]+1);if(y){d[i]=Math.min(d[i],d[i-w]+1);if(x)d[i]=Math.min(d[i],d[i-w-1]+rt);if(x+1<w)d[i]=Math.min(d[i],d[i-w+1]+rt);}}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x+1<w)d[i]=Math.min(d[i],d[i+1]+1);if(y+1<h){d[i]=Math.min(d[i],d[i+w]+1);if(x+1<w)d[i]=Math.min(d[i],d[i+w+1]+rt);if(x)d[i]=Math.min(d[i],d[i+w-1]+rt);}}
  return d;
}
function edgePixels(mask,w,h){const edge=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!mask[i])continue;if(!x||!y||x===w-1||y===h-1||!mask[i-1]||!mask[i+1]||!mask[i-w]||!mask[i+w])edge.push(i);}return edge;}
function edgeMetrics(a,b,w,h){const ea=edgePixels(a,w,h),eb=edgePixels(b,w,h),edgeA=new Uint8Array(w*h),edgeB=new Uint8Array(w*h);for(const i of ea)edgeA[i]=1;for(const i of eb)edgeB[i]=1;const da=distanceField(edgeA,w,h),db=distanceField(edgeB,w,h),dist=[];for(const i of ea)dist.push(db[i]);for(const i of eb)dist.push(da[i]);dist.sort((x,y)=>x-y);return {mean:dist.reduce((s,v)=>s+v,0)/Math.max(1,dist.length),p95:dist[Math.min(dist.length-1,Math.floor((dist.length-1)*.95))]};}
function pngMask(mask,w,h,kind){const png=new PNG({width:w,height:h});for(let i=0;i<mask.length;i++){const p=i*4,yes=!!mask[i];if(kind==='overlay'){png.data[p]=yes?255:0;png.data[p+1]=yes?0:255;png.data[p+2]=0;png.data[p+3]=yes?130:100;}else{png.data[p]=png.data[p+1]=png.data[p+2]=yes?255:0;png.data[p+3]=255;}}return PNG.sync.write(png);}
export function compareReference(stl,ref,camera,scale){
  const reference=buildReferenceMask(ref),rb=bounds(reference);
  let mmPerPx=scale?.mmPerPx;
  if(mmPerPx===undefined&&Number.isFinite(scale?.genislikMm))mmPerPx=scale.genislikMm/rb.width;
  if(mmPerPx===undefined&&Number.isFinite(scale?.yukseklikMm))mmPerPx=scale.yukseklikMm/rb.height;
  if(!Number.isFinite(mmPerPx)||mmPerPx<=0||mmPerPx>10000)throw new Error('olcek.mmPerPx veya olcek.genislikMm pozitif bir ölçü olmalı.');
  const model={width:reference.width,height:reference.height,data:renderSilhouette(stl,{camera,width:reference.width,height:reference.height,fit:{mmPerPx}})};
  const mb=bounds(model),dx=Math.round(rb.cx-mb.cx),dy=Math.round(rb.cy-mb.cy),aligned=shiftMask(model,dx,dy),extra=new Uint8Array(aligned.length),missing=new Uint8Array(aligned.length);
  let intersection=0,union=0,modelCount=0;
  for(let i=0;i<aligned.length;i++){const m=!!aligned[i],r=!!reference.data[i];if(m)modelCount++;if(m&&r)intersection++;if(m||r)union++;if(m&&!r)extra[i]=1;if(r&&!m)missing[i]=1;}
  const overlay=new PNG({width:reference.width,height:reference.height});
  for(let i=0;i<aligned.length;i++){const p=i*4,m=!!aligned[i],r=!!reference.data[i],same=m&&r;overlay.data[p]=same?145:m?255:0;overlay.data[p+1]=same?145:r?255:0;overlay.data[p+2]=same?145:0;overlay.data[p+3]=m||r?185:0;}
  const fazlaPng=pngMask(extra,reference.width,reference.height,'mask').toString('base64'),eksikPng=pngMask(missing,reference.width,reference.height,'mask').toString('base64');
  return {width:reference.width,height:reference.height,iou:union?intersection/union:1,kenarMesafesiPx:edgeMetrics(reference.data,aligned,reference.width,reference.height),fazla:{mimeType:'image/png',encoding:'base64',data:fazlaPng},eksik:{mimeType:'image/png',encoding:'base64',data:eksikPng},fazlaPng,eksikPng,overlayPng:PNG.sync.write(overlay).toString('base64'),alignmentPx:{x:dx,y:dy},mmPerPx,referencePixels:rb.count,modelPixels:modelCount};
}
