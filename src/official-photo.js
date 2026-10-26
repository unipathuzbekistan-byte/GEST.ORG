'use strict';
const sharp=require('sharp'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..','storage','photos');
async function prepare(file){
 if(!file?.buffer||file.buffer.length>3*1024*1024)throw Error('Official photo is required (maximum 3 MB).');
 let info;try{info=await sharp(file.buffer,{limitInputPixels:16_000_000,failOn:'error'}).metadata();}catch{throw Error('Invalid photograph. Use a real JPEG or PNG camera image.');}
 if(!['jpeg','png'].includes(info.format)||info.width<240||info.height<300)throw Error('Use a genuine JPEG/PNG photo of at least 240 × 300 pixels.');
 const data=await sharp(file.buffer,{limitInputPixels:16_000_000}).rotate().resize(480,600,{fit:'cover',position:'attention'}).jpeg({quality:88,mozjpeg:true}).toBuffer();
 return data;
}
function save(data){fs.mkdirSync(root,{recursive:true});const filename=crypto.randomBytes(20).toString('hex')+'.jpg';fs.writeFileSync(path.join(root,filename),data,{flag:'wx',mode:0o600});return filename;}
function remove(name){if(name&&/^[a-f0-9]{40}\.jpg$/.test(name))fs.rmSync(path.join(root,name),{force:true});}
module.exports={prepare,save,remove};
