const {matches}=require('./identifiers');
function evaluateCertificate(record,code,today=new Date().toISOString().slice(0,10)){
 // Compare against an all-zero substitute even when the form does not exist.
 const correct=matches(code,record?.security_hash);
 if(!record||!correct)return 'invalid';
 if(record.status==='revoked')return 'revoked';
 if(record.status==='reissued')return 'reissued';
 if(record.expiry_date<today)return 'expired';
 return 'valid';
}
module.exports={evaluateCertificate};
