'use strict';
const {spawnSync}=require('child_process');
if(process.env.NODE_ENV==='production'){
 require('../src/production-config').checkProductionConfig();
}else{
 require('./ensure-env')();
 require('dotenv').config({path:require('path').join(__dirname,'..','.env')});
}
const seed=spawnSync(process.execPath,[require.resolve('./seed'),'--if-empty'],{stdio:'inherit',env:process.env});
if(seed.status!==0)process.exit(seed.status||1);
const app=require('../src/app');
app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('GEST server started'));
