import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = path.join(root, 'model-worker.mjs');
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'kodla3d-t11-sweep-'));
async function run(name, source) {
  const folder = path.resolve(tempRoot, name);
  if (path.dirname(folder) !== tempRoot) throw new Error('Sweep fixture escaped its temporary test folder.');
  await mkdir(folder);
  await writeFile(path.join(folder, 'model.js'), source, 'utf8');
  await writeFile(path.join(folder, 'parameters.json'), '{}', 'utf8');
  const child = spawnSync(process.execPath, [worker, folder, 'cad', 'normal'], { cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(child.error, undefined, `${name}: ${child.error?.message}`);
  assert.equal(child.status, 0, `${name}: ${child.stderr}`);
  return JSON.parse(await readFile(path.join(folder, 'result.json'), 'utf8'));
}

try {
  const good = await run('valid', "return profilSupur({ad:'U profilli dirsek',profil:[[-4,-3],[4,-3],[4,3],[-4,3]],yol:[[0,0,0],[0,0,20],[10,0,30]],gecis:'round'});");
  assert.equal(good.ok, true, JSON.stringify(good));
  assert.equal(good.geometryType, 'cad');
  assert.equal(good.solids, 1);
  assert.deepEqual(good.formats, ['stl', 'step', 'js']);
  assert.ok(good.volume > 0 && good.mesh.triangles > 0);
  assert.ok(good.size.every(value => Number.isFinite(value) && value > 0));
  const folder = path.join(tempRoot, 'valid');
  const stl = await readFile(path.join(folder, 'model.stl'));
  const step = await readFile(path.join(folder, 'model.step'));
  assert.equal(stl.readUInt32LE(80), good.mesh.triangles);
  assert.equal(stl.length, 84 + good.mesh.triangles * 50);
  assert.match(step.toString('ascii', 0, 40), /ISO-10303/);

  const loft = await run('loft', "return profilLoft({ad:'Trapez gecis',kesitler:[{z:0,noktalar:[[-8,-6],[8,-6],[8,6],[-8,6]]},{z:10,noktalar:[[-5,-4],[5,-4],[7,4],[-7,4]]},{z:24,noktalar:[[-3,-2],[3,-2],[4,2],[-4,2]]}]});");
  assert.equal(loft.ok, true, JSON.stringify(loft));
  assert.equal(loft.solids, 1);
  assert.ok(Math.abs(loft.size[2] - 24) < 0.05 && loft.volume > 0);
  assert.deepEqual(loft.formats, ['stl', 'step', 'js']);

  const bad = await run('invalid', "return profilSupur({profil:[[-1,-1],[1,-1],[1,1],[-1,1]],yol:[[0,0,0],[0,0,10],[0,0,10]]});");
  assert.equal(bad.ok, false);
  assert.match(bad.error, /sıfır uzunluklu segment/);
  console.log(JSON.stringify({ status: 'passed', sweep: { size: good.size, volume: good.volume, solids: good.solids, triangles: good.mesh.triangles, stepBytes: good.fileSizes.step }, loft: { size: loft.size, volume: loft.volume, solids: loft.solids }, invalid: bad.error }));
} finally {
  if (path.dirname(path.resolve(tempRoot)) !== path.resolve(os.tmpdir())) throw new Error('Refusing to remove test data outside the OS temporary directory.');
  await rm(tempRoot, { recursive: true, force: true });
}
