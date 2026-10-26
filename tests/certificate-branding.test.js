'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {cleanLogoBackground, certificateLogoData, fallbackSealData} = require('../src/certificate-branding');

test('opaque white margins become transparent without removing coloured centre',async()=>{
 const src=Buffer.from(`<svg width="100" height="70" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="70" fill="#ffffff"/><rect x="25" y="25" width="50" height="20" fill="#0d3158"/></svg>`);
 const buf=await cleanLogoBackground(src);
 const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(data[3],0);
 assert.ok(data[(40*info.width+50)*4+3]>245);
});
test('logo absent produces text fallback, not an error',async()=>{
 assert.equal(await certificateLogoData(path.join(__dirname,'missing-logo.png')), null);
});
test('non-white logo backgrounds remain preserved',async()=>{
 const src=await sharp({create:{width:10,height:10,channels:3,background:'#0d3158'}}).png().toBuffer();
 const {data}=await sharp(await cleanLogoBackground(src)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(data[3],255);
});
test('backup seals are embedded SVGs with different labels',()=>{
 const c=Buffer.from(fallbackSealData('centre').split(',')[1],'base64').toString();
 const v=Buffer.from(fallbackSealData('verified').split(',')[1],'base64').toString();
 assert.match(c,/TEST CENTRE/);
 assert.match(v,/VERIFIED/);
 assert.notEqual(c,v);
});
test('certificate template has transparent logo & stronger continuous microtext',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../views/certificate.ejs'),'utf8');
 assert.match(s,/opacity:\.23/);
 assert.match(s,/mix-blend-mode:normal;background:transparent/);
 assert.match(s,/centreSealData/);
 assert.match(s,/verifiedSealData/);
});
