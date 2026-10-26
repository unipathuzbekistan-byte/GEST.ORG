const fs=require('fs'),path=require('path'),ejs=require('ejs'),QR=require('qrcode'),puppeteer=require('puppeteer-core');
const {db,setting,audit}=require('./db'),{nextFormNumber,securityCode,mac}=require('./identifiers'),{cefr}=require('./score');
const root=path.resolve(__dirname,'..');
const {activeSignature,storedPath}=require('./signatures');
const sharp=require('sharp');
const {certificateLogoData,fallbackSealData}=require('./certificate-branding');
function addYears(date,years){const d=new Date(date+'T12:00:00Z'),month=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()+years);if(d.getUTCMonth()!==month)d.setUTCDate(0);return d.toISOString().slice(0,10);}
function mrz(name,other,max=44){return String(name+'<'+other).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9<]/g,'<').padEnd(max,'<').slice(0,max);}
function candidateData(resultId){return db.prepare(`SELECT r.*,b.id booking_id,ca.family_name,ca.first_name,ca.dob,ca.sex,ca.country_origin,ca.nationality,ca.first_language,ca.id_document,ca.candidate_number,COALESCE(bi.official_photo_path,ca.photo_path) photo_path,s.test_date,s.start_time,c.id centre_id,c.code centre_code,c.name centre_name,u.email administrator_email FROM results r JOIN bookings b ON b.id=r.booking_id JOIN candidates ca ON ca.user_id=b.user_id JOIN sessions s ON s.id=b.session_id JOIN centres c ON c.id=s.centre_id LEFT JOIN booking_identity_checks bi ON bi.booking_id=b.id LEFT JOIN users u ON u.id=r.approved_by WHERE r.id=?`).get(resultId);}
async function generatePDF(info,cert,security,signatory){
 fs.mkdirSync(path.join(root,'storage','certificates'),{recursive:true});
 // Preserve the original stored signature for audit/history; trim unused transparent
 // (or pale) margins only in the PDF rendering, so ink is actually readable.
 let signatureData=null;
 if(signatory){
  const original=fs.readFileSync(storedPath(signatory.image_file));
  let display=original;
  try{
   display=await sharp(original).rotate().trim({threshold:18}).png().toBuffer();
  }catch(_err){ /* Older signatures with blank borders still render safely. */ }
  signatureData='data:image/png;base64,'+display.toString('base64');
 }
 const photo=info.photo_path?path.join(root,'storage','photos',info.photo_path):null;
 const logo=path.join(root,'public','img','logo.png');
 const photoData=photo&&fs.existsSync(photo)?'data:image/jpeg;base64,'+fs.readFileSync(photo).toString('base64'):null;
 const logoData=await certificateLogoData(logo);
 // Local brand assets are embedded into the PDF HTML to avoid file/HTTP loading
 // failures when Puppeteer renders a certificate server-side.
 const centreSealPath=path.join(root,'public','img','gest-centre-seal.png');
 const verifiedSealPath=path.join(root,'public','img','gest-verified-seal.png');
 const centreSealData=fs.existsSync(centreSealPath)?'data:image/png;base64,'+fs.readFileSync(centreSealPath).toString('base64'):fallbackSealData('centre');
 const verifiedSealData=fs.existsSync(verifiedSealPath)?'data:image/png;base64,'+fs.readFileSync(verifiedSealPath).toString('base64'):fallbackSealData('verified');
 const url=(process.env.BASE_URL||'http://localhost:3000').replace(/\/$/,'')+'/verify/'+encodeURIComponent(cert.form_number)+'?code='+encodeURIComponent(security);
 const qrData=await QR.toDataURL(url,{errorCorrectionLevel:'H',margin:1,width:240,color:{dark:'#0d3158',light:'#ffffffff'}});
 const scores=['listening','reading','writing','speaking'].map(key=>({label:key[0].toUpperCase()+key.slice(1),score:info[key],level:cefr(info[key])}));
 const line1=mrz('GEST<'+info.family_name,info.first_name);const line2=mrz(cert.form_number.replace(/-/g,'')+'<'+info.dob.replace(/-/g,'')+'<'+info.overall,info.test_date.replace(/-/g,''));
 const html=await ejs.renderFile(path.join(root,'views','certificate.ejs'),{info,cert,security,url,qrData,photoData,logoData,centreSealData,verifiedSealData,signatureData,signatory,scores,line1,line2,cefrBands:db.prepare('SELECT label FROM cefr_bands ORDER BY min_score').all()});
 const executablePath=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
 if(!executablePath)throw Error('Chromium is required for PDF generation. Set CHROMIUM_PATH.');
 let browser;try{browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']});const page=await browser.newPage();await page.setContent(html,{waitUntil:'load',timeout:30000});await page.pdf({path:path.join(root,'storage','certificates',cert.filename),format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}});}finally{if(browser)await browser.close();}
}
async function issue(resultId,actorId,{reissue=false}={}){
 const r=candidateData(resultId);if(!r||r.status!=='approved')throw Error('Result is not approved.');
 // Legacy pre-v1.3 results retain their historical photo and issuance flow.
 // For new centre check-ins, the signed official photo is bound to this booking.
 if(db.prepare('SELECT result_id FROM pilot_result_snapshots WHERE result_id=?').get(resultId))throw Error('Provisional pilot results cannot receive an official GEST Test Report Form.');
 const signatory=activeSignature(r.centre_id);
 if(!signatory)throw Error('This test centre has no approved administrator signature. Headquarters must upload it in Centres → Authorised signature before issuing a certificate.');
 const current=db.prepare("SELECT * FROM certificates WHERE result_id=? AND status='valid' ORDER BY id DESC LIMIT 1").get(resultId);
 if(current&&!reissue)throw Error('Certificate already issued.');
 const formNumber=db.transaction(()=>nextFormNumber())();let security;do{security=securityCode();}while(db.prepare('SELECT id FROM certificates WHERE security_hash=?').get(mac(security)));const today=new Date().toISOString().slice(0,10);
 const cert={form_number:formNumber,issue_date:today,expiry_date:addYears(today,Number(setting('cert_valid_years'))),filename:formNumber+'.pdf',security_hash:mac(security)};
 await generatePDF(r,cert,security,signatory);
 try{const id=db.transaction(()=>{if(current)db.prepare("UPDATE certificates SET status='reissued',revoked_reason=?,revoked_at=? WHERE id=?").run('Reissued by GEST headquarters',new Date().toISOString(),current.id);const id=Number(db.prepare('INSERT INTO certificates(result_id,form_number,security_hash,issue_date,expiry_date,filename) VALUES(?,?,?,?,?,?)').run(resultId,cert.form_number,cert.security_hash,cert.issue_date,cert.expiry_date,cert.filename).lastInsertRowid);db.prepare('INSERT INTO certificate_signatures(certificate_id,signature_id) VALUES(?,?)').run(id,signatory.id);return id;})();audit(actorId,reissue?'certificate_reissued':'certificate_issued','certificate',id,{form_number:cert.form_number,signature_id:signatory.id,centre_id:r.centre_id});return {...cert,id};}catch(e){fs.rmSync(path.join(root,'storage','certificates',cert.filename),{force:true});throw e;}
}
module.exports={issue,addYears,mrz,generatePDF};
