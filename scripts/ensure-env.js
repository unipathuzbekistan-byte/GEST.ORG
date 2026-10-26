const fs=require('fs'),path=require('path'),crypto=require('crypto');
const target=path.join(__dirname,'..','.env');
function ensureEnv(){
 if(fs.existsSync(target)){ const raw=fs.readFileSync(target,'utf8'); if(!/^PAYMENT_MODE=/m.test(raw)){fs.appendFileSync(target,'\nPAYMENT_MODE=sandbox\n',{mode:0o600});console.log('Enabled development-only PAYMENT_MODE=sandbox in .env.');} if(/^FEE_WAIVER_HMAC_SECRET=/m.test(raw)&&!/^FEE_WAIVER_HMAC_SECRET=[a-fA-F0-9]{64,}$/m.test(raw))throw Error('Invalid existing FEE_WAIVER_HMAC_SECRET; correct it securely instead of generating a second key.'); if(!/^FEE_WAIVER_HMAC_SECRET=[a-fA-F0-9]{64,}$/m.test(raw)){fs.appendFileSync(target,'\nFEE_WAIVER_HMAC_SECRET='+crypto.randomBytes(48).toString('hex')+'\n',{mode:0o600});console.log('Added FEE_WAIVER_HMAC_SECRET to .env; preserve this key for existing coupon codes.');} if(!/^IDENTITY_ENCRYPTION_KEY=[a-fA-F0-9]{64}$/m.test(raw)){fs.appendFileSync(target,'\nIDENTITY_ENCRYPTION_KEY='+crypto.randomBytes(32).toString('hex')+'\n',{mode:0o600}); console.log('Added a new identity-document encryption key to .env. Back up the key securely.');} return; }
 let raw=fs.readFileSync(path.join(__dirname,'..','.env.example'),'utf8');
 for(const key of ['SESSION_SECRET','VERIFICATION_HMAC_SECRET','TOKEN_HASH_SECRET','FEE_WAIVER_HMAC_SECRET'])raw=raw.replace(new RegExp('^'+key+'=$','m'),key+'='+crypto.randomBytes(48).toString('hex'));
 raw=raw.replace(/^IDENTITY_ENCRYPTION_KEY=$/m,'IDENTITY_ENCRYPTION_KEY='+crypto.randomBytes(32).toString('hex'));
 for(const key of ['SUPER_ADMIN_PASSWORD','CENTRE_ADMIN_PASSWORD','DEMO_CANDIDATE_PASSWORD'])raw=raw.replace(new RegExp('^'+key+'=$','m'),key+'='+crypto.randomBytes(16).toString('base64url'));
 fs.writeFileSync(target,raw,{mode:0o600});
 console.log('Created .env with generated secrets and seed passwords. Keep it secure.');
}
if(require.main===module)ensureEnv();module.exports=ensureEnv;
