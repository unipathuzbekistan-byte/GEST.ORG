'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const production = process.env.NODE_ENV === 'production';
if (production) {
  require('../src/production-config').checkProductionConfig();
} else {
  require('./ensure-env')();
  require('dotenv').config({path:path.join(__dirname,'..','.env')});
}
async function boot(){
const cloud=require('../src/cloud-snapshot');
if(production && cloud.enabled())await cloud.restore();
// Bootstrap a single headquarters admin in an empty production database.
// Seed demonstration centres and dates ONLY on local development machines.
const entry = production ? './bootstrap-production' : './seed';
const args = production ? [] : ['--if-empty'];
const task = spawnSync(process.execPath,[require.resolve(entry),...args],{stdio:'inherit',env:process.env});
if(task.error){console.error('GEST startup failed:',task.error.message);process.exit(1);}
if(task.status !== 0)process.exit(task.status || 1);
const app=require('../src/app');
if(production && cloud.enabled())await cloud.firstCheckpoint();
const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('GEST server started'));
if(production && cloud.enabled()){
 const periodic=setInterval(()=>cloud.flush().catch(e=>console.error('Periodic mirror failed:',e.message)),60000);
 periodic.unref();
 process.once('SIGTERM',()=>{
   clearInterval(periodic);
   server.close(()=>{});
   cloud.flush(true).then(()=>process.exit(0)).catch(e=>{console.error('Final sync failed:',e.message);process.exit(1);});
   setTimeout(()=>process.exit(1),20000).unref();
 });
}
}
boot().catch(e=>{console.error('GEST startup failed:',e.message);process.exit(1);});
