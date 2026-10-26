'use strict';
// Local only: creates an untracked configuration with secure random keys, never prints secrets.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const target=path.join(__dirname,'..','.env.production');
if(fs.existsSync(target)){console.error('Refusing to overwrite existing .env.production');process.exit(1);}
const example=fs.readFileSync(path.join(__dirname,'..','.env.production.example'),'utf8');
let env=example;
for(const key of ['SESSION_SECRET','VERIFICATION_HMAC_SECRET','TOKEN_HASH_SECRET','FEE_WAIVER_HMAC_SECRET','IDENTITY_ENCRYPTION_KEY'])env=env.replace(new RegExp('^'+key+'=CHANGE_ME_64_HEX$','m'),key+'='+crypto.randomBytes(32).toString('hex'));
for(const key of ['SUPER_ADMIN_PASSWORD','CENTRE_ADMIN_PASSWORD'])env=env.replace(new RegExp('^'+key+'=CHANGE_ME_AT_LEAST_16_CHARACTERS$','m'),key+'='+crypto.randomBytes(24).toString('base64url'));
fs.writeFileSync(target,env,{flag:'wx',mode:0o600});
console.log('Created private .env.production. Edit domain, real admin email and SMTP provider before use. Never change keys after certificates/data exist.');
