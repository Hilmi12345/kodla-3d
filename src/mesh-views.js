import { deflateSync } from 'node:zlib';

const cameras=[
  {id:'front',direction:[1,0,0],up:[0,0,1]},
  {id:'back',direction:[-1,0,0],up:[0,0,1]},
  {id:'right',direction:[0,1,0],up:[0,0,1]},
  {id:'left',direction:[0,-1,0],up:[0,0,1]},
  {id:'top',direction:[0,0,1],up:[0,1,0]},
  {id:'iso',direction:[1,-1.5,1.1],up:[0,0,1]}
];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function pngChunk(type,data){const name=Buffer.from(type);const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,8+data.length)),8+data.length);return out;}
function encodePng(width,height,rgba){const raw=Buffer.alloc(height*(1+width*4));for(let y=0;y<height;y++){const row=y*(1+width*4);raw[row]=0;Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(raw,row+1);}const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(raw,{level:6})),pngChunk('IEND',Buffer.alloc(0))]);}

export function renderSixViewsPng(stl,{tileWidth=240,tileHeight=180,maxTriangles=750000}={}){
  const input=Buffer.from(stl);
  if(input.length<84)throw new Error('Görünüş renderer: STL başlığı eksik.');
  const count=input.readUInt32LE(80);
  if(input.length!==84+count*50)throw new Error('Görünüş renderer: STL üçgen tablosu tutarsız.');
  if(!count||count>maxTriangles)throw new Error(`Görünüş renderer üçgen sınırı: ${count}/${maxTriangles}.`);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<count;i++)for(let v=0;v<3;v++)for(let a=0;a<3;a++){const x=input.readFloatLE(84+i*50+12+v*12+a*4);if(!Number.isFinite(x))throw new Error('Görünüş renderer sonlu olmayan koordinat gördü.');min[a]=Math.min(min[a],x);max[a]=Math.max(max[a],x);}
  const center=min.map((x,i)=>(x+max[i])/2),corners=[];
  for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])corners.push([x,y,z]);
  const tileStrideY=tileHeight+24,width=tileWidth*3,height=tileStrideY*2;
  const sheet=new Uint8Array(width*height*4);for(let i=0;i<sheet.length;i+=4){sheet[i]=245;sheet[i+1]=246;sheet[i+2]=241;sheet[i+3]=255;}
  const light=normalize([0.3,-0.4,0.85]);
  for(let viewIndex=0;viewIndex<cameras.length;viewIndex++){
    const camera=cameras[viewIndex],forward=normalize(camera.direction),right=normalize(cross(camera.up,forward)),up=normalize(cross(forward,right));
    const projected=corners.map(p=>{const d=p.map((x,i)=>x-center[i]);return[dot(d,right),dot(d,up)];});
    const minX=Math.min(...projected.map(p=>p[0])),maxX=Math.max(...projected.map(p=>p[0])),minY=Math.min(...projected.map(p=>p[1])),maxY=Math.max(...projected.map(p=>p[1]));
    const scale=Math.min((tileWidth-20)/Math.max(maxX-minX,1e-9),(tileHeight-20)/Math.max(maxY-minY,1e-9));
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const pixels=new Uint8Array(tileWidth*tileHeight*4),depth=new Float32Array(tileWidth*tileHeight);depth.fill(-Infinity);for(let p=0;p<pixels.length;p+=4){pixels[p]=245;pixels[p+1]=246;pixels[p+2]=241;pixels[p+3]=255;}
    for(let i=0;i<count;i++){
      const offset=84+i*50,vertices=[];
      for(let v=0;v<3;v++){const p=[input.readFloatLE(offset+12+v*12),input.readFloatLE(offset+16+v*12),input.readFloatLE(offset+20+v*12)],d=p.map((x,a)=>x-center[a]);vertices.push({x:tileWidth/2+(dot(d,right)-cx)*scale,y:tileHeight/2-(dot(d,up)-cy)*scale,z:dot(d,forward)});}
      const [a,b,c]=vertices,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(area)<1e-8)continue;
      const ux=input.readFloatLE(offset+24)-input.readFloatLE(offset+12),uy=input.readFloatLE(offset+28)-input.readFloatLE(offset+16),uz=input.readFloatLE(offset+32)-input.readFloatLE(offset+20);
      const vx=input.readFloatLE(offset+36)-input.readFloatLE(offset+12),vy=input.readFloatLE(offset+40)-input.readFloatLE(offset+16),vz=input.readFloatLE(offset+44)-input.readFloatLE(offset+20);
      const normal=normalize([uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx]);
      const shade=0.28+0.72*Math.abs(dot(normal,light)),color=[Math.round(164*shade),Math.round(101*shade),Math.round(72*shade)];
      const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(tileWidth-1,Math.ceil(Math.max(a.x,b.x,c.x)));
      const y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(tileHeight-1,Math.ceil(Math.max(a.y,b.y,c.y)));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const px=x+0.5,py=y+0.5,w0=((b.x-px)*(c.y-py)-(b.y-py)*(c.x-px))/area,w1=((c.x-px)*(a.y-py)-(c.y-py)*(a.x-px))/area,w2=1-w0-w1;
        if(w0 < -1e-6||w1 < -1e-6||w2 < -1e-6)continue;
        const z=w0*a.z+w1*b.z+w2*c.z,index=y*tileWidth+x;if(z<=depth[index])continue;depth[index]=z;
        const p=index*4;pixels[p]=color[0];pixels[p+1]=color[1];pixels[p+2]=color[2];pixels[p+3]=255;
      }
    }
    const column=viewIndex%3,row=Math.floor(viewIndex/3),x0=column*tileWidth,y0=row*tileStrideY;
    for(let y=0;y<tileHeight;y++)sheet.set(pixels.subarray(y*tileWidth*4,(y+1)*tileWidth*4),(y0+y)*width*4+x0*4);
  }
  return {bytes:encodePng(width,height,sheet),width,height,cameras:cameras.map(camera=>camera.id),triangles:count,renderer:'Kodla3D CPU orthographic raster v1'};
}

