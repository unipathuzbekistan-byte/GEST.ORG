'use strict';
// Candidate identity evidence: random filenames, no public URLs, authenticated downloads,
// content validation and AES-256-GCM encryption at rest. Does not execute uploaded PDFs.
const crypto=require('crypto'),fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.join(__dirname,'..','storage','identity-documents');
function key(){const raw=process.env.IDENTITY_ENCRYPTION_KEY||'';if(!/^[a-fA-F0-9]{64}$/.test(raw))throw Error('IDENTITY_ENCRYPTION_KEY must be a private 64-character hex value in .env');return Buffer.from(raw,'hex');}
function safeBasename(name){return path.basename(String(name||'')).replace(/[^\w. -]/g,'_').slice(0,100)||'identity-document';}
function validatePdf(buf){
 if(buf.length<100 || buf.subarray(0,8).toString('latin1').slice(0,5)!=='%PDF-')throw Error('Invalid PDF content.');
 const trailer=buf.subarray(Math.max(0,buf.length-4096)).toString('latin1');
 if(!trailer.includes('%%EOF'))throw Error('The PDF is incomplete or damaged.');
 // Defence in depth; malicious content can be obfuscated, so PDFs are always download-only.
 const source=buf.toString('latin1');
 if(/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|RichMedia|XFA|Encrypt)\b/i.test(source))throw Error('Active PDF content is not accepted. Please upload a simple scanned document.');
 return buf;
}
async function normalizeUpload(file){
 if(!file||!Buffer.isBuffer(file.buffer)||file.buffer.length===0||file.buffer.length>5*1024*1024)throw Error('Select a document (maximum 5 MB).');
 const original=file.buffer;
 if(original.subarray(0,5).toString('latin1')==='%PDF-')return {bytes:validatePdf(original),mime:'application/pdf',extension:'pdf'};
 let meta;try{meta=await sharp(original,{limitInputPixels:16_000_000,failOn:'error'}).metadata();}catch{throw Error('Invalid file: upload a genuine PDF, JPEG or PNG.');}
 if(!['jpeg','png'].includes(meta.format)||meta.width<200||meta.height<200)throw Error('Document image must be a valid JPEG or PNG, at least 200 × 200.');
 const bytes=await sharp(original,{limitInputPixels:16_000_000}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).jpeg({quality:86,mozjpeg:true}).toBuffer();
 return {bytes,mime:'image/jpeg',extension:'jpg'};
}
function encrypt(data){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);return Buffer.concat([Buffer.from('GESTID01'),iv,cipher.getAuthTag(),ciphertext]);}
function decrypt(data){if(data.length<36||data.subarray(0,8).toString()!=='GESTID01')throw Error('Invalid encrypted document');const iv=data.subarray(8,20),tag=data.subarray(20,36);const decipher=crypto.createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data.subarray(36)),decipher.final()]);}
function documentPath(name){if(!/^[a-f0-9]{40}\.enc$/.test(name||''))throw Error('Invalid identity file reference');return path.join(root,name);}
function save(bytes){fs.mkdirSync(root,{recursive:true,mode:0o700});const filename=crypto.randomBytes(20).toString('hex')+'.enc';fs.writeFileSync(documentPath(filename),encrypt(bytes),{flag:'wx',mode:0o600});return filename;}
function read(name){return decrypt(fs.readFileSync(documentPath(name)));}
function remove(name){if(name)fs.rmSync(documentPath(name),{force:true});}
module.exports={normalizeUpload,validatePdf,encrypt,decrypt,save,read,remove,safeBasename};
