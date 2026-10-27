'use strict';
// First-run production bootstrap: only a Super Admin, no demo centre or test sessions.
const bcrypt=require('bcryptjs');
const {db,audit}=require('../src/db');
async function main(){
  const users=db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if(users){console.log('Existing GEST database found: no sample records added.');return;}
  const email=process.env.SUPER_ADMIN_EMAIL;
  const password=process.env.SUPER_ADMIN_PASSWORD;
  if(!email||!password)throw new Error('Production Super Admin credentials are required.');
  const hashed=await bcrypt.hash(password,12);
  const uid=db.prepare('INSERT INTO users(email,password_hash,role,verified) VALUES(?,?,?,1)').run(email,hashed,'super_admin').lastInsertRowid;
  audit(uid,'first_run_admin_bootstrap','system','production');
  console.log('Initial headquarters account created. No centres or test sessions have been seeded.');
}
main().catch(error=>{console.error('GEST production bootstrap failed:',error.message);process.exitCode=1;});
