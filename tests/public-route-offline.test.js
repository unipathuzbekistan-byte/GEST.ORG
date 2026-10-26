'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
process.env.VERIFICATION_HMAC_SECRET='offline-route-verification-test-secret';
const {securityCode,mac,matches}=require('../src/identifiers');
const {evaluateCertificate}=require('../src/verify');
const validCode=securityCode();
let currentCertificate=null;
const auditEntries=[];
const routes=new Map();
const fakeRouter={
  get(url,...handlers){routes.set('GET '+url,handlers.at(-1));return this;},
  post(url,...handlers){routes.set('POST '+url,handlers.at(-1));return this;}
};
const fakeSchema={trim(){return this;},toUpperCase(){return this;},regex(){return this;}};
const fakeZ={string:()=>fakeSchema,object:()=>({safeParse:value=>({success:true,data:value})})};
const fakeDb={prepare:sql=>({
  get(){return sql.includes('SELECT cert.*')?currentCertificate:undefined;},
  run(...values){if(sql.includes('INSERT INTO verification_logs'))auditEntries.push(values);return {};},
  all(){return []}
})};
const mocks={
  express:{Router:()=>fakeRouter},
  crypto,
  'express-rate-limit':()=>((req,res,next)=>next()),
  '../db':{db:fakeDb,setting:()=>''},
  '../identifiers':{mac,matches},
  '../verify':{evaluateCertificate},
  '../validation':{z:fakeZ}
};
const routePath=path.join(__dirname,'../src/routes/public.js');
const source=fs.readFileSync(routePath,'utf8');
const moduleShim={exports:{}};
vm.runInNewContext(source,{module:moduleShim,exports:moduleShim.exports,require:id=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  throw new Error('Unexpected require in route test: '+id);
},process,Buffer,console}, {filename:routePath,timeout:1000});
const getVerify=routes.get('GET /verify/:form');
assert.equal(typeof getVerify,'function','QR verification route must be registered');
function request(code,record){
  currentCertificate=record;
  let response;
  const req={params:{form:'GEST-2610-00001'},query:{code},ip:'203.0.113.88'};
  const res={page:(_template,data)=>{response=data.verification;}};
  getVerify(req,res);
  return response;
}
function record(){return {form_number:'GEST-2610-00001',security_hash:mac(validCode),status:'valid',expiry_date:'2030-12-31',photo_path:null};}
test('actual public QR route validates HMAC and returns a valid certificate',()=>{
  const r=request(validCode,record());
  assert.equal(r.outcome,'valid');assert.equal(r.record.form_number,'GEST-2610-00001');
});
test('actual public QR route returns generic invalid for wrong code or unknown form',()=>{
  assert.equal(request('2345-6789-ABCD',record()).outcome,'invalid');
  assert.equal(request(validCode,null).outcome,'invalid');
});
test('actual public QR route recognises revocation and expiration',()=>{
  assert.equal(request(validCode,{...record(),status:'revoked'}).outcome,'revoked');
  assert.equal(request(validCode,{...record(),expiry_date:'2020-01-01'}).outcome,'expired');
});
test('verification audits store hashes rather than plaintext code or form number',()=>{
  request(validCode,record());
  const last=auditEntries.at(-1);
  assert.equal(last.length,3);
  assert.equal(last[2],'valid');
  assert.notEqual(last[1], 'GEST-2610-00001');
  assert.equal(JSON.stringify(last).includes(validCode),false);
});
