'use strict';
const express=require('express');
const { z }=require('zod');
const { db,setting,audit }=require('../db');
const { auth,role,flash }=require('../middleware');
const { buildService,money,enabled }=require('../payment-sandbox');
const sandbox=buildService(db,process.env.FEE_WAIVER_HMAC_SECRET,audit);
const r=express.Router();r.use(auth,role('super_admin'));
r.get('/',(req,res)=>{
 const institutions=db.prepare('SELECT * FROM fee_waiver_institutions ORDER BY name').all();
 const batches=db.prepare(`SELECT ba.*,i.name institution_name,c.code centre_code,
 (SELECT COUNT(*) FROM fee_waiver_coupons cp WHERE cp.batch_id=ba.id AND cp.redeemed_booking_id IS NOT NULL) redeemed
 FROM fee_waiver_batches ba JOIN fee_waiver_institutions i ON i.id=ba.institution_id
 LEFT JOIN centres c ON c.id=ba.centre_id ORDER BY ba.id DESC LIMIT 200`).all();
 const centres=db.prepare('SELECT id,code,name FROM centres WHERE active=1 ORDER BY code').all();
 const overview=db.prepare("SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN status IN ('paid','waived') THEN 1 ELSE 0 END),0) settled,COALESCE(SUM(CASE WHEN status IN ('paid','waived') THEN amount_due ELSE 0 END),0) demo_amount FROM payment_orders").get();
 res.set('Cache-Control','private,no-store');res.page('admin/fees',{title:'Payment sandbox and fee waivers',institutions,batches,centres,overview,price:setting('exam_fee_uzs'),enabled:enabled()});
});
r.post('/price',(req,res,next)=>{try{
 const amount=z.coerce.number().int().min(10000).max(50000000).parse(req.body.exam_fee_uzs);
 db.prepare("INSERT INTO settings(key,value) VALUES('exam_fee_uzs',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(amount));
 audit(req.user.id,'exam_fee_updated','settings','exam_fee_uzs',{amount,currency:'UZS'});
 flash(req,'success','New bookings use the updated sandbox price. Existing orders keep their original amount.');res.redirect('/admin/fees');
 }catch(e){next(e);}});
r.post('/institutions',(req,res,next)=>{try{
 const data=z.object({name:z.string().trim().min(3).max(120),kind:z.enum(['school','university','nonprofit','partner'])}).parse(req.body);
 const id=db.prepare('INSERT INTO fee_waiver_institutions(name,kind,created_by) VALUES(?,?,?)').run(data.name,data.kind,req.user.id).lastInsertRowid;
 audit(req.user.id,'fee_waiver_institution_created','fee_waiver_institution',id,{name:data.name,kind:data.kind});
 flash(req,'success','Institution added. No institution login was created.');res.redirect('/admin/fees');
 }catch(e){next(e);}});
r.post('/institutions/:id/status',(req,res,next)=>{try{
 const id=z.coerce.number().int().positive().parse(req.params.id),active=z.enum(['0','1']).parse(req.body.active);
 if(!db.prepare('SELECT id FROM fee_waiver_institutions WHERE id=?').get(id))return res.sendStatus(404);
 db.prepare('UPDATE fee_waiver_institutions SET active=? WHERE id=?').run(Number(active),id);
 audit(req.user.id,'fee_waiver_institution_status','fee_waiver_institution',id,{active});res.redirect('/admin/fees');
 }catch(e){next(e);}});
r.post('/batches',(req,res,next)=>{try{
 if(!enabled())throw Error('The fee waiver sandbox is disabled.');
 const data=z.object({institution_id:z.coerce.number().int().positive(),centre_id:z.string().optional(),percent:z.coerce.number().int(),quantity:z.coerce.number().int(),expiry_date:z.iso.date()}).parse(req.body);
 const issued=sandbox.issue({institutionId:data.institution_id,centreId:data.centre_id||null,percent:data.percent,quantity:data.quantity,expiryDate:data.expiry_date,actorId:req.user.id});
 res.set('Cache-Control','private, no-store');res.page('admin/fees-issued',{title:'One-time coupon codes',issued});
 }catch(e){next(e);}});
r.post('/batches/:id/status',(req,res,next)=>{try{
 const id=z.coerce.number().int().positive().parse(req.params.id),active=z.enum(['0','1']).parse(req.body.active);
 if(!db.prepare('SELECT id FROM fee_waiver_batches WHERE id=?').get(id))return res.sendStatus(404);
 db.prepare('UPDATE fee_waiver_batches SET active=? WHERE id=?').run(Number(active),id);
 audit(req.user.id,'fee_waiver_batch_status','fee_waiver_batch',id,{active});res.redirect('/admin/fees');
 }catch(e){next(e);}});
module.exports=r;
