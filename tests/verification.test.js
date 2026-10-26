const {test}=require('node:test'),assert=require('node:assert/strict');
process.env.VERIFICATION_HMAC_SECRET='integration-unit-test-verification-secret';
const {mac}=require('../src/identifiers'),{evaluateCertificate}=require('../src/verify');
const code='2345-6789-ABCD',record={security_hash:mac(code),status:'valid',expiry_date:'2030-12-31'};
test('valid form and correct code',()=>assert.equal(evaluateCertificate(record,code,'2026-10-21'),'valid'));
test('wrong code gives one generic invalid status',()=>{assert.equal(evaluateCertificate(record,'2345-6789-ABCE','2026-10-21'),'invalid');assert.equal(evaluateCertificate(null,code,'2026-10-21'),'invalid');});
test('revoked and reissued certificates are rejected',()=>{assert.equal(evaluateCertificate({...record,status:'revoked'},code,'2026-10-21'),'revoked');assert.equal(evaluateCertificate({...record,status:'reissued'},code,'2026-10-21'),'reissued');});
test('expired certificate is clearly expired',()=>{assert.equal(evaluateCertificate({...record,expiry_date:'2020-01-01'},code,'2026-10-21'),'expired');assert.equal(evaluateCertificate({...record,expiry_date:'2026-10-21'},code,'2026-10-21'),'valid');});
