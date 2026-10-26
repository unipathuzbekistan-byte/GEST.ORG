/* Real HTTP integration: registration → email verification → profile/identity-upload → booking →
   payment → check-in → scores → approval/PDF → public verification. */
const path=require('path'),fs=require('fs'),os=require('os'),assert=require('node:assert/strict'),{spawnSync}=require('child_process');
require('../scripts/ensure-env')();require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet:true});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gest-flow-'));process.env.DATABASE_PATH=path.join(tmp,'flow.sqlite');process.env.NODE_ENV='development';
process.env.CHROMIUM_PATH=process.env.CHROMIUM_PATH||'/usr/bin/chromium';process.env.PAYMENT_MODE='sandbox';
const seed=spawnSync(process.execPath,[path.join(__dirname,'..','scripts','seed.js'),'--if-empty'],{env:process.env,stdio:'pipe',encoding:'utf8'});if(seed.status!==0)throw Error('Could not seed integration database: '+seed.stderr);
const sharp=require('sharp'),{db}=require('../src/db');
const createdSignatures=new Set();let capturedPhoto=null;let encryptedFile=null;let mailLog='';const origLog=console.log;console.log=(...args)=>{mailLog+=args.join(' ')+'\n';origLog(...args);};
const app=require('../src/app');
function client(base){let cookie='';async function request(url,opts={}){const headers={...(opts.headers||{})};if(cookie)headers.cookie=cookie;const res=await fetch(base+url,{...opts,headers,redirect:'manual'});const set=res.headers.get('set-cookie');if(set){const found=set.match(/gest\.sid=[^;]+/);if(found)cookie=found[0];}return {res,text:await res.text()};}
 async function get(url){return request(url);}async function post(url,data){const page=await get(url.startsWith('/candidate/')?'/candidate':url.startsWith('/centre/')?'/centre':url.startsWith('/admin/')?'/admin':'/login');const csrf=(page.text.match(/name="_csrf" value="([a-f0-9]+)"/)||[])[1];assert.ok(csrf,'CSRF token on '+url);const body=new URLSearchParams({_csrf:csrf,...data});return request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});}
 return{get,post,request};}
