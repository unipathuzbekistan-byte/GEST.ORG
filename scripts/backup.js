// Safe live SQLite backup via better-sqlite3's online backup interface.
const path=require('path'),fs=require('fs');
require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet:true});
const {db}=require('../src/db');
const folder=path.resolve(process.argv[2]||path.join(__dirname,'..','backups'));
fs.mkdirSync(folder,{recursive:true,mode:0o700});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const dest=path.join(folder,'gest-'+stamp+'.sqlite');
db.backup(dest).then(()=>{fs.chmodSync(dest,0o600);console.log('SQLite online backup created:',dest);console.log('Back up storage/photos and storage/certificates separately with matching timestamps.');db.close();}).catch(e=>{console.error(e);process.exitCode=1;});
