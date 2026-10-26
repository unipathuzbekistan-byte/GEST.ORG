const path=require('path'),fs=require('fs'),Database=require('better-sqlite3');
require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet:true});
const filepath=path.resolve(__dirname,'..',process.env.DATABASE_PATH||'./data/gest.sqlite');
fs.mkdirSync(path.dirname(filepath),{recursive:true});
const db=new Database(filepath); db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');db.pragma('busy_timeout = 5000');
db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
const defaults={cancel_days:'7',cert_valid_years:'2',data_retention_years:'5',booking_information:'Development sandbox: no real money is collected.',exam_fee_uzs:'890000',headquarters_email:'info@gest.example'};
for(const [key,value] of Object.entries(defaults))db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run(key,value);
const bands=[['<A1',0,19],['A1',20,34],['A2',35,49],['B1',50,64],['B2',65,79],['C1',80,91],['C2',92,100]];
for(let i=0;i<bands.length;i++)db.prepare('INSERT OR IGNORE INTO cefr_bands(label,min_score,max_score,sort_order) VALUES (?,?,?,?)').run(...bands[i],i);
function setting(key){return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;}
function audit(actor,action,entity,id,details={}){db.prepare('INSERT INTO audit_logs(actor_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)').run(actor||null,action,entity,String(id??''),JSON.stringify(details));}
module.exports={db,setting,audit};
