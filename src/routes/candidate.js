const express=require('express'),sharp=require('sharp'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const {db,setting,audit}=require('../db'),{auth,role,flash}=require('../middleware'),{profile,z}=require('../validation'),{nextCandidateNumber}=require('../identifiers');
const documents=require('../identity-documents');
const {buildService,enabled}=require('../payment-sandbox');
const sandbox=buildService(db,process.env.FEE_WAIVER_HMAC_SECRET,audit);
const rateLimit=require('express-rate-limit');
const uploadLimit=rateLimit({windowMs:60*60*1000,limit:12,standardHeaders:'draft-8',legacyHeaders:false});
const r=express.Router();r.use(auth,role('candidate'));
const checkoutLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-8',legacyHeaders:false});
function own(req){return db.prepare('SELECT * FROM candidates WHERE user_id=?').get(req.user.id);}
function complete(c){return ['family_name','first_name','dob','sex','country_origin','nationality','first_language','id_document','phone','consent_at'].every(k=>Boolean(c?.[k])) && Boolean(db.prepare("SELECT 1 FROM candidate_identity_documents WHERE user_id=? AND status!='rejected'").get(c?.user_id));}
function locked(userId){return Boolean(db.prepare('SELECT 1 FROM bookings WHERE user_id=? AND checked_in_at IS NOT NULL LIMIT 1').get(userId));}
function doc(userId){return db.prepare('SELECT document_type,mime_type,size_bytes,uploaded_at,status,storage_filename FROM candidate_identity_documents WHERE user_id=?').get(userId);}
r.get('/',(req,res)=>{const c=own(req),bookings=db.prepare(`SELECT b.*,s.test_date,s.start_time,ce.name centre_name,ce.code centre_code,r.id result_id,r.status result_status,r.listening,r.reading,r.writing,r.speaking,r.overall,r.cefr,(SELECT CASE WHEN pr.result_id IS NOT NULL THEN 1 ELSE 0 END FROM pilot_result_snapshots pr WHERE pr.result_id=r.id) is_pilot,(SELECT cert.id FROM certificates cert WHERE cert.result_id=r.id AND cert.status='valid' AND cert.expiry_date>=date('now') ORDER BY cert.id DESC LIMIT 1) certificate_id FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN centres ce ON ce.id=s.centre_id LEFT JOIN results r ON r.booking_id=b.id WHERE b.user_id=? ORDER BY s.test_date DESC`).all(req.user.id);res.page('candidate/dashboard',{title:'Candidate dashboard',candidate:c,complete:complete(c),identityDocument:doc(req.user.id),bookings,canSandbox:enabled()});});
r.get('/profile',(req,res)=>res.page('candidate/profile',{title:'Your profile',candidate:own(req),identityDocument:doc(req.user.id),identityLocked:locked(req.user.id)}));
r.post('/profile',(req,res,next)=>{try{
 const data=profile.parse(req.body);
 if(data.dob>new Date().toISOString().slice(0,10))throw Error('Date of birth cannot be in the future.');
 if(locked(req.user.id))throw Error('Identity fields are locked after check-in. Contact GEST headquarters to request a correction.');
 db.prepare(`UPDATE candidates SET family_name=?,first_name=?,dob=?,sex=?,country_origin=?,nationality=?,first_language=?,id_document=?,phone=?,consent_at=COALESCE(consent_at,?) WHERE user_id=?`).run(data.family_name,data.first_name,data.dob,data.sex,data.country_origin,data.nationality,data.first_language,data.id_document,data.phone,new Date().toISOString(),req.user.id);
 audit(req.user.id,'profile_updated','candidate',req.user.id);flash(req,'success','Profile saved. Upload your identity document to finish registration.');res.redirect('/candidate/profile');
 }catch(e){next(e);}});
// The candidate can upload identity evidence but cannot supply the official certificate photo.
r.post('/identity-document',uploadLimit,async(req,res,next)=>{try{
 if(locked(req.user.id))throw Error('Identity evidence is locked after an exam check-in. Contact headquarters for corrections.');
 const docType=z.enum(['passport','national_id']).parse(req.body.document_type);
 if(!own(req)?.consent_at)throw Error('Save your profile with consent before uploading an identity document.');
 const normalized=await documents.normalizeUpload(req.file);
 const sha256=crypto.createHash('sha256').update(normalized.bytes).digest('hex');
 const filename=documents.save(normalized.bytes);
 let previous;
 try{previous=db.transaction(()=>{
  const prev=db.prepare('SELECT storage_filename FROM candidate_identity_documents WHERE user_id=?').get(req.user.id);
  db.prepare(`INSERT INTO candidate_identity_documents(user_id,document_type,storage_filename,mime_type,sha256,size_bytes,status,uploaded_at,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,'pending',CURRENT_TIMESTAMP,NULL,NULL)
  ON CONFLICT(user_id) DO UPDATE SET document_type=excluded.document_type,storage_filename=excluded.storage_filename,mime_type=excluded.mime_type,sha256=excluded.sha256,size_bytes=excluded.size_bytes,status='pending',uploaded_at=CURRENT_TIMESTAMP,reviewed_by=NULL,reviewed_at=NULL`).run(req.user.id,docType,filename,normalized.mime,sha256,normalized.bytes.length);
  return prev?.storage_filename;
 })();}catch(e){documents.remove(filename);throw e;}
 if(previous)documents.remove(previous);
 audit(req.user.id,'identity_document_uploaded','candidate',req.user.id,{document_type:docType,mime:normalized.mime,size:normalized.bytes.length});
 flash(req,'success','Identity document received securely. Bring your original ID to the test centre.');res.redirect('/candidate/profile');
 }catch(e){next(e);}});
r.get('/identity-document/download',(req,res,next)=>{try{const record=doc(req.user.id);if(!record)return res.sendStatus(404);const bytes=documents.read(record.storage_filename);res.set({'Content-Type':record.mime_type,'Content-Disposition':'attachment; filename="gest-my-id.'+(record.mime_type==='application/pdf'?'pdf':'jpg')+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});audit(req.user.id,'identity_document_self_export','candidate',req.user.id);res.send(bytes);}catch(e){next(e);}});
r.get('/photo',(req,res)=>{const record=db.prepare(`SELECT bi.official_photo_path FROM booking_identity_checks bi JOIN bookings b ON b.id=bi.booking_id WHERE b.user_id=? ORDER BY bi.verified_at DESC LIMIT 1`).get(req.user.id);const photo=record?.official_photo_path||own(req)?.photo_path;if(!photo)return res.sendStatus(404);res.set('Cache-Control','private, no-store');res.sendFile(path.join(__dirname,'..','..','storage','photos',photo));});
// Only the account owner can open or operate an order. No bank or card information is accepted.
r.get('/payment/:id',(req,res,next)=>{try{
 if(!enabled())return res.status(503).page('message',{title:'Sandbox unavailable',message:'The development-only sandbox is disabled. Contact your centre for payment instructions.'});
 const id=z.coerce.number().int().positive().parse(req.params.id);
 const booking=db.prepare(`SELECT b.*,s.test_date,s.start_time,c.code centre_code,c.name centre_name FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN centres c ON c.id=s.centre_id WHERE b.id=? AND b.user_id=?`).get(id,req.user.id);
 if(!booking||booking.status!=='booked')return res.sendStatus(404);
 const order=sandbox.ensureOrder(id,setting('exam_fee_uzs'));
 res.set('Cache-Control','private, no-store');
 res.page('candidate/payment',{title:'Demo payment checkout',booking,order,sandbox:true});
 }catch(e){next(e);}});
r.post('/payment/:id/coupon',checkoutLimiter,(req,res,next)=>{try{
 if(!enabled())return res.sendStatus(404);
 const id=z.coerce.number().int().positive().parse(req.params.id);
 const code=z.string().min(12).max(32).parse(req.body.coupon);
 const result=sandbox.apply({bookingId:id,userId:req.user.id,code,actorId:req.user.id});
 flash(req,'success',result.status==='waived'?'100% fee waiver applied. Your booking is marked paid (demo only).':result.percent+'% voucher accepted. Remaining sandbox amount: '+result.due.toLocaleString('en-US')+' UZS.');
 res.redirect('/candidate/payment/'+id);
 }catch(e){if(e.message==='Coupon is not valid or is no longer available.')return res.status(400).page('message',{title:'Coupon not accepted',message:'This code is invalid, already used, expired, disabled, or not valid for the selected centre.',action:{href:'/candidate',label:'Back to bookings'}});next(e);}});
r.post('/payment/:id/simulate',checkoutLimiter,(req,res,next)=>{try{
 const id=z.coerce.number().int().positive().parse(req.params.id);
 const outcome=z.enum(['success','declined']).parse(req.body.outcome);
 const state=sandbox.simulate({bookingId:id,userId:req.user.id,outcome,actorId:req.user.id});
 flash(req,state==='paid'?'success':'warning',state==='paid'?'Sandbox SUCCESS: demo booking marked paid. No money was collected.':'Sandbox DECLINED: no money was collected. You can retry.');
 res.redirect('/candidate/payment/'+id);
 }catch(e){next(e);}});
r.post('/payment/:id/retry',checkoutLimiter,(req,res,next)=>{try{
 const id=z.coerce.number().int().positive().parse(req.params.id);sandbox.retry({bookingId:id,userId:req.user.id});
 res.redirect('/candidate/payment/'+id);
 }catch(e){next(e);}});
r.post('/book/:sessionId',(req,res,next)=>{try{const id=z.coerce.number().int().positive().parse(req.params.sessionId),c=own(req);if(!req.user.verified||!complete(c))return res.status(400).page('message',{title:'Complete your profile',message:'Verify your email, complete your profile and securely upload your passport or ID card before booking.',action:{href:'/candidate/profile',label:'Complete profile'}});
 const bookingId=db.transaction(()=>{const s=db.prepare("SELECT s.*,c.active FROM sessions s JOIN centres c ON c.id=s.centre_id WHERE s.id=? AND s.status='open' AND s.test_date>=date('now')").get(id);if(!s||!s.active)throw Error('This session is no longer available.');const existing=db.prepare('SELECT * FROM bookings WHERE user_id=? AND session_id=?').get(req.user.id,id);if(existing?.status==='booked')throw Error('You have already booked this session.');if(existing&&db.prepare('SELECT id FROM results WHERE booking_id=?').get(existing.id))throw Error('A scored booking cannot be reactivated.');if(existing&&existing.payment_status==='paid')throw Error('A paid or fee-waived booking cannot be reactivated automatically. Contact the centre.');const seats=db.prepare("SELECT COUNT(*) n FROM bookings WHERE session_id=? AND status='booked'").get(id).n;if(seats>=s.capacity)throw Error('This session is full.');if(!c.candidate_number)db.prepare('UPDATE candidates SET candidate_number=? WHERE user_id=?').run(nextCandidateNumber(),req.user.id);if(existing){db.prepare("UPDATE bookings SET status='booked',cancelled_at=NULL,payment_status='pending',checked_in_at=NULL WHERE id=?").run(existing.id);if(enabled()){sandbox.resetAfterRebooking(existing.id);sandbox.ensureOrder(existing.id,setting('exam_fee_uzs'));}return existing.id;}const newId=db.prepare('INSERT INTO bookings(user_id,session_id) VALUES(?,?)').run(req.user.id,id).lastInsertRowid;if(enabled())sandbox.ensureOrder(newId,setting('exam_fee_uzs'));return newId;})();audit(req.user.id,'booked','booking',bookingId);flash(req,'success',enabled()?'Seat reserved. Complete your simulated payment (no real money).':'Seat reserved. Your centre will confirm payment.');res.redirect(enabled()?'/candidate/payment/'+bookingId:'/candidate');}catch(e){next(e);}});
r.post('/cancel/:id',(req,res,next)=>{try{const id=z.coerce.number().int().positive().parse(req.params.id);const b=db.prepare('SELECT b.*,s.test_date FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.id=? AND b.user_id=?').get(id,req.user.id);if(!b||b.status!=='booked')throw Error('Booking not found.');if(b.checked_in_at||db.prepare('SELECT id FROM results WHERE booking_id=?').get(id))throw Error('This booking can no longer be cancelled.');const deadline=new Date(b.test_date+'T00:00:00Z');deadline.setUTCDate(deadline.getUTCDate()-Number(setting('cancel_days')));if(new Date()>=deadline)throw Error(`Cancellation must be at least ${setting('cancel_days')} days before the test.`);db.prepare("UPDATE bookings SET status='cancelled',cancelled_at=? WHERE id=?").run(new Date().toISOString(),id);audit(req.user.id,'booking_cancelled','booking',id);flash(req,'success','Booking cancelled. No refund has been issued; any previous demo payment remains recorded.');res.redirect('/candidate');}catch(e){next(e);}});
r.get('/certificate/:id',(req,res,next)=>{try{const id=z.coerce.number().int().positive().parse(req.params.id);const cert=db.prepare("SELECT cert.* FROM certificates cert JOIN results r ON r.id=cert.result_id JOIN bookings b ON b.id=r.booking_id WHERE cert.id=? AND b.user_id=?").get(id,req.user.id);if(!cert||cert.status!=='valid'||cert.expiry_date<new Date().toISOString().slice(0,10))return res.sendStatus(404);res.set('Cache-Control','private, no-store');res.download(path.join(__dirname,'..','..','storage','certificates',cert.filename),cert.form_number+'.pdf');}catch(e){next(e);}});
r.get('/pilot-report/:id',async(req,res,next)=>{try{
 const id=z.coerce.number().int().positive().parse(req.params.id);
 const owns=db.prepare('SELECT 1 FROM results r JOIN bookings b ON b.id=r.booking_id WHERE r.id=? AND b.user_id=?').get(id,req.user.id);
 if(!owns)return res.sendStatus(404);
 const service=require('../pilot-certificate'),result=service.pilotResult(id);
 if(!result)return res.sendStatus(404);
 const pdf=await service.generatePilotReport(id);
 audit(req.user.id,'pilot_report_downloaded','result',id);
 res.set({'Cache-Control':'private, no-store','Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+service.filename(result)+'"','X-Content-Type-Options':'nosniff'});
 res.send(pdf);
 }catch(e){next(e);}});
r.get('/data-export',(req,res)=>{const c=own(req),bookings=db.prepare('SELECT b.*,s.test_date,s.start_time,c.code centre_code,c.name centre_name FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN centres c ON c.id=s.centre_id WHERE b.user_id=?').all(req.user.id),results=db.prepare('SELECT r.* FROM results r JOIN bookings b ON b.id=r.booking_id WHERE b.user_id=?').all(req.user.id);res.set('Cache-Control','private, no-store');res.attachment('gest-personal-data.json');let profile_photo_jpeg_base64=null;if(c?.photo_path){try{profile_photo_jpeg_base64=fs.readFileSync(path.join(__dirname,'..','..','storage','photos',c.photo_path)).toString('base64');}catch{}}const pilotAssessments=db.prepare('SELECT a.booking_id,a.reading_responses,a.listening_responses,a.reading_correct,a.listening_correct,a.reading_score,a.listening_score,a.speaking_rubric,a.speaking_score,a.updated_at FROM pilot_assessments a JOIN bookings b ON b.id=a.booking_id WHERE b.user_id=?').all(req.user.id);
const pilotWritingMarks=db.prepare('SELECT m.booking_id,m.task1_json,m.task2_json,m.task1_score,m.task2_score,m.score,m.created_at FROM pilot_writing_marks m JOIN bookings b ON b.id=m.booking_id WHERE b.user_id=?').all(req.user.id);
res.json({account:{email:req.user.email,created_at:db.prepare('SELECT created_at FROM users WHERE id=?').get(req.user.id).created_at},profile:c,profile_photo_jpeg_base64,identity_document:doc(req.user.id)?{...doc(req.user.id),storage_filename:undefined}:null,identity_document_download:'/candidate/identity-document/download',booking_identity_checks:db.prepare('SELECT bi.booking_id,bi.verified_at FROM booking_identity_checks bi JOIN bookings b ON b.id=bi.booking_id WHERE b.user_id=?').all(req.user.id),bookings,results,pilotAssessments,pilotWritingMarks,payment_orders:db.prepare('SELECT p.booking_id,p.original_amount,p.discount_amount,p.amount_due,p.provider,p.status,p.created_at,p.updated_at FROM payment_orders p JOIN bookings b ON b.id=p.booking_id WHERE b.user_id=?').all(req.user.id)});});
r.post('/deletion-request',(req,res)=>{db.transaction(()=>{db.prepare('UPDATE candidates SET deletion_requested_at=COALESCE(deletion_requested_at,?) WHERE user_id=?').run(new Date().toISOString(),req.user.id);if(!db.prepare("SELECT id FROM privacy_requests WHERE user_id=? AND status IN ('pending','in_review')").get(req.user.id))db.prepare('INSERT INTO privacy_requests(user_id) VALUES(?)').run(req.user.id);})();audit(req.user.id,'account_deletion_requested','candidate',req.user.id);res.page('message',{title:'Request received',message:'Your data deletion request has been recorded. GEST headquarters will review it against applicable record-retention obligations.'});});
module.exports=r;
