'use strict';
// Integration coverage (runs under npm test when dependencies are installed).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Database=require('better-sqlite3');
const {buildService,enabled}=require('../src/payment-sandbox');
const secret='D'.repeat(96);
function setup(){
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');
 db.exec(fs.readFileSync(path.join(__dirname,'..','src','schema.sql'),'utf8'));
 db.prepare("INSERT INTO centres(id,code,name,country,city,address) VALUES(1,'UZ001','Prime School','Uzbekistan','Tashkent','Street')").run();
 db.prepare("INSERT INTO centres(id,code,name,country,city,address) VALUES(2,'UZ002','Demo 2','Uzbekistan','Tashkent','Street')").run();
 db.prepare("INSERT INTO users(id,email,password_hash,role,verified) VALUES(1,'head@example.test','hash','super_admin',1)").run();
 for(let i=2;i<=5;i++){db.prepare('INSERT INTO users(id,email,password_hash,role,verified) VALUES(?,?,?,?,1)').run(i,'user'+i+'@example.test','hash','candidate');db.prepare('INSERT INTO candidates(user_id) VALUES(?)').run(i);}
 db.prepare("INSERT INTO sessions(id,centre_id,test_date,start_time,capacity) VALUES(1,1,'2050-12-01','09:00',15)").run();
 db.prepare("INSERT INTO sessions(id,centre_id,test_date,start_time,capacity) VALUES(2,2,'2050-12-01','09:00',15)").run();
 for(let i=2;i<=5;i++)db.prepare('INSERT INTO bookings(id,user_id,session_id) VALUES(?,?,?)').run(i,i,i%2===0?1:2);
 db.prepare("INSERT INTO fee_waiver_institutions(id,name,kind,created_by) VALUES(1,'Demo School','school',1)").run();
 return {db,service:buildService(db,secret)};
}
test('100% fee waiver is single-use, paid and hash-only in database',()=>{
 const {db,service}=setup();try{
  service.ensureOrder(2,890000);service.ensureOrder(3,890000);
  const issued=service.issue({institutionId:1,percent:100,quantity:1,expiryDate:'2050-11-30',actorId:1});
  assert.equal(db.prepare('SELECT quantity FROM fee_waiver_batches WHERE id=?').get(issued.batchId).quantity,1);
  const applied=service.apply({bookingId:2,userId:2,code:issued.codes[0],actorId:2});
  assert.equal(applied.due,0);assert.equal(applied.status,'waived');
  assert.equal(db.prepare('SELECT payment_status FROM bookings WHERE id=2').get().payment_status,'paid');
  assert.equal(db.prepare('SELECT status FROM payment_orders WHERE booking_id=2').get().status,'waived');
  const saved=db.prepare('SELECT token_hash FROM fee_waiver_coupons').get();assert.match(saved.token_hash,/^[a-f0-9]{64}$/);assert.ok(!saved.token_hash.includes('GEST-'));
  assert.throws(()=>service.apply({bookingId:3,userId:3,code:issued.codes[0],actorId:3}));
  assert.throws(()=>service.apply({bookingId:2,userId:3,code:issued.codes[0],actorId:3}),'cross-user blocked');
 }finally{db.close();}
});
test('centre restriction, expiry, disabled batch prevent coupon redemption',()=>{
 const {db,service}=setup();try{
  service.ensureOrder(2,890000);service.ensureOrder(3,890000);
  const code=service.issue({institutionId:1,centreId:1,percent:25,quantity:1,expiryDate:'2050-11-30',actorId:1}).codes[0];
  assert.throws(()=>service.apply({bookingId:3,userId:3,code}));
  assert.equal(service.apply({bookingId:2,userId:2,code}).due,667500);
  const expired=service.issue({institutionId:1,percent:25,quantity:1,expiryDate:'2050-11-30',actorId:1});
  db.prepare("UPDATE fee_waiver_batches SET expiry_date='2020-01-01' WHERE id=?").run(expired.batchId);
  assert.throws(()=>service.apply({bookingId:3,userId:3,code:expired.codes[0]}));
  const revoked=service.issue({institutionId:1,percent:50,quantity:1,expiryDate:'2050-11-30',actorId:1});
  db.prepare('UPDATE fee_waiver_batches SET active=0 WHERE id=?').run(revoked.batchId);
  assert.throws(()=>service.apply({bookingId:3,userId:3,code:revoked.codes[0]}));
 }finally{db.close();}
});
test('sandbox decline, retry, success are idempotent and only settle once',()=>{
 const {db,service}=setup();const was=process.env.PAYMENT_MODE,env=process.env.NODE_ENV;
 try{process.env.PAYMENT_MODE='sandbox';process.env.NODE_ENV='test';
  service.ensureOrder(2,890000);
  assert.equal(service.simulate({bookingId:2,userId:2,outcome:'declined',actorId:2}),'failed');
  assert.equal(db.prepare('SELECT payment_status FROM bookings WHERE id=2').get().payment_status,'pending');
  service.retry({bookingId:2,userId:2});
  assert.equal(service.simulate({bookingId:2,userId:2,outcome:'success',actorId:2}),'paid');
  assert.throws(()=>service.simulate({bookingId:2,userId:2,outcome:'success',actorId:2}));
  assert.equal(db.prepare('SELECT payment_status FROM bookings WHERE id=2').get().payment_status,'paid');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM payment_events').get().n,3);
  process.env.NODE_ENV='production';assert.equal(enabled(),false);
  assert.throws(()=>service.simulate({bookingId:3,userId:3,outcome:'success',actorId:3}));
 }finally{process.env.PAYMENT_MODE=was;process.env.NODE_ENV=env;db.close();}
});
