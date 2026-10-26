const crypto=require('crypto');
function counter(name,start){const {db}=require('./db');db.prepare('INSERT OR IGNORE INTO counters(name,last_number) VALUES(?,?)').run(name,start);db.prepare('UPDATE counters SET last_number=last_number+1 WHERE name=?').run(name);return db.prepare('SELECT last_number FROM counters WHERE name=?').get(name).last_number;}
function nextCandidateNumber(){const n=counter('candidate',100000);if(n>999999)throw Error('Candidate number space exhausted');return String(n).padStart(6,'0');}
function nextFormNumber(date=new Date()){const yy=String(date.getUTCFullYear()).slice(-2),mm=String(date.getUTCMonth()+1).padStart(2,'0');const n=counter('form-'+yy+mm,0);if(n>99999)throw Error('Monthly form number space exhausted');return `GEST-${yy}${mm}-${String(n).padStart(5,'0')}`;}
const alphabet='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function securityCode(){let code='';const max=Math.floor(256/alphabet.length)*alphabet.length;while(code.length<12){for(const b of crypto.randomBytes(16)){if(b<max){code+=alphabet[b%alphabet.length];if(code.length===12)break;}}}return code.replace(/(.{4})(?=.)/g,'$1-');}
function mac(raw,secret=process.env.VERIFICATION_HMAC_SECRET){if(!secret)throw Error('VERIFICATION_HMAC_SECRET required');return crypto.createHmac('sha256',secret).update(String(raw).toUpperCase()).digest('hex');}
function matches(code,stored){const a=Buffer.from(mac(code),'hex'),b=Buffer.from(/^[0-9a-f]{64}$/.test(stored||'')?stored:'0'.repeat(64),'hex');return crypto.timingSafeEqual(a,b);}
module.exports={nextCandidateNumber,nextFormNumber,securityCode,mac,matches};
