'use strict';
// Temporary, single-instance pilot bridge.  This does NOT migrate to PostgreSQL.
// It makes a consistent SQLite backup and mirrors it together with protected files
// into a private Supabase Storage bucket. It MUST NOT be used as a multi-instance DB.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const {promisify} = require('util');
const {execFile} = require('child_process');
const runCommand = promisify(execFile);
const root = path.resolve(__dirname, '..');
const storage = path.join(root, 'storage');
const name = 'snapshots/gest-pilot-current.tar.gz';
let tail = Promise.resolve();
let savedChanges = -1;
let lastSnapshotAt = 0;
let lastError = null;
function enabled(){ return process.env.GEST_SUPABASE_MIRROR === 'true'; }
function config(){
  const endpoint = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.GEST_SUPABASE_BACKUP_BUCKET || 'gest-pilot-private';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(endpoint)) throw new Error('GEST mirror: invalid SUPABASE_URL');
  if(key.length < 32 || /^(anon|public|sb_publishable_)/.test(key)) throw new Error('GEST mirror: a private service-role API key is required');
  if(!/^[a-z0-9-]{4,50}$/.test(bucket))throw new Error('GEST mirror: invalid bucket');
  const db = path.resolve(root,process.env.DATABASE_PATH || './storage/db/gest.sqlite');
  if(!db.startsWith(storage+path.sep) || db!==path.join(storage,'db','gest.sqlite')) throw new Error('GEST mirror: DATABASE_PATH must be ./storage/db/gest.sqlite');
  return {endpoint, key, bucket, db};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`};}
function objectURL(c){return `${c.endpoint}/storage/v1/object/${c.bucket}/${name}`;}
function requirePilotMode(){
  if(process.env.NODE_ENV!=='production') throw new Error('GEST mirror supports only production');
  if(process.env.WEB_CONCURRENCY && process.env.WEB_CONCURRENCY !== '1') throw new Error('GEST mirror is single-instance only');
}
async function fetchWithTimeout(url,opts={}){
 const response=await fetch(url,{...opts,signal:AbortSignal.timeout(45000)});
 return response;
}
async function restore(){
 if(!enabled())return false;
 requirePilotMode();
 const c=config();
 const url=objectURL(c)+'?cache-bust='+Date.now();
 let result;
 try{result=await fetchWithTimeout(url,{headers:headers(c.key)});}catch(e){throw Error('GEST mirror cannot access Supabase: '+e.message);}
 // Supabase Storage currently returns HTTP 400 with {statusCode:"404",code:"NoSuchKey"}
 // for a missing object. Accept ONLY that specific missing-object response for a
 // one-time fresh demo start. Keep other errors fatal (bad key, bad bucket, outage).
 if(!result.ok){
   const detail=(await result.text()).slice(0,2048);
   let isMissing = result.status===404;
   if(result.status===400){
     try{
       const payload=JSON.parse(detail);
       isMissing=payload && payload.code==='NoSuchKey' && String(payload.statusCode)==='404';
     }catch(_ignored){}
   }
   if(isMissing){
     if(process.env.GEST_SUPABASE_ALLOW_EMPTY_START==='true'){
       console.warn('GEST mirror: no remote snapshot yet. Allowing ONE fresh DEMO database start.');
       return false;
     }
     throw Error('GEST mirror: remote snapshot missing; refusing empty startup to protect data.');
   }
   throw Error('GEST mirror restore failed: HTTP '+result.status+' '+detail.slice(0,160));
 }
 const archive=await result.arrayBuffer();
 if(archive.byteLength>48*1024*1024)throw Error('GEST mirror: snapshot exceeds 48 MB pilot safeguard');
 const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'gest-restore-'));
 try{
  const filename=path.join(temp,'restore.tgz');await fsp.writeFile(filename,Buffer.from(archive),{mode:0o600});
  const {stdout}=await runCommand('tar',['-tzf',filename],{maxBuffer:4*1024*1024});
  const entries=stdout.trim().split('\n').filter(Boolean);
  if(!entries.some(x=>x==='storage/db/gest.sqlite'))throw Error('GEST mirror snapshot missing SQLite database');
  for(const entry of entries){if(!entry.startsWith('storage/')||entry.startsWith('/')||entry.split('/').includes('..'))throw Error('GEST mirror invalid archive path');}
  await fsp.mkdir(storage,{recursive:true});
  await runCommand('tar',['--no-same-owner','--no-same-permissions','-xzf',filename,'-C',root],{maxBuffer:4096});
  console.log('GEST mirror: SQLite and private files restored from Supabase.');
  return true;
 }finally{await fsp.rm(temp,{recursive:true,force:true});}
}
async function snapshotOnce(force){
 if(!enabled())return;
 const c=config();
 const db = require('./db').db;
 if(!force && savedChanges === db.totalChanges && Date.now()-lastSnapshotAt<15*60*1000)return;
 const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'gest-snapshot-'));
 try{
  const tempDB=path.join(temp,'storage','db','gest.sqlite');
  await fsp.mkdir(path.dirname(tempDB),{recursive:true});
  await db.backup(tempDB);
  for(const item of ['photos','identity-documents','certificates','signatures']){
    await fsp.mkdir(path.join(storage,item),{recursive:true});
  }
  const archive=path.join(temp,'snapshot.tar.gz');
  const args=['-czf',archive,'-C',temp,'storage/db/gest.sqlite'];
  for(const item of ['photos','identity-documents','certificates','signatures'])args.push('-C',root,`storage/${item}`);
  await runCommand('tar',args,{maxBuffer:4096});
  const stats=await fsp.stat(archive);
  if(stats.size>45*1024*1024)throw Error('GEST mirror snapshot too large for pilot limit (45 MB)');
  const content=await fsp.readFile(archive);
  const response=await fetchWithTimeout(objectURL(c),{method:'POST',headers:{...headers(c.key),'Content-Type':'application/gzip','x-upsert':'true','Cache-Control':'no-cache'},body:content});
  if(!response.ok)throw Error('GEST mirror Supabase upload HTTP '+response.status+' '+(await response.text()).slice(0,160));
  savedChanges=db.totalChanges;
  lastSnapshotAt=Date.now();lastError=null;
  console.log(`GEST mirror: persistent snapshot synced (${Math.round(stats.size/1024)} KB).`);
 }finally{await fsp.rm(temp,{recursive:true,force:true});}
}
function flush(force=false){
 if(!enabled())return Promise.resolve();
 tail=tail.catch(()=>{}).then(()=>snapshotOnce(force)).catch(e=>{lastError=e.message;console.error('GEST mirror: backup failed:',e.message);throw e;});
 return tail;
}
async function firstCheckpoint(){if(enabled())await flush(true);}
function responseBarrier(req,res,next){
 if(!enabled()||!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
 const originalEnd=res.end;
 let requested=false;
 res.end=function(...args){
   if(requested)return res;
   requested=true;
   // All mutating requests get a durable snapshot before the response is sent.
   flush().then(()=>originalEnd.apply(res,args)).catch(()=>{
     if(res.headersSent){res.destroy();return;}
     res.statusCode=503;
     res.removeHeader('Location');
     res.setHeader('Content-Type','text/plain; charset=utf-8');
     originalEnd.call(res,'GEST cannot confirm persistent storage. Do not repeat this action until an administrator checks the system.');
   });
   return res;
 };
 next();
}
function state(){return {enabled:enabled(),lastSnapshotAt,lastError};}
module.exports={enabled,restore,firstCheckpoint,flush,responseBarrier,state};
