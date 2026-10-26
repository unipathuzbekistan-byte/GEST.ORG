'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('module'),crypto=require('crypto');
const origLoad=Module._load;
// Node-only encryption tests; image processing is exercised in the full HTTP suite when sharp is installed.
Module._load=function(name,parent,isMain){if(name==='sharp')return function(){throw Error('sharp not expected in the encryption-only test');};return origLoad.apply(this,arguments);};
const identity=require('../src/identity-documents');Module._load=origLoad;
process.env.IDENTITY_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
test('AES-256-GCM encrypts ID bytes and detects any ciphertext modification',()=>{
 const source=Buffer.from('%PDF-1.7\n1 0 obj\nhello identity document\nendobj\n%%EOF');
 const encrypted=identity.encrypt(source);assert.equal(encrypted.subarray(0,8).toString(),'GESTID01');assert.equal(encrypted.includes(source),false);assert.deepEqual(identity.decrypt(encrypted),source);
 const tampered=Buffer.from(encrypted);tampered[tampered.length-1]^=1;assert.throws(()=>identity.decrypt(tampered));
});
test('validation rejects non-PDF, incomplete PDF and active PDF actions',()=>{
 assert.throws(()=>identity.validatePdf(Buffer.from('hello')));
 assert.throws(()=>identity.validatePdf(Buffer.from('%PDF-1.7\n'.repeat(20))));
 assert.throws(()=>identity.validatePdf(Buffer.from('%PDF-1.7\n'+('x'.repeat(150))+' /OpenAction (run)\n%%EOF')));
 assert.doesNotThrow(()=>identity.validatePdf(Buffer.from('%PDF-1.7\n'+('x'.repeat(150))+'\n%%EOF')));
});
test('storage filenames are random-only; traversal is rejected',()=>{
 assert.throws(()=>identity.read('../.env'));assert.equal(identity.safeBasename('../secret.pdf'),'secret.pdf');
});
