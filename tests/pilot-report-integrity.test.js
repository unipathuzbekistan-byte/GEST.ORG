const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Pilot certificate visibly states its non-official purpose',()=>{
 const view=source('views/pilot-certificate.ejs');
 assert.match(view,/PILOT RESULT · NOT AN OFFICIAL SCORE REPORT/);
 assert.match(view,/Administrator comments/i);
 assert.match(view,/NOT VALID FOR OFFICIAL CERTIFICATION/);
});
test('Mandatory disclaimer cannot be replaced by administrator comments',()=>{
 const module=source('src/pilot-certificate.js');
 assert.match(module,/scores are provisional and provided for diagnostic/);
 assert.match(module,/notice:PILOT_NOTICE/);
});
test('Approved pilot snapshot is required',()=>{
 const module=source('src/pilot-certificate.js');
 assert.match(module,/JOIN pilot_result_snapshots/);
 assert.match(module,/r\.status='approved'/);
 assert.doesNotMatch(module,/INSERT INTO certificates/i);
});
test('Pilot download is restricted to the owning candidate',()=>{
 const route=source('src/routes/candidate.js');
 assert.match(route,/r\.get\('\/pilot-report\/:id'/);
 assert.match(route,/r\.id=\? AND b\.user_id=\?/);
});
test('Official certificate issuer is still blocked for pilot results',()=>{
 const issuer=source('src/certificate.js');
 assert.match(issuer,/Provisional pilot results cannot receive an official GEST Test Report Form/);
});
