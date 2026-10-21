import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

const base=process.env.KODLA3D_URL??`http://127.0.0.1:${process.env.KODLA3D_PORT??8765}`;
function twoPagePdf(){
  const first='0 0 0 rg 10 10 80 60 re f',second='0 0 0 rg 20 15 60 50 re f';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 80] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${first.length} >>\nstream\n${first}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 80] /Resources << >> /Contents 6 0 R >>',
    `<< /Length ${second.length} >>\nstream\n${second}\nendstream`,
  ];
  let pdf='%PDF-1.4\n',offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,'ascii'));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf,'ascii');pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,'ascii');
}
const pdf=twoPagePdf();
const response=await fetch(`${base}/api/reference/pdf-page?page=2&scale=1.5`,{method:'POST',headers:{'content-type':'application/pdf'},body:pdf});
assert.equal(response.status,200,await response.clone().text());
assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('x-pdf-page-count'),'2');assert.equal(response.headers.get('x-pdf-page'),'2');
const png=PNG.sync.read(Buffer.from(await response.arrayBuffer()));assert.equal(png.width,150);assert.equal(png.height,120);
// Mimics a user tracing the PDF technical drawing by hand on the rendered page.
const referans={poligon:{width:png.width,height:png.height,noktalar:[[15,15],[135,15],[135,105],[15,105]]}};
const contourResponse=await fetch(`${base}/api/reference/contour`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({referans,yon:'on',olcek:{genislikMm:80},toleransMm:.5})});
const contour=await contourResponse.json();assert.equal(contourResponse.status,200,JSON.stringify(contour));assert.equal(contour.kapali,true);assert.ok(contour.noktalar.length>=4);assert.ok(contour.profilLoft&&contour.profilSupur&&contour.profilDondur);
const code=`return profilSupur({ad:'pdf-reference-fixture',profil:${JSON.stringify(contour.noktalar)},yol:[[0,0,0],[6,0,0]]});`;
const buildResponse=await fetch(`${base}/api/build`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,mode:'cad',quality:'normal'})});
const build=await buildResponse.json();assert.equal(buildResponse.status,200,JSON.stringify(build));const runId=build.files?.stl?.match(/\/api\/files\/([a-f0-9]{32})\/model\.stl/)?.[1];assert.ok(runId,'built STL run id');
const compareResponse=await fetch(`${base}/api/compare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId,referans,kamera:{direction:[0,-1,0],up:[0,0,1]},olcek:{genislikMm:80}})});
const comparison=await compareResponse.json();assert.equal(compareResponse.status,200,JSON.stringify(comparison));assert.ok(Number.isFinite(comparison.iou));
console.log(JSON.stringify({status:'passed',selectedPage:2,pdfPages:2,png:[png.width,png.height],manualPolygonPoints:referans.poligon.noktalar.length,contourPoints:contour.noktalar.length,profile:['loft','sweep','revolve'],runId,iou:comparison.iou}));
