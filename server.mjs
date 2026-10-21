import http from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat, rm, copyFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { validateParameterValues } from './src/parameter-schema.js';
import { MODEL_SCHEMA_VERSION, ORGANIC_API_VERSION } from './src/api-schema.js';
import { compareReference, buildReferenceMask } from './src/reference-compare.js';
import { contourFromMask } from './src/reference-contour.js';
import { renderPdfPage } from './src/pdf-reference.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.KODLA3D_PORT || 8765);
const RUNS = process.env.KODLA3D_RUNS_DIR ? path.resolve(process.env.KODLA3D_RUNS_DIR) : path.join(ROOT, '.runtime', 'runs');
const WORKER_TIMEOUT_MS = Number(process.env.KODLA3D_WORKER_TIMEOUT_MS || 60000);
await mkdir(RUNS, { recursive: true });
let busy = false;
const jobs = new Map();
const resultCache = new Map();
let cacheHits = 0, cacheMisses = 0;
let activeJob = null;
const compareCache = new Map();
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value;
const hash = value => createHash('sha256').update(value).digest('hex');
const fingerprintFiles = ['server.mjs','model-worker.mjs','src/model-api.js','src/organic-api.js','src/api-schema.js','src/mesh-report.js','src/mesh-views.js','src/parameter-schema.js','package-lock.json'];
const implementationHash = hash((await Promise.all(fingerprintFiles.map(file=>readFile(path.join(ROOT,file)))).then(buffers=>buffers.map(buffer=>buffer.toString('base64')))).join('|'));
const dependencyVersions = JSON.parse(await readFile(path.join(ROOT,'package.json'),'utf8')).dependencies;
const rootId = hash(path.resolve(ROOT).toLowerCase()).slice(0,16);
let referenceAssetHash = 'missing';
try { referenceAssetHash = hash(await readFile(path.join(ROOT,'outputs','at-kafasi','referans.jpg'))); } catch {}
function buildCacheKey(body, parameters) {
  // Sonucu etkilemeyen alanlar anahtara girmez: CAD'de SDF kalitesi, organikte CAD ag kalitesi, parametresiz istekte ornek adi
  const mode = body.mode ?? 'cad';
  return hash(JSON.stringify(stable({ code:body.code, mode, quality:mode === 'organic' ? body.quality ?? 'normal' : null, cadMeshQuality:mode === 'cad' ? body.cadMeshQuality ?? 'normal' : null, example:Object.keys(parameters ?? {}).length ? body.example ?? null : null, parameters, modelSchemaVersion:MODEL_SCHEMA_VERSION, organicApiVersion:ORGANIC_API_VERSION, dependencyVersions, implementationHash, referenceAssetHash })));
}
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(body)); }
function publicJob(job) { return { id:job.id, status:job.status, stage:job.stage, elapsedMs:Date.now()-job.startedAt, phasesMs:job.phasesMs || {} }; }
function apiError(error, job = null, source = '') {
  const status = error.status || 500;
  const code = status === 408 ? 'WORKER_TIMEOUT' : status === 409 ? (job?.status === 'cancelled' ? 'BUILD_CANCELLED' : 'BUILD_BUSY') : status === 413 ? 'INPUT_TOO_LARGE' : status === 422 ? (Number.isInteger(error.sourceLine) ? 'MODEL_SYNTAX_ERROR' : 'GEOMETRY_BUILD_FAILED') : status === 400 ? 'INVALID_REQUEST' : status === 500 && /motoru durdu|worker/i.test(error.message) ? 'WORKER_CRASHED' : 'SERVER_ERROR';
  return { error:error.message || String(error), code, detail:error.stack || String(error), sourceLine:error.sourceLine ?? null, sourceColumn:error.sourceColumn ?? null, context:{ jobId:job?.id ?? null, stage:job?.stage ?? null, sourceHash:source ? hash(source) : null, parameterPath:error.parameterPath ?? null, part:error.part ?? null, operation:error.operation ?? null } };
}
function fail(res,status,code,message,extra={}) { return json(res,status,{ error:message, code, ...extra }); }
function runWorker(folder, mode, quality, cadMeshQuality, job) {
  return new Promise((resolve, reject) => {
    const log = createWriteStream(path.join(folder, 'worker.log'), { flags:'w' });
    log.on('error',() => {});
    const maxLogBytes = 1024 * 1024;
    let logBytes = 0, logTruncated = false;
    const appendLog = chunk => {
      if (logBytes < maxLogBytes) {
        const allowed = chunk.subarray(0,maxLogBytes-logBytes);
        logBytes += allowed.length;
        if (allowed.length) log.write(allowed);
      }
      if (logBytes >= maxLogBytes && !logTruncated) { logTruncated = true; log.write('\n[worker log 1 MiB sınırında kesildi]\n'); }
    };
    const progressPath = path.join(folder, 'progress.json');
    const child = spawn(process.execPath, [path.join(ROOT, 'model-worker.mjs'), folder, mode, quality, job.id, progressPath, cadMeshQuality], { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data',appendLog); child.stderr.on('data',appendLog);
    job.child = child;
    let expired = false, cancelled = false;
    const progressTimer = setInterval(async () => {
      try {
        const progress = JSON.parse(await readFile(progressPath, 'utf8'));
        if (progress.jobId === job.id) { job.stage = progress.stage; job.phasesMs = progress.phasesMs; }
      } catch {}
    }, 120);
    const timer = setTimeout(() => {
      expired = true;
      job.status = 'timed-out'; job.stage = 'zaman aşımı';
      child.kill('SIGKILL');
    }, WORKER_TIMEOUT_MS);
    job.cancel = () => {
      if (job.status !== 'running') return false;
      cancelled = true; job.status = 'cancelled'; job.stage = 'iptal edildi';
      child.kill('SIGKILL');
      return true;
    };
    child.on('error', error => { clearTimeout(timer); clearInterval(progressTimer); log.end(); reject(error); });
    child.on('exit', code => {
      clearTimeout(timer); clearInterval(progressTimer); job.child = null; job.cancel = null; log.end();
      if (expired) reject(Object.assign(new Error('Model 60 saniyede tamamlanamadı.'), {status:408}));
      else if (cancelled) reject(Object.assign(new Error('Üretim kullanıcı tarafından iptal edildi.'), {status:409}));
      else resolve(code);
    });
  });
}

async function handler(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok:true, service:'Kodla 3D', engine:'OpenCascade WASM', version:'0.1.0', nodeVersion:process.version, rootId, dependencies:dependencyVersions });
  if (req.method === 'GET' && url.pathname === '/api/cache/stats') return json(res,200,{ entries:resultCache.size, maxEntries:8, bytes:[...resultCache.values()].reduce((total,entry)=>total+entry.byteSize,0), hits:cacheHits, misses:cacheMisses, implementationHash, referenceAssetHash });
  if (req.method === 'POST' && url.pathname === '/api/compare') {
    const origin=req.headers.origin,allowedOrigins=[`http://127.0.0.1:${PORT}`,`http://localhost:${PORT}`,'http://127.0.0.1:5173'];
    if(origin&&!allowedOrigins.includes(origin))return fail(res,403,'LOCAL_ORIGIN_ONLY','Yalnız yerel uygulamadan istek kabul edilir.');
    if(req.headers['content-type']?.split(';')[0]!=='application/json')return fail(res,415,'JSON_REQUIRED','JSON gerekli.');
    let data;
    try{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>36*1024*1024)throw Object.assign(new Error('Karşılaştırma isteği en fazla 36 MiB olabilir.'),{status:413});chunks.push(chunk);}data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
    catch(error){return fail(res,error.status||400,error.status===413?'INPUT_TOO_LARGE':'INVALID_JSON',error.message||'Geçersiz JSON.');}
    try{
      if(!data?.referans||(!data.runId&&typeof data.code!=='string'))return fail(res,400,'COMPARE_INPUT_REQUIRED','runId veya code+mode ve referans gerekli.');
      let stl,runId=data.runId;
      if(runId!==undefined){if(typeof runId!=='string'||!/^[a-f0-9]{32}$/i.test(runId))return fail(res,400,'INVALID_RUN_ID','runId geçersiz.');stl=await readFile(path.join(RUNS,runId,'model.stl'));}
      else{
        const build=await fetch(`http://127.0.0.1:${PORT}/api/build`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:data.code,mode:data.mode??'cad',quality:data.quality,cadMeshQuality:data.cadMeshQuality,example:data.example,parameters:data.parameters})});
        const result=await build.json();if(!build.ok)return json(res,build.status,result);
        runId=result.files?.stl?.match(/^\/api\/files\/([a-f0-9]{32})\/model\.stl$/)?.[1];if(!runId)return fail(res,422,'STL_NOT_AVAILABLE','Üretim sonucu karşılaştırılabilir STL içermiyor.');stl=await readFile(path.join(RUNS,runId,'model.stl'));
      }
      const key=hash(Buffer.concat([stl,Buffer.from(JSON.stringify(stable({referans:data.referans,kamera:data.kamera??'front',olcek:data.olcek})))]));
      if(compareCache.has(key)){const result=compareCache.get(key);compareCache.delete(key);compareCache.set(key,result);return json(res,200,{...result,runId,cacheHit:true});}
      const result=compareReference(stl,data.referans,data.kamera??'front',data.olcek);result.runId=runId;result.cacheHit=false;result.cacheKey=key;compareCache.set(key,result);while(compareCache.size>8)compareCache.delete(compareCache.keys().next().value);return json(res,200,result);
    }catch(error){return fail(res,error.status||400,error.status===413?'INPUT_TOO_LARGE':'COMPARE_FAILED',error.message||'Karşılaştırma başarısız.');}
  }
  if(req.method==='POST'&&url.pathname==='/api/reference/contour'){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')return fail(res,415,'JSON_REQUIRED','JSON gerekli.');let data;
    try{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>36*1024*1024)throw Object.assign(new Error('Kontur isteği en fazla 36 MiB olabilir.'),{status:413});chunks.push(chunk);}data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(error){return fail(res,error.status||400,error.status===413?'INPUT_TOO_LARGE':'INVALID_JSON',error.message||'Geçersiz JSON.');}
    try{const ref=buildReferenceMask(data.referans),rb=ref.data.reduce((sum,v)=>sum+v,0);if(!rb)return fail(res,422,'EMPTY_REFERENCE_MASK','Referans maskesi boş.');let mmPerPx=data.olcek?.mmPerPx;if(mmPerPx===undefined&&Number.isFinite(data.olcek?.genislikMm)){let min=ref.width,max=-1;for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++)if(ref.data[y*ref.width+x]){min=Math.min(min,x);max=Math.max(max,x);}mmPerPx=data.olcek.genislikMm/(max-min+1);}if(mmPerPx===undefined&&Number.isFinite(data.olcek?.yukseklikMm)){let min=ref.height,max=-1;for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++)if(ref.data[y*ref.width+x]){min=Math.min(min,y);max=Math.max(max,y);}mmPerPx=data.olcek.yukseklikMm/(max-min+1);}const kontur=contourFromMask(ref.width,ref.height,ref.data,{mmPerPx,toleranceMm:data.toleransMm??.5});return json(res,200,{...kontur,yon:data.yon??'on',profilLoft:{kesitler:[{z:0,noktalar:kontur.noktalar},{z:1,noktalar:kontur.noktalar}]},profilSupur:{profil:kontur.noktalar},profilDondur:{noktalar:kontur.noktalar.map(([x,y])=>[Math.abs(x),y])}});}catch(error){return fail(res,400,'CONTOUR_FAILED',error.message||'Kontur çıkarılamadı.');}
  }
  if(req.method==='POST'&&url.pathname==='/api/reference/pdf-page'){
    const origin=req.headers.origin,allowedOrigins=[`http://127.0.0.1:${PORT}`,`http://localhost:${PORT}`,'http://127.0.0.1:5173'];
    if(origin&&!allowedOrigins.includes(origin))return fail(res,403,'LOCAL_ORIGIN_ONLY','Yalnız yerel uygulamadan istek kabul edilir.');
    if(req.headers['content-type']?.split(';')[0]!=='application/pdf')return fail(res,415,'PDF_REQUIRED','application/pdf gerekli.');
    let pdf;
    try{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>25*1024*1024)throw Object.assign(new Error('PDF en fazla 25 MiB olabilir.'),{status:413,code:'INPUT_TOO_LARGE'});chunks.push(chunk);}pdf=Buffer.concat(chunks);}
    catch(error){return fail(res,error.status||400,error.code||'INVALID_PDF',error.message||'PDF okunamadı.');}
    try{const page=Number(url.searchParams.get('page')||1),scale=Number(url.searchParams.get('scale')||1.5),result=await renderPdfPage(pdf,page,scale);res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-PDF-Page':String(result.pageNumber),'X-PDF-Page-Count':String(result.pageCount),'X-Image-Width':String(result.width),'X-Image-Height':String(result.height)});return res.end(result.png);}
    catch(error){return fail(res,error.status||400,error.code||'PDF_RENDER_FAILED',error.message||'PDF sayfası PNG’ye çevrilemedi.');}
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
    const job = jobs.get(url.pathname.slice('/api/jobs/'.length));
    return job ? json(res,200,publicJob(job)) : json(res,404,{error:'İş bulunamadı.'});
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/jobs/')) {
    const job = jobs.get(url.pathname.slice('/api/jobs/'.length));
    if (!job) return json(res,404,{error:'İş bulunamadı.'});
    if (job.status !== 'running' || !job.cancel?.()) return json(res,409,{error:'Bu iş artık iptal edilebilir durumda değil.',job:publicJob(job)});
    return json(res,200,publicJob(job));
  }
  if (req.method === 'GET' && url.pathname === '/api/reference/at-kafasi') {
    try {
      const image = await readFile(path.join(ROOT, 'outputs', 'at-kafasi', 'referans.jpg'));
      res.writeHead(200, {'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end(image);
    } catch { return json(res, 404, {error:'Yerel at kafası referansı bulunamadı.'}); }
  }
  if (req.method === 'GET' && url.pathname === '/api/examples') {
    const names = (await readdir(path.join(ROOT, 'models'))).filter(n => n.endsWith('.js')).sort();
    return json(res, 200, await Promise.all(names.map(async name => {
      const id = name.slice(0, -3);
      let parameterSchema = null;
      try { parameterSchema = JSON.parse(await readFile(path.join(ROOT, 'models', `${id}.parameters.json`), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      return { name:id, mode:name.startsWith('organik-')?'organic':'cad', code:await readFile(path.join(ROOT,'models',name),'utf8'), parameterSchema };
    })));
  }
  if (req.method === 'POST' && url.pathname === '/api/build') {
    const origin = req.headers.origin;
    const allowedOrigins = [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, 'http://127.0.0.1:5173'];
    if (origin && !allowedOrigins.includes(origin)) return fail(res,403,'LOCAL_ORIGIN_ONLY','Yalnız yerel uygulamadan istek kabul edilir.');
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return fail(res,415,'JSON_REQUIRED','JSON gerekli.');
    if (busy) return fail(res,409,'BUILD_BUSY','Bir model üretiliyor. Bitmesini bekle.',{job:activeJob ? publicJob(activeJob) : null});
    if (Number(req.headers['content-length']) > 100000) return fail(res,413,'INPUT_TOO_LARGE','Kod en fazla 100 KB olabilir.');
    busy = true;
    const job = { id:randomUUID(), status:'running', stage:'istek doğrulama', startedAt:Date.now(), phasesMs:{} };
    activeJob = job; jobs.set(job.id, job);
    while (jobs.size > 30) jobs.delete(jobs.keys().next().value);
    let body;
    try {
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 100000) throw Object.assign(new Error('Kod en fazla 100 KB olabilir.'), {status:413}); chunks.push(chunk); }
      const data = Buffer.concat(chunks).toString('utf8');
      try { body = JSON.parse(data); } catch { return fail(res,400,'INVALID_JSON','Geçersiz JSON.'); }
      if (typeof body?.jobId === 'string' && /^[a-f0-9-]{36}$/i.test(body.jobId)) {
        jobs.delete(job.id); job.id = body.jobId; jobs.set(job.id,job);
      }
      if (typeof body?.code !== 'string' || !body.code.trim()) return fail(res,400,'MODEL_CODE_REQUIRED','Model kodu boş olamaz.');
      const mode = body.mode ?? 'cad';
      if (!['cad','organic'].includes(mode)) return fail(res,400,'INVALID_MODE','Mod cad veya organic olmalı.');
      const quality = body.quality ?? 'normal';
      if (!['taslak','normal','ince'].includes(quality)) return fail(res,400,'INVALID_QUALITY','Kalite taslak, normal veya ince olmalı.');
      const cadMeshQuality = body.cadMeshQuality ?? 'normal';
      if (!['taslak','normal','ince'].includes(cadMeshQuality)) return fail(res,400,'INVALID_CAD_MESH_QUALITY','CAD ağ ayarı taslak, normal veya ince olmalı.');
      let parameterValues = {};
      if (body.parameters !== undefined) {
        if (!body.parameters || typeof body.parameters !== 'object' || Array.isArray(body.parameters)) return fail(res,400,'INVALID_PARAMETERS','Parametre değerleri bir nesne olmalı.');
        if (typeof body.example !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(body.example)) return fail(res,400,'PARAMETER_SCHEMA_NOT_FOUND','Geçerli bir örnek adı gerekli.');
        let schema;
        try { schema = JSON.parse(await readFile(path.join(ROOT, 'models', `${body.example}.parameters.json`), 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return fail(res,400,'PARAMETER_SCHEMA_NOT_FOUND','Bu örnek için parametre şeması bulunamadı.'); throw error; }
        try { parameterValues = validateParameterValues(schema, body.parameters); }
        catch (error) { throw Object.assign(error, { status:400, parameterPath:error.path ?? error.parameterPath ?? null }); }
      }
      if(body.referans!==undefined){if(!body.referans||typeof body.referans!=='object'||Array.isArray(body.referans)||JSON.stringify(body.referans).length>90000)return fail(res,400,'INVALID_REFERENCE_BRIEF','Referans konturları ve ölçüler en fazla 90 KB olmalı.');parameterValues={...parameterValues,referans:body.referans};}
      const cacheKey = buildCacheKey({ ...body, mode, quality }, parameterValues);
      const prior = await Promise.all((await readdir(RUNS)).filter(n=>/^[a-f0-9]{32}$/.test(n)).map(async n=>({name:n,mtime:(await stat(path.join(RUNS,n))).mtimeMs})));
      prior.sort((a,b)=>a.mtime-b.mtime);
      // Onbellegin isaret ettigi klasorler silinmez: silinince kopyalama sessizce dusup her uretim yeniden hesaplaniyordu
      const cachedFolders = new Set([...resultCache.values()].map(entry=>path.basename(entry.folder)));
      for (const old of prior.filter(o=>!cachedFolders.has(o.name)).slice(0,Math.max(0,prior.length-14))) {
        const target = path.resolve(RUNS,old.name);
        if (path.dirname(target) === RUNS) await rm(target,{recursive:true,force:true});
      }
      const id = randomUUID().replaceAll('-','');
      const folder = path.join(RUNS,id);
      await mkdir(folder);
      await writeFile(path.join(folder,'model.js'),body.code,'utf8');
      await writeFile(path.join(folder,'parameters.json'),JSON.stringify(parameterValues),'utf8');
      let result;
      const cached = resultCache.get(cacheKey);
      if (cached) {
        const restoreStartedAt = Date.now();
        try {
          job.stage = 'önbellek çıktısı kopyalanıyor';
          for (const file of cached.files) await copyFile(path.join(cached.folder,file),path.join(folder,file));
          result = structuredClone(cached.result);
          cacheHits++;
          resultCache.delete(cacheKey); resultCache.set(cacheKey,{...cached,folder});
          result.cache = { hit:true, key:cacheKey, restoreMs:Date.now()-restoreStartedAt };
          result.profile = { ...result.profile, cacheRestoreMs:Date.now()-restoreStartedAt };
        } catch {
          resultCache.delete(cacheKey); cacheMisses++;
        }
      } else cacheMisses++;
      if (!result) {
        job.stage = 'geometri ve ağ';
        const code = await runWorker(folder,mode,quality,cadMeshQuality,job);
        if (code !== 0) throw new Error('Geometri motoru durdu. .runtime/runs içindeki worker.log dosyasına bak.');
        if (job.status === 'cancelled') throw Object.assign(new Error('Üretim iptal edildi.'),{status:409});
        result = JSON.parse(await readFile(path.join(folder,'result.json'),'utf8'));
        result.cache = { hit:false, key:cacheKey };
        if (!result.ok) {
          result.errorCode = Number.isInteger(result.sourceLine) ? 'MODEL_SYNTAX_ERROR' : 'GEOMETRY_BUILD_FAILED';
          result.sourceHash = hash(body.code);
          result.context = { jobId:job.id, stage:job.stage, sourceHash:result.sourceHash, parameterPath:null, part:null, operation:null };
        }
        if (result.ok) {
          const cacheFiles = [...result.formats.map(ext=>`model.${ext}`), ...(result.previewMesh?['preview.bin']:[]), ...(result.visual?['views.png']:[])];
          const byteSize = (await Promise.all(cacheFiles.map(file=>stat(path.join(folder,file))))).reduce((total,file)=>total+file.size,0);
          resultCache.set(cacheKey,{folder,files:cacheFiles,byteSize,result:structuredClone(result)});
          while (resultCache.size > 8) resultCache.delete(resultCache.keys().next().value);
        }
      }
      if (result.ok) {
        result.files = Object.fromEntries(result.formats.map(ext=>[ext,'/api/files/'+id+'/model.'+ext]));
        if (result.previewMesh) result.files.preview = '/api/files/'+id+'/preview.bin';
          if (result.visual) result.files.visual = '/api/files/'+id+'/views.png';
      }
      job.status = result.ok ? 'completed' : 'failed'; job.stage = result.ok ? 'tamamlandı' : 'hata';
      return json(res,result.ok?200:422,{...result,job:publicJob(job)});
    } catch (error) {
      if (job.status === 'running') { job.status = 'failed'; job.stage = error.status === 408 ? 'zaman aşımı' : 'hata'; }
      return json(res,error.status||500,apiError(error,job,typeof body?.code==='string'?body.code:''));
    } finally { if (job.status === 'running') { job.status = 'failed'; job.stage = 'istek tamamlanamadı'; } busy = false; if (activeJob === job) activeJob = null; }
  }
  if (req.method !== 'GET') return json(res,404,{error:'Yol bulunamadı.'});
  const download = /^\/api\/files\/([a-f0-9]{32})\/(model\.(stl|step|js))$/.exec(url.pathname);
  const preview = /^\/api\/files\/([a-f0-9]{32})\/(preview\.bin)$/.exec(url.pathname);
  const visual = /^\/api\/files\/([a-f0-9]{32})\/(views\.png)$/.exec(url.pathname);
  const runFile = download || preview || visual;
  const base = runFile ? RUNS : path.join(ROOT,'dist');
  const file = runFile ? path.join(RUNS,runFile[1],runFile[2]) : path.resolve(base,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/,''));
  const relative = path.relative(base,file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return json(res,404,{error:'Dosya bulunamadı.'});
  let data;
  try { data = await readFile(file); } catch { return json(res,404,{error:'Dosya bulunamadı.'}); }
  const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':visual?'image/png':runFile?'application/octet-stream':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(download?{'Content-Disposition':`attachment; filename="${download[2]}"`}:{})});
  res.end(data);
}

http.createServer((req,res)=>handler(req,res).catch(error=>{ if (!res.headersSent) json(res,error.status||500,apiError(error)); else res.end(); })).listen(PORT,'127.0.0.1',()=>console.log(`Kodla 3D: http://127.0.0.1:${PORT}`));




