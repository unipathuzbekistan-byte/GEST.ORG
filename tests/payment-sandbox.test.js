'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {money,createCode,digest,validCode,normalizeCode}=require('../src/payment-math');
const secret='A'.repeat(96);
test('sandbox 25%/50%/100% fee waivers calculate exact UZS amounts',()=>{
 assert.deepEqual(money(890000,25),{original:890000,discount:222500,due:667500,currency:'UZS'});
 assert.deepEqual(money(890000,50),{original:890000,discount:445000,due:445000,currency:'UZS'});
 assert.deepEqual(money(890000,100),{original:890000,discount:890000,due:0,currency:'UZS'});
});
test('price and discount reject invalid values',()=>{
 for(const bad of [24,0,75,101,NaN])assert.throws(()=>money(890000,bad));
 for(const bad of [-1,1,1000,50000001,Infinity,234.55])assert.throws(()=>money(bad,25));
});
test('coupon codes are statistically unique with safe alphabet',()=>{
 const set=new Set();for(let i=0;i<1500;i++){const c=createCode();assert.equal(validCode(c),true);assert.equal(/[01ILO]/.test(c.slice(5)),false);set.add(c);}assert.equal(set.size,1500);
 assert.equal(validCode('GEST-AAAA-AAAA-AAAA-AAAA'),true);
 for(const invalid of ['GEST-OOOO-OOOO-OOOO-OOOO','GEST-AAAA-AAAI-AAAA-AAAA','GEST-AAAA-AAAA-AAAA-AAAA-EXTRA','AAAA','GEST-AAAA-AAAA-AAAA-AAA1'])assert.equal(validCode(invalid),false);
});
test('HMAC normalizes codes, conceals tokens, and changes with key',()=>{
 const c=createCode(),h=digest(c,secret);assert.equal(h,digest('  '+c.toLowerCase()+'  ',secret));assert.match(h,/^[0-9a-f]{64}$/);assert.notEqual(h,digest(c,'B'.repeat(96)));assert.ok(!h.includes(c));assert.equal(normalizeCode(' gest-abcd-efgh-jkmn-pqrs '),'GEST-ABCD-EFGH-JKMN-PQRS');
});
test('short HMAC secrets are rejected',()=>{assert.throws(()=>digest(createCode(),'short'));});
