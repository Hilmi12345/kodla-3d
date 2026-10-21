const key=(x,y)=>`${x},${y}`;
function area(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1];}return sum/2;}
function simplify(points,tolerance){
  if(points.length<=3)return points;
  const open=[...points,points[0]],keep=new Uint8Array(open.length);keep[0]=keep[open.length-1]=1;const stack=[[0,open.length-1]],tol2=tolerance*tolerance;
  while(stack.length){const [start,end]=stack.pop(),a=open[start],b=open[end],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let best=-1,bestD=tol2;
    for(let i=start+1;i<end;i++){const p=open[i],t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0,d=(p[0]-(a[0]+t*dx))**2+(p[1]-(a[1]+t*dy))**2;if(d>bestD){bestD=d;best=i;}}
    if(best>=0){keep[best]=1;stack.push([start,best],[best,end]);}
  }
  const result=open.slice(0,-1).filter((_,i)=>keep[i]);return result.length>=3?result:points.slice(0,3);
}
/** Extracts the longest closed 0.5-level cell contour from a binary reference mask. */
export function contourFromMask(width,height,mask,{mmPerPx=1,toleranceMm=0.5}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height!==mask?.length)throw new Error('Kontur maskesi boyutu tutarsız.');
  if(!Number.isFinite(mmPerPx)||mmPerPx<=0||!Number.isFinite(toleranceMm)||toleranceMm<0)throw new Error('Kontur ölçeği ve toleransı geçersiz.');
  const segments=[],sample=(x,y)=>x<0||y<0||x>=width||y>=height?0:mask[y*width+x]?1:0;
  const edgePoint=(edge,gx,gy)=>edge==='N'?[gx+1,gy+.5]:edge==='E'?[gx+1.5,gy+1]:edge==='S'?[gx+1,gy+1.5]:[gx+.5,gy+1];
  const cases={1:[['N','W']],2:[['N','E']],3:[['W','E']],4:[['E','S']],5:[['N','W'],['E','S']],6:[['N','S']],7:[['W','S']],8:[['S','W']],9:[['N','S']],10:[['N','E'],['S','W']],11:[['E','S']],12:[['W','E']],13:[['N','E']],14:[['N','W']]};
  for(let gy=-1;gy<height;gy++)for(let gx=-1;gx<width;gx++){
    const code=sample(gx,gy)|sample(gx+1,gy)<<1|sample(gx+1,gy+1)<<2|sample(gx,gy+1)<<3;
    if(cases[code])for(const [a,b] of cases[code])segments.push([edgePoint(a,gx,gy),edgePoint(b,gx,gy)]);
  }
  const edges=new Map(),add=(a,item)=>{const k=key(...a);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(item);};segments.forEach(([a,b],id)=>{add(a,{id,to:b});add(b,{id,to:a});});const used=new Set();
  const loops=[];
  while(used.size<segments.length){let initial;for(const [k,items] of edges){const item=items.find(edge=>!used.has(edge.id));if(item){initial={k,item};break;}}if(!initial)break;const start=initial.k.split(',').map(Number),loop=[start];let current=start,item=initial.item,guard=0;
    while(guard++<=segments.length+1){used.add(item.id);current=item.to;if(key(...current)===key(...start))break;loop.push(current);item=edges.get(key(...current))?.find(edge=>!used.has(edge.id));if(!item)break;}
    if(loop.length>=3&&key(...current)===key(...start))loops.push(loop);
  }
  if(!loops.length)throw new Error('Referans maskesinden kapalı kontur çıkarılamadı.');
  loops.sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));const outer=loops[0];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const [x,y] of outer){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,scaled=outer.map(([x,y])=>[(x-cx)*mmPerPx,(cy-y)*mmPerPx]),points=simplify(scaled,toleranceMm);
  return {noktalar:points,kapali:true,alanMm2:Math.abs(area(points)),cevreMm:points.reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]),0),noktaSayisi:points.length,hamNoktaSayisi:outer.length,olcek:{mmPerPx,toleransMm:toleranceMm},boundingBoxMm:{width:(maxX-minX)*mmPerPx,height:(maxY-minY)*mmPerPx}};
}
