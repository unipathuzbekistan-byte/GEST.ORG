const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const sharp=require('sharp');
const multer=require('multer');
const {db,audit}=require('./db');

const STORAGE=path.resolve(__dirname,'..','storage','signatures');
const MAX_UPLOAD=1024*1024;
const upload=multer({
 storage:multer.memoryStorage(),
 limits:{fileSize:MAX_UPLOAD,files:1,fields:5,fieldSize:300},
 fileFilter(req,file,cb){
  if(!['image/jpeg','image/png'].includes(file.mimetype))return cb(new Error('Signatures must be JPEG or PNG images.'));
  cb(null,true);
 }
});
function activeSignature(centreId){
 return db.prepare('SELECT * FROM centre_signatures WHERE centre_id=? AND active=1 ORDER BY id DESC LIMIT 1').get(centreId);
}
async function sanitizeSignature(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length<40||buffer.length>MAX_UPLOAD)throw Error('A JPEG or PNG signature of at most 1 MB is required.');
 const image=sharp(buffer,{limitInputPixels:4000000,animated:false,failOn:'error'});
 const m=await image.metadata();
 if(!['jpeg','png'].includes(m.format)||!m.width||!m.height||m.pages>1||m.width<120||m.height<25)throw Error('Invalid image. Use a single JPEG/PNG at least 120 by 25 pixels.');
 // Every accepted image is decoded and reconstructed; never serve the original upload.
 const clean=await image.rotate().resize(650,180,{fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
 if(clean.length>1024*1024)throw Error('Processed signature image exceeds 1 MB.');
 return clean;
}
function storedPath(filename){
 if(!/^[a-f0-9]{32}\.png$/.test(String(filename)))throw Error('Invalid signature path.');
 return path.join(STORAGE,filename);
}
async function setCentreSignature(centreId,actorId,data,image){
 const centre=db.prepare('SELECT id,code FROM centres WHERE id=?').get(centreId);
 if(!centre)throw Error('Centre not found.');
 const cleaned=await sanitizeSignature(image);
 fs.mkdirSync(STORAGE,{recursive:true,mode:0o700});
 const filename=crypto.randomBytes(16).toString('hex')+'.png';
 const filepath=storedPath(filename);
 fs.writeFileSync(filepath,cleaned,{flag:'wx',mode:0o600});
 try{
  const id=db.transaction(()=>{
   db.prepare("UPDATE centre_signatures SET active=0,retired_at=CURRENT_TIMESTAMP WHERE centre_id=? AND active=1").run(centreId);
   const id=Number(db.prepare('INSERT INTO centre_signatures(centre_id,signatory_name,signatory_title,image_file,created_by) VALUES(?,?,?,?,?)').run(centreId,data.signatory_name,data.signatory_title,filename,actorId).lastInsertRowid);
   audit(actorId,'centre_signature_approved','centre',centreId,{signature_id:id,code:centre.code,signatory_name:data.signatory_name,signatory_title:data.signatory_title});
   return id;
  })();
  return id;
 }catch(e){fs.rmSync(filepath,{force:true});throw e;}
}
function retireCentreSignature(centreId,actorId,reason){
 const current=activeSignature(centreId);
 if(!current)throw Error('No active signature for this centre.');
 db.transaction(()=>{
  db.prepare('UPDATE centre_signatures SET active=0,retired_at=CURRENT_TIMESTAMP WHERE id=?').run(current.id);
  audit(actorId,'centre_signature_retired','centre',centreId,{signature_id:current.id,reason});
 })();
}
module.exports={STORAGE,upload,activeSignature,sanitizeSignature,storedPath,setCentreSignature,retireCentreSignature};
