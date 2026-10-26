const {test}=require('node:test'),assert=require('node:assert/strict');
process.env.VERIFICATION_HMAC_SECRET='test-secret-for-core-only';
const {overall,cefr,validateBands}=require('../src/score');
const {securityCode,mac,matches}=require('../src/identifiers');
const {evaluateCertificate}=require('../src/verify');
const bands=[['<A1',0,19],['A1',20,34],['A2',35,49],['B1',50,64],['B2',65,79],['C1',80,91],['C2',92,100]].map(([label,min_score,max_score])=>({label,min_score,max_score}));
test('standalone score calculation and CEFR table',()=>{assert.equal(overall([90,78,86,82]),84);assert.equal(validateBands(bands),true);for(let s=0;s<=100;s++)assert.ok(bands.map(x=>x.label).includes(cefr(s,bands)));});
test('generated codes are syntactically safe and HMAC comparison works',()=>{const codes=new Set();for(let i=0;i<500;i++){const code=securityCode();assert.match(code,/^[2-9A-HJ-KM-NP-Z]{4}(?:-[2-9A-HJ-KM-NP-Z]{4}){2}$/);assert.equal(matches(code,mac(code)),true);codes.add(code);}assert.equal(codes.size,500);});
test('verification outcome policy rejects revoked or expired documents',()=>{const code=securityCode(),hash=mac(code),record={security_hash:hash,status:'valid',expiry_date:'2031-01-01'};assert.equal(evaluateCertificate(record,code,'2026-10-21'),'valid');assert.equal(evaluateCertificate(record,'2345-6789-ABCD','2026-10-21'),'invalid');assert.equal(evaluateCertificate({...record,status:'revoked'},code,'2026-10-21'),'revoked');assert.equal(evaluateCertificate({...record,expiry_date:'2020-01-01'},code,'2026-10-21'),'expired');});
