const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gest-centre-sign-'));
process.env.DATABASE_PATH=path.join(dir,'signatures.sqlite');
const {db}=require('../src/db');
const {sanitizeSignature,setCentreSignature,activeSignature,retireCentreSignature,storedPath}=require('../src/signatures');

test('HQ-issued signatory image is sanitized, versioned, not overwritten by rotation',async()=>{
 const image=await sharp({create:{width:450,height:95,channels:4,background:'#ffffff00'}}).png().toBuffer();
 const files=[];
 try{
  await assert.rejects(sanitizeSignature(Buffer.from('not a valid image')));
  await assert.rejects(sanitizeSignature(Buffer.alloc(1024*1024+1)));
  const encoded=await sanitizeSignature(image);
  assert.equal((await sharp(encoded).metadata()).format,'png');
  assert.throws(()=>storedPath('../malicious.png'));
  const cid=Number(db.prepare('INSERT INTO centres(code,name,country,city,address) VALUES(?,?,?,?,?)').run('UZ001','Prime School','Uzbekistan','Tashkent','Tashkent centre').lastInsertRowid);
  const uid=Number(db.prepare('INSERT INTO users(email,password_hash,role,verified) VALUES(?,?,?,1)').run('headquarters@example.test','not-used','super_admin').lastInsertRowid);
  const a=await setCentreSignature(cid,uid,{signatory_name:'First Officer',signatory_title:'Centre Director'},image);
  const old=activeSignature(cid);
  files.push(old.image_file);
  assert.equal(old.id,a);
  assert.equal(old.signatory_name,'First Officer');
  const oldBytes=fs.readFileSync(storedPath(old.image_file));
  const b=await setCentreSignature(cid,uid,{signatory_name:'Second Officer',signatory_title:'Centre Director'},image);
  files.push(activeSignature(cid).image_file);
  assert.notEqual(a,b);
  assert.equal(db.prepare('SELECT active FROM centre_signatures WHERE id=?').get(a).active,0);
  assert.deepEqual(fs.readFileSync(storedPath(old.image_file)),oldBytes,'retired image must remain intact');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM centre_signatures WHERE centre_id=? AND active=1').get(cid).n,1);
  retireCentreSignature(cid,uid,'Test-only retirement');
  assert.equal(activeSignature(cid),undefined);
  assert.deepEqual(fs.readFileSync(storedPath(old.image_file)),oldBytes);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit_logs WHERE action LIKE ?').get('centre_signature_%').n,3);
 }finally{db.close();for(const file of files)fs.rmSync(storedPath(file),{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});
