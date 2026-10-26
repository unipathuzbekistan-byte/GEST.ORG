'use strict';
// Fail closed when a real hosted server has incomplete configuration.
function checkProductionConfig(env=process.env){
 if(env.NODE_ENV!=='production')return true;
 const faults=[];
 for(const key of ['SESSION_SECRET','VERIFICATION_HMAC_SECRET','TOKEN_HASH_SECRET','FEE_WAIVER_HMAC_SECRET']){
  if(!/^[a-fA-F0-9]{64,}$/.test(env[key]||''))faults.push(key+' must be a stable random secret (at least 32 bytes in hex)');
 }
 if(!/^[a-fA-F0-9]{64}$/.test(env.IDENTITY_ENCRYPTION_KEY||''))faults.push('IDENTITY_ENCRYPTION_KEY must contain exactly 32 random bytes as hex');
 if(!/^https:\/\/[^/\s]+\.[^/\s]+\/?$/i.test(env.BASE_URL||'')||/localhost|example|127\.0\.0\.1/i.test(env.BASE_URL||''))faults.push('BASE_URL must be the real public HTTPS origin');
 if(env.TRUST_PROXY!=='true')faults.push('TRUST_PROXY=true must be set behind the HTTPS reverse proxy');
 if(!env.SMTP_HOST||/CHANGE_ME|example/i.test(env.SMTP_HOST))faults.push('SMTP_HOST must be a working provider');
 if(!env.SMTP_FROM||/\.local|example|CHANGE_ME/i.test(env.SMTP_FROM))faults.push('SMTP_FROM must be an authorised sender address');
 for(const key of ['SUPER_ADMIN_EMAIL','CENTRE_ADMIN_EMAIL']) if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env[key]||'')||/\.local|example/i.test(env[key]||''))faults.push(key+' must be a deliverable email');
 for(const key of ['SUPER_ADMIN_PASSWORD','CENTRE_ADMIN_PASSWORD']) if((env[key]||'').length<16||/CHANGE_ME/i.test(env[key]||''))faults.push(key+' must contain at least 16 characters');
 if(env.PAYMENT_MODE==='sandbox')faults.push('PAYMENT_MODE=sandbox cannot run on a public production site (set manual)');
 if(faults.length)throw new Error('GEST production config blocked startup:\n- '+faults.join('\n- '));
 return true;
}
module.exports={checkProductionConfig};
