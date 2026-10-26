// A separate diagnostic PDF for approved pilot results. Not part of the
// official certificate/verification system and never assigned a TRF number.
const fs=require('fs');
const path=require('path');
const ejs=require('ejs');
const puppeteer=require('puppeteer-core');
const {db}=require('./db');
const {certificateLogoData}=require('./certificate-branding');
const root=path.resolve(__dirname,'..');

const PILOT_NOTICE='This report has been issued as part of GEST Pilot Test 001, the first pilot administration of the Global English Skills Test. The scores are provisional and provided for diagnostic and evaluation purposes only. They do not constitute officially validated or internationally recognised English proficiency results.';

function pilotResult(resultId){
 const result=db.prepare(`SELECT r.id,r.status,r.overall,r.listening,r.reading,r.writing,r.speaking,r.cefr,r.comments,r.approved_at,
  ca.family_name,ca.first_name,ca.candidate_number,
  COALESCE(bi.official_photo_path,ca.photo_path) AS photo_path,
  c.code AS centre_code,c.name AS centre_name,s.test_date,pf.code AS pilot_form,
  ps.version AS pilot_version
  FROM results r
  JOIN pilot_result_snapshots ps ON ps.result_id=r.id
  JOIN pilot_forms pf ON pf.id=ps.form_id
  JOIN bookings b ON b.id=r.booking_id
  JOIN candidates ca ON ca.user_id=b.user_id
  JOIN sessions s ON s.id=b.session_id
  JOIN centres c ON c.id=s.centre_id
  LEFT JOIN booking_identity_checks bi ON bi.booking_id=b.id
  WHERE r.id=? AND r.status='approved'`).get(resultId);
 return result||null;
}

async function generatePilotReport(resultId){
 const result=pilotResult(resultId);
 if(!result)throw Error('Approved pilot diagnostic result not found.');
 const photoFile=result.photo_path?path.join(root,'storage','photos',result.photo_path):null;
 const photoData=photoFile&&fs.existsSync(photoFile)?'data:image/jpeg;base64,'+fs.readFileSync(photoFile).toString('base64'):null;
 const logoData=await certificateLogoData(path.join(root,'public','img','logo.png'));
 const html=await ejs.renderFile(path.join(root,'views','pilot-certificate.ejs'),{
  result,logoData,photoData,notice:PILOT_NOTICE,
  publishedDate:(result.approved_at||new Date().toISOString()).slice(0,10),
  skills:[['Listening',result.listening],['Reading',result.reading],['Writing',result.writing],['Speaking',result.speaking]]
 });
 const executablePath=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
 if(!executablePath)throw Error('Chromium is required for PDF generation. Set CHROMIUM_PATH.');
 let browser;
 try{
  browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const page=await browser.newPage();
  await page.setContent(html,{waitUntil:'load',timeout:30000});
  return Buffer.from(await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}}));
 }finally{if(browser)await browser.close();}
}

function filename(result){return 'GEST-PILOT-001-'+String(result.candidate_number||result.id).replace(/[^0-9]/g,'')+'.pdf';}
module.exports={PILOT_NOTICE,pilotResult,generatePilotReport,filename};
