'use strict';
// Internal development-only simulated payments. No external gateway, bank cards or money.
const { z } = require('zod');
const {money,createCode,normalizeCode,digest,validCode,price}=require('./payment-math');
function enabled(){return process.env.PAYMENT_MODE==='sandbox'&&process.env.NODE_ENV!=='production';}
function buildService(db,secret,audit=()=>{}){
 function bookingFor(id,userId){return db.prepare(`SELECT b.id,b.user_id,b.status,b.payment_status,b.checked_in_at,s.centre_id,s.test_date
 FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.id=? AND b.user_id=?`).get(id,userId);}
 function ensureOrder(bookingId,defaultFee){
  const found=db.prepare('SELECT * FROM payment_orders WHERE booking_id=?').get(bookingId);
  if(found)return found;
  const b=db.prepare('SELECT status,payment_status FROM bookings WHERE id=?').get(bookingId);
  if(!b||b.status!=='booked')throw Error('Booking not available.');
  if(b.payment_status==='paid')return null; // historical manually reconciled booking
  const amount=price(defaultFee);
  db.prepare('INSERT OR IGNORE INTO payment_orders(booking_id,original_amount,amount_due,discount_amount,status,provider) VALUES(?,?,?,0,\'pending\',\'sandbox\')').run(bookingId,amount,amount);
  return db.prepare('SELECT * FROM payment_orders WHERE booking_id=?').get(bookingId);
 }
 function issue({institutionId,centreId=null,percent,quantity,expiryDate,actorId}){
  const n=z.number().int().min(1).max(100).parse(Number(quantity));
  const p=z.number().int().refine(v=>[25,50,100].includes(v)).parse(Number(percent));
  const date=z.iso.date().parse(expiryDate);
  if(date<new Date().toISOString().slice(0,10))throw Error('Coupon expiry must not be in the past.');
  const id=z.number().int().positive().parse(Number(institutionId));
  const cid=centreId?z.number().int().positive().parse(Number(centreId)):null;
  const institution=db.prepare('SELECT id FROM fee_waiver_institutions WHERE id=? AND active=1').get(id);
  if(!institution)throw Error('Choose an active school or university.');
  if(cid&&!db.prepare('SELECT id FROM centres WHERE id=? AND active=1').get(cid))throw Error('Choose an active test centre.');
  const codes=[];
  const batchId=db.transaction(()=>{
   const batch=db.prepare('INSERT INTO fee_waiver_batches(institution_id,centre_id,percent,quantity,expiry_date,created_by) VALUES(?,?,?,?,?,?)').run(id,cid,p,n,date,actorId).lastInsertRowid;
   const add=db.prepare('INSERT INTO fee_waiver_coupons(batch_id,token_hash) VALUES(?,?)');
   for(let i=0;i<n;i++){
    let code,hash;
    do { code=createCode();hash=digest(code,secret); } while(db.prepare('SELECT id FROM fee_waiver_coupons WHERE token_hash=?').get(hash));
    add.run(batch,hash);codes.push(code);
   }
   audit(actorId,'fee_waiver_batch_created','fee_waiver_batch',batch,{institutionId:id,centreId:cid,percent:p,quantity:n,expiryDate:date});
   return batch;
  }).immediate();
  // Plaintext is returned ONLY for this POST response; no persisted plaintext or audit disclosure.
  return {batchId,codes,percent:p,expiryDate:date};
 }
 function apply({bookingId,userId,code,actorId}){
  const id=z.number().int().positive().parse(Number(bookingId));
  const normalized=normalizeCode(code);
  if(!validCode(normalized))throw Error('Coupon is not valid or is no longer available.');
  const hash=digest(normalized,secret);
  const result=db.transaction(()=>{
   const b=bookingFor(id,userId);
   if(!b||b.status!=='booked'||b.checked_in_at||b.test_date<new Date().toISOString().slice(0,10))throw Error('Booking is not eligible for a fee waiver.');
   const order=db.prepare('SELECT * FROM payment_orders WHERE booking_id=?').get(id);
   if(!order||order.status!=='pending'||order.coupon_id)throw Error('This booking cannot accept another coupon.');
   if(b.payment_status==='paid')throw Error('Payment is already completed.');
   const coupon=db.prepare(`SELECT cp.id,cp.redeemed_booking_id,cp.voided_at,ba.percent,ba.expiry_date,ba.active,ba.centre_id,i.active institution_active
    FROM fee_waiver_coupons cp JOIN fee_waiver_batches ba ON ba.id=cp.batch_id
    JOIN fee_waiver_institutions i ON i.id=ba.institution_id WHERE cp.token_hash=?`).get(hash);
   if(!coupon||coupon.redeemed_booking_id||coupon.voided_at||!coupon.active||!coupon.institution_active||coupon.expiry_date<new Date().toISOString().slice(0,10)||(coupon.centre_id&&coupon.centre_id!==b.centre_id))throw Error('Coupon is not valid or is no longer available.');
   const amounts=money(order.original_amount,coupon.percent);
   const claimed=db.prepare('UPDATE fee_waiver_coupons SET redeemed_booking_id=?,redeemed_at=CURRENT_TIMESTAMP WHERE id=? AND redeemed_booking_id IS NULL AND voided_at IS NULL').run(id,coupon.id);
   if(claimed.changes!==1)throw Error('Coupon is not valid or is no longer available.');
   const newStatus=amounts.due===0?'waived':'pending';
   db.prepare('UPDATE payment_orders SET coupon_id=?,discount_amount=?,amount_due=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(coupon.id,amounts.discount,amounts.due,newStatus,order.id);
   if(newStatus==='waived')db.prepare("UPDATE bookings SET payment_status='paid' WHERE id=?").run(id);
   db.prepare('INSERT INTO payment_events(order_id,action,outcome) VALUES(?,?,?)').run(order.id,'coupon_applied',newStatus);
   audit(actorId,'coupon_redeemed','booking',id,{percent:coupon.percent,discount:amounts.discount,coupon_id:coupon.id});
   return {percent:coupon.percent,...amounts,status:newStatus};
  }).immediate();
  return result;
 }
 function simulate({bookingId,userId,outcome,actorId}){
  if(!enabled())throw Error('Sandbox payments are disabled.');
  const id=z.number().int().positive().parse(Number(bookingId));
  const decision=z.enum(['success','declined']).parse(outcome);
  return db.transaction(()=>{
   const b=bookingFor(id,userId);
   if(!b||b.status!=='booked'||b.checked_in_at||b.test_date<new Date().toISOString().slice(0,10))throw Error('This booking is no longer payable.');
   const order=db.prepare('SELECT * FROM payment_orders WHERE booking_id=?').get(id);
   if(!order||order.status!=='pending'||order.amount_due<=0||b.payment_status==='paid')throw Error('This booking is already settled or unavailable.');
   const next=decision==='success'?'paid':'failed';
   db.prepare('UPDATE payment_orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(next,order.id);
   if(next==='paid')db.prepare("UPDATE bookings SET payment_status='paid' WHERE id=?").run(id);
   db.prepare('INSERT INTO payment_events(order_id,action,outcome) VALUES(?,?,?)').run(order.id,'sandbox_attempt',next);
   audit(actorId,'sandbox_payment_attempt','booking',id,{outcome:next,amount:order.amount_due});
   return next;
  }).immediate();
 }
 function retry({bookingId,userId}){
  if(!enabled())throw Error('Sandbox payments are disabled.');
  const id=z.number().int().positive().parse(Number(bookingId));
  return db.transaction(()=>{
   const b=bookingFor(id,userId);if(!b||b.status!=='booked'||b.payment_status==='paid'||b.checked_in_at||b.test_date<new Date().toISOString().slice(0,10))throw Error('Booking is not eligible for retry.');
   const order=db.prepare('SELECT * FROM payment_orders WHERE booking_id=?').get(id);
   if(!order||order.status!=='failed')throw Error('There is no declined payment to retry.');
   db.prepare("UPDATE payment_orders SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
   db.prepare('INSERT INTO payment_events(order_id,action,outcome) VALUES(?,?,?)').run(order.id,'sandbox_retry','pending');
  }).immediate();
 }
 function resetAfterRebooking(bookingId){
  const old=db.prepare('SELECT id FROM payment_orders WHERE booking_id=?').get(bookingId);
  if(old){
   const order=db.prepare('SELECT * FROM payment_orders WHERE id=?').get(old.id);
   if(order.coupon_id||order.status==='paid'||order.status==='waived')throw Error('A paid or fee-waived cancellation cannot be rebooked automatically; contact your test centre.');
   db.prepare("UPDATE payment_orders SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(old.id);
   db.prepare('INSERT INTO payment_events(order_id,action,outcome) VALUES(?,?,?)').run(old.id,'sandbox_retry','pending');
  }
 }
 return {ensureOrder,issue,apply,simulate,retry,resetAfterRebooking};
}
module.exports={money,createCode,normalizeCode,digest,validCode,enabled,buildService};