(async()=>{const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const email='flow-'+Date.now()+'@example.test',candidate=client(base),registration=await candidate.get('/register');assert.equal(registration.res.status,200);
  let csrf=registration.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];let result=await candidate.request('/register',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,email,password:'Flow-Example-Strong-Password-123',consent:'on'})});assert.equal(result.res.status,200,'registration');
  const token=(mailLog.match(/\/verify-email\/([a-f0-9]{64})/)||[])[1];assert.ok(token,'verification email token');result=await candidate.get('/verify-email/'+token);assert.equal(result.res.status,200);
  result=await candidate.post('/login',{email,password:'Flow-Example-Strong-Password-123'});assert.equal(result.res.status,302,'candidate login');
  const profilePage=await candidate.get('/candidate/profile');csrf=profilePage.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  result=await candidate.request('/candidate/profile',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,family_name:'Integration',first_name:'Candidate',dob:'1996-06-21',sex:'Female',country_origin:'Uzbekistan',nationality:'Uzbek',first_language:'Uzbek',id_document:'FLOW-12345',phone:'+998900001234',consent:'on'})});
  assert.equal(result.res.status,302,'candidate personal profile');
  // Candidate submits a real image/PDF copy, never an official certificate portrait.
  const jpg=await sharp({create:{width:480,height:600,channels:3,background:'#b6c8da'}}).jpeg().toBuffer();
  const docForm=new FormData();docForm.set('_csrf',csrf);docForm.set('document_type','passport');docForm.set('document',new Blob([jpg],{type:'image/jpeg'}),'passport-scan.jpg');
  result=await candidate.request('/candidate/identity-document',{method:'POST',body:docForm});assert.equal(result.res.status,302,'secure ID upload');
  const encrypted=db.prepare('SELECT * FROM candidate_identity_documents WHERE user_id=(SELECT id FROM users WHERE email=?)').get(email);
  assert.ok(encrypted,'encrypted identity record');encryptedFile=encrypted.storage_filename;assert.match(encrypted.storage_filename,/^[a-f0-9]{40}\.enc$/);
  const s=db.prepare("SELECT s.id FROM sessions s WHERE test_date>date('now') AND status='open' ORDER BY test_date LIMIT 1").get();assert.ok(s);result=await candidate.post('/candidate/book/'+s.id,{});assert.equal(result.res.status,302,'booking');const booking=db.prepare('SELECT b.*,ca.candidate_number FROM bookings b JOIN candidates ca ON ca.user_id=b.user_id WHERE b.session_id=? AND ca.first_name=?').get(s.id,'Candidate');assert.match(booking.candidate_number,/^\d{6}$/);
  const checkout=await candidate.get('/candidate/payment/'+booking.id);assert.equal(checkout.res.status,200,'sandbox checkout');result=await candidate.post('/candidate/payment/'+booking.id+'/simulate',{outcome:'success'});assert.equal(result.res.status,302,'simulated payment');assert.equal(db.prepare('SELECT payment_status FROM bookings WHERE id=?').get(booking.id).payment_status,'paid');const centre=client(base);result=await centre.post('/login',{email:process.env.CENTRE_ADMIN_EMAIL,password:process.env.CENTRE_ADMIN_PASSWORD});assert.equal(result.res.status,302,'centre login');const identityPage=await centre.get('/centre/booking/'+booking.id+'/identity');assert.equal(identityPage.res.status,200,'staff-only identity check');
  const staffCSRF=(identityPage.text.match(/name="_csrf" value="([a-f0-9]+)"/)||[])[1];assert.ok(staffCSRF);
  const cameraForm=new FormData();cameraForm.set('_csrf',staffCSRF);cameraForm.set('candidate_present','on');cameraForm.set('id_confirmed','on');cameraForm.set('official_photo',new Blob([jpg],{type:'image/jpeg'}),'centre-camera.jpg');
  result=await centre.request('/centre/booking/'+booking.id+'/identity/verify',{method:'POST',body:cameraForm});assert.equal(result.res.status,302,'camera and physical ID check');
  assert.ok(db.prepare('SELECT id FROM bookings WHERE id=? AND checked_in_at IS NOT NULL').get(booking.id));
  assert.ok(db.prepare('SELECT verified_at FROM booking_identity_checks WHERE booking_id=?').get(booking.id));capturedPhoto=db.prepare('SELECT official_photo_path FROM booking_identity_checks WHERE booking_id=?').get(booking.id).official_photo_path;result=await centre.post('/centre/booking/'+booking.id+'/scores',{listening:'90',reading:'78',writing:'86',speaking:'82',comments:'Demonstration assessment.',action:'submitted'});assert.equal(result.res.status,302,'score submission');const r=db.prepare('SELECT * FROM results WHERE booking_id=?').get(booking.id);assert.equal(r.overall,84);assert.equal(r.status,'submitted');
  const admin=client(base);result=await admin.post('/login',{email:process.env.SUPER_ADMIN_EMAIL,password:process.env.SUPER_ADMIN_PASSWORD});assert.equal(result.res.status,302,'admin login');
  const centreId=db.prepare('SELECT centre_id FROM sessions WHERE id=?').get(s.id).centre_id;
  // Approve an explicitly TEST-ONLY generated signature before issuing any PDF.
  const signaturePage=await admin.get('/admin/centres/'+centreId+'/signature');
  assert.equal(signaturePage.res.status,200,'signature page restricted to headquarters');
  const signatureCSRF=(signaturePage.text.match(/name="_csrf" value="([a-f0-9]+)"/)||[])[1];
  assert.ok(signatureCSRF);
  const sigFile=await sharp({create:{width:460,height:120,channels:4,background:'#ffffff00'}}).png().toBuffer();
  const sigForm=new FormData();
  for(const [k,v] of Object.entries({_csrf:signatureCSRF,signatory_name:'Integration Authorised Officer',signatory_title:'Test Centre Administrator',confirmed:'on'}))sigForm.set(k,v);
  sigForm.set('signature',new Blob([sigFile],{type:'image/png'}),'test-signature.png');
  result=await admin.request('/admin/centres/'+centreId+'/signature',{method:'POST',body:sigForm});
  assert.equal(result.res.status,302,'headquarters signatory approval');
  const signatureId=db.prepare('SELECT id FROM centre_signatures WHERE centre_id=? AND active=1').get(centreId)?.id;
  assert.ok(signatureId,'new centre signature recorded');
  createdSignatures.add(db.prepare('SELECT image_file FROM centre_signatures WHERE id=?').get(signatureId).image_file);
  result=await admin.post('/admin/results/'+r.id+'/approve',{});assert.equal(result.res.status,302,'approval + PDF: '+result.text.slice(0,100));const cert=db.prepare('SELECT * FROM certificates WHERE result_id=?').get(r.id);assert.ok(cert,'certificate issued');assert.equal(db.prepare('SELECT signature_id FROM certificate_signatures WHERE certificate_id=?').get(cert.id)?.signature_id,signatureId,'certificate is bound to approved signature version');const file=path.join(__dirname,'..','storage','certificates',cert.filename);assert.ok(fs.statSync(file).size>10000,'non-empty PDF');
  // Replacing the current signature must NOT change the already issued PDF or its snapshot.
  const pdfBefore=require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  sigForm.set('signatory_name','Next Integration Signatory');
  result=await admin.request('/admin/centres/'+centreId+'/signature',{method:'POST',body:sigForm});
  assert.equal(result.res.status,302,'signature rotated');
  assert.notEqual(db.prepare('SELECT id FROM centre_signatures WHERE centre_id=? AND active=1').get(centreId).id,signatureId);
  createdSignatures.add(db.prepare('SELECT image_file FROM centre_signatures WHERE centre_id=? AND active=1').get(centreId).image_file);
  assert.equal(db.prepare('SELECT signature_id FROM certificate_signatures WHERE certificate_id=?').get(cert.id).signature_id,signatureId,'original signatory recorded');
  assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'),pdfBefore,'issued PDF unchanged after rotation');
  result=await candidate.get('/candidate/certificate/'+cert.id);assert.equal(result.res.status,200,'candidate PDF download');
  const output=spawnSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});if(output.status!==0)throw Error('Install poppler-utils / pdftotext for PDF verification flow tests.');const code=(output.stdout.match(/\b[2-9A-HJ-KM-NP-Z]{4}(?:-[2-9A-HJ-KM-NP-Z]{4}){2}\b/)||[])[0];assert.ok(code,'PDF contains security code');assert.equal(db.prepare('SELECT security_hash FROM certificates WHERE id=?').get(cert.id).security_hash.includes(code),false,'code not stored in plaintext');
  const publicUser=client(base);result=await publicUser.post('/verify',{form_number:cert.form_number,security_code:code});assert.equal(result.res.status,200);assert.match(result.text,/VALID CERTIFICATE/);result=await publicUser.get('/verify/'+cert.form_number+'?code='+encodeURIComponent(code));assert.match(result.text,/VALID CERTIFICATE/);result=await publicUser.post('/verify',{form_number:cert.form_number,security_code:'2345-6789-ABCD'});assert.match(result.text,/UNABLE TO VERIFY/);
  result=await admin.post('/admin/certificates/'+cert.id+'/revoke',{reason:'Integration test revocation'});assert.equal(result.res.status,302);result=await publicUser.get('/verify/'+cert.form_number+'?code='+encodeURIComponent(code));assert.match(result.text,/CERTIFICATE NOT VALID/);
  console.log('PASS: registration → email → profile/identity-upload → booking → payment → check-in → scores → approve → PDF → verify → revoke');
  fs.rmSync(file,{force:true});
 }finally{await new Promise(resolve=>server.close(resolve));db.close();for(const signature of createdSignatures){fs.rmSync(path.join(__dirname,'..','storage','signatures',signature),{force:true});}if(capturedPhoto)require('../src/official-photo').remove(capturedPhoto);if(encryptedFile)require('../src/identity-documents').remove(encryptedFile);fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
