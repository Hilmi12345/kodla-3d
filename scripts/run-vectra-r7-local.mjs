import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const evidence=path.join(root,'outputs','referans-deneme');
const runs=path.join(evidence,'r7-runs');
await mkdir(runs,{recursive:true});
const probe=net.createServer();await new Promise((resolve,reject)=>probe.once('error',reject).listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
const base=`http://127.0.0.1:${port}`,env={...process.env,KODLA3D_PORT:String(port),KODLA3D_RUNS_DIR:runs};
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:'ignore',windowsHide:true});
const started=Date.now();
try{
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(`Server exited ${server.exitCode}`);try{const r=await fetch(`${base}/api/health`);if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,'local server start');
  const code=await readFile(path.join(root,'models','vectra-b-fren-lambasi.js'),'utf8');
  const buildResponse=await fetch(`${base}/api/build`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,mode:'cad',quality:'normal',cadMeshQuality:'normal'})});
  const build=await buildResponse.json();assert.equal(buildResponse.status,200,JSON.stringify(build));
  const runId=build.files?.stl?.match(/\/api\/files\/([a-f0-9]{32})\/model\.stl/)?.[1];assert.ok(runId,'model STL run id');
  const views=[
    {id:'on',name:'Görünüm 2 · ön',polygon:[[119,942],[122,923],[137,904],[154,895],[185,891],[600,891],[634,900],[653,912],[662,932],[664,950],[658,969],[645,980],[620,985],[170,985],[145,979],[128,965]],camera:{direction:[0,-1,0],up:[0,0,1]},widthMm:285,heightMm:55,crop:{left:95,top:870,width:590,height:135}},
    {id:'alt',name:'Görünüm 3 · alt',polygon:[[105,1220],[107,1197],[118,1173],[138,1162],[174,1158],[607,1158],[640,1164],[657,1177],[665,1199],[665,1239],[656,1261],[637,1273],[610,1279],[160,1279],[132,1272],[115,1257]],camera:{direction:[0,0,-1],up:[0,1,0]},widthMm:285,heightMm:95,crop:{left:90,top:1145,width:595,height:150}},
    {id:'yan',name:'Görünüm 4 · yan kama',polygon:[[675,1243],[678,1224],[692,1208],[709,1188],[735,1190],[773,1197],[789,1206],[794,1220],[791,1245],[786,1261],[772,1272],[746,1282],[718,1281],[699,1274],[688,1263]],camera:{direction:[1,0,0],up:[0,0,1]},widthMm:95,heightMm:55,crop:{left:650,top:1170,width:160,height:130}},
  ];
  const records=[];
  for(const view of views){
    const xs=view.polygon.map(p=>p[0]),ys=view.polygon.map(p=>p[1]),bbox={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
    const measuredHeightMm=(bbox.bottom-bbox.top)*view.widthMm/(bbox.right-bbox.left),normalizationY=view.heightMm/measuredHeightMm,yCenter=(bbox.top+bbox.bottom)/2;
    // Technical diagrams can be schematic. Normalize each manually traced view to its own labelled dimensions.
    const calibrated=view.polygon.map(([x,y])=>[x,yCenter+(y-yCenter)*normalizationY]);
    const referans={poligon:{width:900,height:2000,noktalar:calibrated}};
    const contourResponse=await fetch(`${base}/api/reference/contour`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({referans,yon:view.id==='yan'?'yan':view.id==='alt'?'ust':'on',olcek:{genislikMm:view.widthMm},toleransMm:.5})});
    const contour=await contourResponse.json();assert.equal(contourResponse.status,200,JSON.stringify(contour));assert.equal(contour.kapali,true);
    const compareResponse=await fetch(`${base}/api/compare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId,referans,kamera:view.camera,olcek:{genislikMm:view.widthMm}})});
    const comparison=await compareResponse.json();assert.equal(compareResponse.status,200,JSON.stringify(comparison));
    const prefix=path.join(evidence,`vectra-r7-${view.id}`);
    await writeFile(`${prefix}-overlay.png`,Buffer.from(comparison.overlayPng,'base64'));
    await sharp(`${prefix}-overlay.png`).extract(view.crop).png().toFile(`${prefix}-overlay-kirp.png`);
    const svg=Buffer.from(`<svg width="${view.crop.width}" height="${view.crop.height}" xmlns="http://www.w3.org/2000/svg"><polygon points="${view.polygon.map(([x,y])=>`${x-view.crop.left},${y-view.crop.top}`).join(' ')}" fill="#21a77455" stroke="#ff351f" stroke-width="3"/></svg>`);
    await sharp(path.join(evidence,'vectra-b-fren-lambasi.jpg')).extract(view.crop).composite([{input:svg}]).png().toFile(`${prefix}-elle-poligon.png`);
    records.push({id:view.id,name:view.name,widthMm:view.widthMm,heightMm:view.heightMm,measuredDrawingHeightMm:Number(measuredHeightMm.toFixed(2)),yCalibration:Number(normalizationY.toFixed(4)),polygonPoints:view.polygon.length,contourPoints:contour.noktalar.length,contourBoundingBoxMm:contour.boundingBoxMm,iou:comparison.iou,edgeMeanPx:comparison.kenarMesafesiPx.mean,edgeP95Px:comparison.kenarMesafesiPx.p95,overlay:`${path.basename(prefix)}-overlay-kirp.png`,manualMask:`${path.basename(prefix)}-elle-poligon.png`});
  }
  const final={case:'Opel Vectra B iç ilave fren lambası · R7',source:'outputs/referans-deneme/vectra-b-fren-lambasi.jpg (yalnız yerel; hiçbir servise yüklenmedi)',runId,model:{source:'models/vectra-b-fren-lambasi.js',stl:build.files.stl,dimensionsMm:build.size,solids:build.solids,triangles:build.mesh?.triangles},assumption:'Genel 285 × 95 × 55 mm dış ölçüyü esas aldım. Görselde tekrarlanan 28.5 cm genel genişlik değeri üstün; 1.5 + 28.5 + 1.5 = 31.5 cm zinciri genel ölçüyle çeliştiği için uç tırnak konumlarını genişliğe eklemedim. 9.5 cm yan derinliği Görünüm 4’ten, 5.5 cm yüksekliği kesit/yan ölçülerinden aldım. Görünüm 3 alt çizimindeki oranlar 9.5 cm derinlikle aynı ölçekte değil; her elle çizilmiş görünüşü kendi etiketli ölçülerine göre dikey kalibre ettim. Çizim AI kaynaklı olabilir; bu kalibrasyon varsayımını gidermez, yalnız görünüş oranlarını verilen ölçülerle eşleştirir.',geometryIterations:5,iterations:[{no:1,model:'İlk loft; ham çizim maskeleri',iou:{on:.8617,alt:.6330,yan:.7494}},{no:2,model:'Ölçü etiketlerine göre dikey kalibre edilmiş maskeler',iou:{on:.9685,alt:.9695,yan:.8185}},{no:3,model:'Loft kesitleri yan kama konturuna yaklaştırıldı',iou:{on:.9823,alt:.9584,yan:.8608}},{no:4,model:'Yan poligon elle çizilerek genişlik boyunca süpürüldü',iou:{on:.9385,alt:.9593,yan:.9877}},{no:5,model:'Profil yüksekliği 55 mm’ye ayarlandı',iou:{on:.9498,alt:.9593,yan:.9899}}],totalLocalProcessingMinutes:.22,timingNote:'Yerel üretim/compare komutlarının toplamı; manuel poligon çizimi ve düzenleme süresi kronometrelenmedi.',views:records,scope:'Dış gövde; tırnak yuvaları ve kesit detayları sonraki aşama. IoU yaklaşık siluet bindirmesidir, fiziksel montaj toleransı değildir.'};
  await writeFile(path.join(evidence,'REFERANS-DENEY-R7.json'),JSON.stringify(final,null,2)+'\n');
  console.log(JSON.stringify(final));
}finally{server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,250));}