const cameraById=Object.fromEntries(cameras.map(camera=>[camera.id,camera]));
function readStlTriangles(stl){
  const input=Buffer.from(stl);
  if(input.length<84)throw new Error('Silüet renderer: STL başlığı eksik.');
  const count=input.readUInt32LE(80);
  if(input.length!==84+count*50)throw new Error('Silüet renderer: STL üçgen tablosu tutarsız.');
  if(!count||count>750000)throw new Error(`Silüet renderer üçgen sınırı: ${count}/750000.`);
  const triangles=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<count;i++){
    const offset=84+i*50,triangle=[];
    for(let v=0;v<3;v++){
      const point=[0,1,2].map(axis=>input.readFloatLE(offset+12+v*12+axis*4));
      if(!point.every(Number.isFinite))throw new Error('Silüet renderer sonlu olmayan koordinat gördü.');
      point.forEach((value,axis)=>{min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);});
      triangle.push(point);
    }
    triangles.push(triangle);
  }
  return {triangles,min,max};
}
function resolveCamera(camera){
  const selected=typeof camera==='string'?cameraById[camera]:camera;
  if(!selected||!Array.isArray(selected.direction)||!Array.isArray(selected.up)||selected.direction.length!==3||selected.up.length!==3||![...selected.direction,...selected.up].every(Number.isFinite))throw new Error('Kamera, yön/up vektörlü bilinen bir görünüş veya serbest kamera olmalı.');
  const forward=normalize(selected.direction),rightVector=cross(selected.up,forward),rightLength=Math.hypot(...rightVector);
  if(rightLength<1e-9)throw new Error('Kamera yönü ve up vektörü paralel olamaz.');
  const right=rightVector.map(value=>value/rightLength),up=normalize(cross(forward,right));
  return {forward,right,up};
}

/** Binary STL üçgenlerinden derinlikten bağımsız ikili görünür siluet üretir. */
export function renderSilhouette(stl,{camera='front',width=400,height=400,fit='bounds'}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>16_777_216)throw new Error('Silüet boyutu pozitif tam sayı olmalı; eksen başına en fazla 4096 ve toplam 16.777.216 piksel.');
  const {triangles,min,max}=readStlTriangles(stl),basis=resolveCamera(camera),center=min.map((value,axis)=>(value+max[axis])/2);
  const corners=[];
  for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])corners.push([x,y,z]);
  const projectedCorners=corners.map(point=>{const delta=point.map((value,axis)=>value-center[axis]);return [dot(delta,basis.right),dot(delta,basis.up)];});
  const minX=Math.min(...projectedCorners.map(point=>point[0])),maxX=Math.max(...projectedCorners.map(point=>point[0]));
  const minY=Math.min(...projectedCorners.map(point=>point[1])),maxY=Math.max(...projectedCorners.map(point=>point[1]));
  const extentX=maxX-minX,extentY=maxY-minY;
  let pixelsPerMm;
  if(fit==='bounds')pixelsPerMm=Math.min(width/Math.max(extentX,1e-9),height/Math.max(extentY,1e-9));
  else if(fit&&typeof fit==='object'&&Number.isFinite(fit.mmPerPx)&&fit.mmPerPx>0)pixelsPerMm=1/fit.mmPerPx;
  else throw new Error("fit 'bounds' veya pozitif mmPerPx içeren nesne olmalı.");
  const projectedCenterX=(minX+maxX)/2,projectedCenterY=(minY+maxY)/2,mask=new Uint8Array(width*height);
  for(const triangle of triangles){
    const points=triangle.map(point=>{const delta=point.map((value,axis)=>value-center[axis]);return {x:width/2+(dot(delta,basis.right)-projectedCenterX)*pixelsPerMm,y:height/2-(dot(delta,basis.up)-projectedCenterY)*pixelsPerMm};});
    const [a,b,c]=points,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    if(Math.abs(area)<1e-12)continue;
    const x0=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x)-0.5)),x1=Math.min(width-1,Math.floor(Math.max(a.x,b.x,c.x)-0.5));
    const y0=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y)-0.5)),y1=Math.min(height-1,Math.floor(Math.max(a.y,b.y,c.y)-0.5));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const px=x+0.5,py=y+0.5,w0=((b.x-px)*(c.y-py)-(b.y-py)*(c.x-px))/area,w1=((c.x-px)*(a.y-py)-(c.y-py)*(a.x-px))/area,w2=1-w0-w1;
      if(w0>=-1e-9&&w1>=-1e-9&&w2>=-1e-9)mask[y*width+x]=1;
    }
  }
  return mask;
}
