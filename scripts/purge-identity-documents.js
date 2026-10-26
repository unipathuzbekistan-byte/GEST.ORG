'use strict';
// Review legal retention requirements before scheduling. Dry-run unless --apply.
const {db,setting,audit}=require('../src/db');
const identity=require('../src/identity-documents');
const years=Number(setting('data_retention_years')||5),apply=process.argv.includes('--apply');
if(!Number.isInteger(years)||years<1||years>25)throw Error('Invalid data_retention_years setting');
const candidates=db.prepare(`SELECT d.user_id,d.storage_filename,d.uploaded_at FROM candidate_identity_documents d
 WHERE d.uploaded_at < datetime('now',?)
 AND NOT EXISTS(SELECT 1 FROM bookings b JOIN sessions s ON s.id=b.session_id WHERE b.user_id=d.user_id AND (s.test_date >= date('now',?) OR b.status='booked' AND s.test_date>=date('now'))) `).all('-'+years+' years','-'+years+' years');
console.log((apply?'APPLY':'DRY RUN')+': '+candidates.length+' identity documents older than '+years+' years; no active/recent bookings.');
if(!apply){console.log('No records changed. Run with --apply after legal review and backup.');process.exit(0);}
for(const row of candidates){db.transaction(()=>{db.prepare('DELETE FROM candidate_identity_documents WHERE user_id=? AND storage_filename=?').run(row.user_id,row.storage_filename);audit(null,'identity_document_retention_purged','candidate',row.user_id,{retention_years:years});})();identity.remove(row.storage_filename);}console.log('Purged '+candidates.length+' encrypted document files.');
