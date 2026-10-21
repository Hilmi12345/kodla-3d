#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const usage=`Kodla 3D local API istemcisi

Komutlar:
  node scripts/kodla3d.mjs health
  node scripts/kodla3d.mjs examples
  node scripts/kodla3d.mjs status <job-id>
  node scripts/kodla3d.mjs build --file model.js [--mode cad|organic] [--quality taslak|normal|ince]
      [--example at-kafasi --parameters parameters.json] [--out outputs/cli]

Sunucu: KODLA3D_URL (varsayılan http://127.0.0.1:8765). Kod güvenilen yerel JavaScript olarak çalışır; sandbox değildir.`;
const base=(process.env.KODLA3D_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const [command,...argv]=process.argv.slice(2);
function options(args){const out={_:[]};for(let i=0;i<args.length;i++){if(args[i].startsWith('--')){const key=args[i].slice(2);if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`--${key} değer istiyor.`);out[key]=args[++i];}else out._.push(args[i]);}return out;}
async function request(url,init){const response=await fetch(`${base}${url}`,{...init,signal:AbortSignal.timeout(130000)});const type=response.headers.get('content-type')||'';const data=type.includes('json')?await response.json():Buffer.from(await response.arrayBuffer());return {response,data};}
async function main(){
  if(!command||command==='help'||command==='--help'){console.log(usage);return;}
  if(command==='health'||command==='examples'){const {response,data}=await request(`/api/${command}`);if(!response.ok)throw new Error(JSON.stringify(data));console.log(JSON.stringify(data,null,2));return;}
  if(command==='status'){const id=argv[0];if(!id)throw new Error('status için job-id gerekli.');const {response,data}=await request(`/api/jobs/${encodeURIComponent(id)}`);if(!response.ok)throw new Error(JSON.stringify(data));console.log(JSON.stringify(data,null,2));return;}
  if(command!=='build')throw new Error(`Bilinmeyen komut: ${command}`);
  const args=options(argv);if(!args.file)throw new Error('build için --file model.js gerekli.');
  const code=await readFile(path.resolve(args.file),'utf8');
  let parameters;if(args.parameters)parameters=JSON.parse(await readFile(path.resolve(args.parameters),'utf8'));
  const jobId=randomUUID();
  const payload={jobId,code,mode:args.mode||'cad',quality:args.quality||'normal',...(args.example?{example:args.example}:{}),...(parameters?{parameters}:{})};
  let finished=false;
  const buildPromise=request('/api/build',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(value=>{finished=true;return value;});
  let lastStage='';
  const cancel=()=>{request(`/api/jobs/${jobId}`,{method:'DELETE'}).catch(()=>{});process.exit(130);};
  process.once('SIGINT',cancel);
  while(!finished){
    await new Promise(resolve=>setTimeout(resolve,400));
    if(finished)break;
    try{const {response,data}=await request(`/api/jobs/${jobId}`);if(response.ok&&data.status==='running'&&data.stage!==lastStage){lastStage=data.stage;console.error(`${data.stage} · ${(data.elapsedMs/1000).toFixed(1)} sn`);}}catch{}
  }
  process.removeListener('SIGINT',cancel);
  const {response,data}=await buildPromise;
  if(!response.ok||!data.ok){console.log(JSON.stringify(data,null,2));process.exitCode=1;return;}
  if(args.out){const outDir=path.resolve(args.out);await mkdir(outDir,{recursive:true});const saved=[];for(const [format,url] of Object.entries(data.files)){const {response:fileResponse,data:fileBytes}=await request(url);if(!fileResponse.ok)throw new Error(`Dosya indirilemedi: ${url}`);const name=format==='visual'?'views.png':format==='preview'?'preview.bin':`model.${format}`;const target=path.join(outDir,name);await writeFile(target,fileBytes);saved.push(target);}data.savedFiles=saved;}
  console.log(JSON.stringify(data,null,2));
}
main().catch(error=>{console.error(JSON.stringify({error:error.message,code:'CLI_ERROR'}));process.exitCode=1;});
