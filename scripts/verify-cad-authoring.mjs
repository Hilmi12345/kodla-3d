import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.KODLA3D_PORT || 8765);
const base = `http://127.0.0.1:${port}`;
const outputRoot = process.env.KODLA3D_OUTPUT_ROOT ? path.resolve(process.env.KODLA3D_OUTPUT_ROOT) : path.join(root, 'outputs');
const out = path.join(outputRoot, 'cad-authoring');
await mkdir(out, { recursive: true });
async function build(name, code) {
  const response = await fetch(`${base}/api/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  const result = await response.json();
  assert.equal(response.status, 200, `${name}: ${JSON.stringify(result)}`);
  assert.ok(result.ok && result.geometryType === 'cad' && result.formats.includes('step'));
  const [stlResponse, stepResponse] = await Promise.all([fetch(base + result.files.stl), fetch(base + result.files.step)]);
  const stl = Buffer.from(await stlResponse.arrayBuffer());
  const step = Buffer.from(await stepResponse.arrayBuffer());
  assert.equal(stl.readUInt32LE(80), result.mesh.triangles);
  assert.equal(stl.length, 84 + result.mesh.triangles * 50);
  assert.match(step.toString('ascii', 0, 40), /ISO-10303/);
  const evidence = { name, sizeMm: result.size, volumeMm3: result.volume, solids: result.solids, faces: result.faces, triangles: result.mesh.triangles, stepBytes: step.length };
  await writeFile(path.join(out, `${name}.json`), JSON.stringify(evidence, null, 2));
  return { result, evidence };
}
async function reject(name, code, message) {
  const response = await fetch(`${base}/api/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  const result = await response.json();
  assert.equal(response.status, 422, `${name}: ${JSON.stringify(result)}`);
  assert.match(result.error || result.message || '', message, `${name} should explain its supported boundary`);
  return { name, status: response.status, error: result.error || result.message };
}
const loft = await build('dairesel-loft', `return daireselLoft({ad:'loft',kesitler:[{z:0,yaricap:10},{z:12,yaricap:12},{z:24,yaricap:7}]});`);
assert.ok(Math.abs(loft.result.size[2] - 24) < 0.05, 'loft height should equal z section span');
assert.ok(loft.result.volume > 0 && loft.result.solids === 1);
const revolved = await build('profil-dondur', `return profilDondur({ad:'donel',noktalar:[[0,0],[10,0],[10,3],[6,12],[6,18],[0,18]]});`);
assert.ok(Math.abs(revolved.result.size[2] - 18) < 0.05, 'revolve height should equal profile z span');
assert.ok(revolved.result.volume > 0 && revolved.result.solids === 1);
const transformed = await build('transform-pah', `const b=kutu({ad:'b',genislik:20,derinlik:10,yukseklik:5}); return b.dondur(90,'Z').pah(0.5);`);
assert.ok(Math.abs(transformed.result.size[0] - 10) < 0.1 && Math.abs(transformed.result.size[1] - 20) < 0.1, '90-degree transform should swap XY extents');
const mirrored = await build('ayna', `return kutu({genislik:20,derinlik:10,yukseklik:5}).ayna('YZ',[20,0,0]);`);
assert.ok(mirrored.result.size.every((value, index) => Math.abs(value - [20,10,5][index]) < 0.1));
const pattern = await build('dogrusal-desen', `return dogrusalDesen({parca:kutu({genislik:5,derinlik:5,yukseklik:5}),adet:3,aralik:[10,0,0]});`);
assert.equal(pattern.result.solids, 3, 'spaced pattern should remain three CAD solids');
assert.ok(Math.abs(pattern.result.volume - 375) < 0.001, 'pattern volume should equal the sum of its solids');
assert.ok(Math.abs(pattern.result.size[0] - 25) < 0.1);
const drilled = await build('delikli-aparat', `return kutu({ad:'braket',genislik:30,derinlik:20,yukseklik:5}).delik_ac(4,[[-8,0],[8,0]]);`);
assert.ok(drilled.result.volume < 30 * 20 * 5 && drilled.result.solids === 1);
const lidded = await build('kapakli-kutu', `const govde=kutu({ad:'govde',genislik:30,derinlik:20,yukseklik:15}).icini_bosalt(2);
const ust=kutu({ad:'ust',genislik:34,derinlik:24,yukseklik:2}).tasi(0,0,15.5);
const dil=kutu({ad:'dil',genislik:25.6,derinlik:15.6,yukseklik:2.2}).tasi(0,0,13.5);
const kapak=api.birlestir(ust,dil,'kapak');
return api.birlestir(govde,kapak,'govde_ve_kapak');`);
assert.equal(lidded.result.solids, 2, 'closed box and removable lid should remain two solids');
assert.ok(lidded.result.size.every((value, index) => Math.abs(value - [34,24,17.5][index]) < 0.1));
assert.ok(lidded.result.volume > 0);
// The server deliberately serializes jobs; run rejected requests sequentially.
const rejected = [];
rejected.push(await reject('loft-sirasiz-kesit', `return daireselLoft({kesitler:[{z:10,yaricap:5},{z:0,yaricap:5}]});`, /artan z sırası/));
rejected.push(await reject('acik-doner-profil', `return profilDondur({aci:180,noktalar:[[0,0],[5,0],[5,10],[0,10]]});`, /yalnız kapalı CAD katısı/));
rejected.push(await reject('yuvarlatma-baglam-hatasi', `return kutu({ad:'ince_plaka',genislik:10,derinlik:10,yukseklik:2}).yuvarlat(20);`, /Yuvarlatma 20 mm .*'ince_plaka'/));
rejected.push(await reject('bosaltma-baglam-hatasi', `return kutu({ad:'ince_govde',genislik:10,derinlik:10,yukseklik:2}).icini_bosalt(20);`, /İç boşaltma 20 mm duvarla 'ince_govde'/));
const report = { status: 'passed', generatedAt: new Date().toISOString(), server: base, evidence: [loft.evidence, revolved.evidence, transformed.evidence, mirrored.evidence, pattern.evidence, drilled.evidence, lidded.evidence], rejected };
await writeFile(path.join(out, 'DOGRULAMA.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

