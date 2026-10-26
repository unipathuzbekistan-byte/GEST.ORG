const path=require('path');if(process.env.NODE_ENV!=='production')require('./ensure-env')();require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet:true});
const fs=require('fs'),bcrypt=require('bcryptjs'),sharp=require('sharp');
const {db,audit}=require('../src/db'),{nextCandidateNumber}=require('../src/identifiers'),{overall,cefr}=require('../src/score');
const {issue}=require('../src/certificate');
function offsetDate(days){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
async function main(){
 fs.mkdirSync(path.join(__dirname,'..','storage','photos'),{recursive:true});fs.mkdirSync(path.join(__dirname,'..','storage','certificates'),{recursive:true});
 if(process.argv.includes('--if-empty')&&db.prepare('SELECT COUNT(*) n FROM users').get().n>0)return;
 for(const k of (process.env.NODE_ENV==='production'&&process.env.SEED_DEMO!=='true'?['SUPER_ADMIN_EMAIL','SUPER_ADMIN_PASSWORD','CENTRE_ADMIN_EMAIL','CENTRE_ADMIN_PASSWORD']:['SUPER_ADMIN_EMAIL','SUPER_ADMIN_PASSWORD','CENTRE_ADMIN_EMAIL','CENTRE_ADMIN_PASSWORD','DEMO_CANDIDATE_EMAIL','DEMO_CANDIDATE_PASSWORD']))if(!process.env[k])throw Error(k+' missing from .env');
 const c=db.prepare('SELECT id FROM centres WHERE code=?').get('UZ001');
 const centreId=c?.id||db.prepare('INSERT INTO centres(code,name,country,city,address) VALUES(?,?,?,?,?)').run('UZ001','Prime School','Uzbekistan','Tashkent','Prime School, Tashkent, Uzbekistan').lastInsertRowid;
 async function account(email,password,role,centre){let user=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(user)return user.id;const hashed=await bcrypt.hash(password,12);return db.prepare('INSERT INTO users(email,password_hash,role,centre_id,verified) VALUES(?,?,?,?,1)').run(email,hashed,role,centre||null).lastInsertRowid;}
 const superId=await account(process.env.SUPER_ADMIN_EMAIL,process.env.SUPER_ADMIN_PASSWORD,'super_admin');
 await account(process.env.CENTRE_ADMIN_EMAIL,process.env.CENTRE_ADMIN_PASSWORD,'centre_admin',centreId);
 const demoId=process.env.NODE_ENV==='production'&&process.env.SEED_DEMO!=='true'?null:await account(process.env.DEMO_CANDIDATE_EMAIL,process.env.DEMO_CANDIDATE_PASSWORD,'candidate');
 const sessionStmt=db.prepare('SELECT id FROM sessions WHERE centre_id=? AND test_date=? AND start_time=?');
 for(const [days,time,seats,notes] of [[10,'09:00',25,'Morning session'],[24,'13:00',30,'Afternoon session']]){const date=offsetDate(days);if(!sessionStmt.get(centreId,date,time))db.prepare('INSERT INTO sessions(centre_id,test_date,start_time,capacity,notes) VALUES(?,?,?,?,?)').run(centreId,date,time,seats,notes);}
 if(demoId){
  let profile=db.prepare('SELECT * FROM candidates WHERE user_id=?').get(demoId);
  if(!profile){const photoName='demo-candidate.jpg',dest=path.join(__dirname,'..','storage','photos',photoName);if(!fs.existsSync(dest)){
   const svg='<svg width="480" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="480" height="600" fill="#dce6ed"/><circle cx="240" cy="213" r="103" fill="#aebfcc"/><ellipse cx="240" cy="554" rx="191" ry="215" fill="#aebfcc"/><text x="240" y="565" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="28" fill="#395470">DEMO CANDIDATE</text></svg>';
   await sharp(Buffer.from(svg)).jpeg({quality:90}).toFile(dest);}
   db.prepare('INSERT INTO candidates(user_id,candidate_number,family_name,first_name,dob,sex,country_origin,nationality,first_language,id_document,phone,photo_path,consent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(demoId,nextCandidateNumber(),'Candidate','Demo','1999-05-14','Other','Uzbekistan','Uzbek','Uzbek','DEMO-ID-001','+998900000000',photoName,new Date().toISOString());
   profile=db.prepare('SELECT * FROM candidates WHERE user_id=?').get(demoId);
  }
  const oldDate=offsetDate(-21),oldTime='09:00';let demoSession=sessionStmt.get(centreId,oldDate,oldTime)?.id;
  if(!demoSession)demoSession=db.prepare("INSERT INTO sessions(centre_id,test_date,start_time,capacity,notes,status) VALUES(?,?,?,?,?,'closed')").run(centreId,oldDate,oldTime,30,'Historical demonstration result').lastInsertRowid;
  let booking=db.prepare('SELECT id FROM bookings WHERE user_id=? AND session_id=?').get(demoId,demoSession)?.id;
  if(!booking)booking=db.prepare("INSERT INTO bookings(user_id,session_id,payment_status,checked_in_at) VALUES(?,?,'paid',?)").run(demoId,demoSession,new Date().toISOString()).lastInsertRowid;
  let result=db.prepare('SELECT id,status FROM results WHERE booking_id=?').get(booking);
  if(!result){const vals=[86,82,77,84],score=overall(vals);const id=db.prepare("INSERT INTO results(booking_id,listening,reading,writing,speaking,overall,cefr,comments,status,submitted_at,approved_at,approved_by) VALUES(?,?,?,?,?,?,?,?, 'approved',?,?,?)").run(booking,...vals,score,cefr(score),'Demonstration result for system training only.',new Date().toISOString(),new Date().toISOString(),superId).lastInsertRowid;result={id,status:'approved'};}
  if(process.env.SEED_DEMO_CERT==='true'&&!db.prepare('SELECT id FROM certificates WHERE result_id=?').get(result.id)){
   try{const cert=await issue(result.id,superId);console.log('Sample PDF certificate issued:',cert.form_number);}catch(e){console.warn('Sample PDF not issued:',e.message);}
  }
 }
 audit(superId,'system_seed','system','initial');
 console.log('Database seeded. Roles:',process.env.SUPER_ADMIN_EMAIL,process.env.CENTRE_ADMIN_EMAIL,process.env.NODE_ENV==='production'&&process.env.SEED_DEMO!=='true'?'(demo disabled in production)':process.env.DEMO_CANDIDATE_EMAIL);
 console.log('Seed credentials are stored only in your .env file.');
}
main().catch(e=>{console.error('Seed error:',e);process.exitCode=1;});
