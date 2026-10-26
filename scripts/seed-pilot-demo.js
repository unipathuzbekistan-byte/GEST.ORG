'use strict';
// Intentional, non-real answer keys for local demonstration only. Never use to administer a real exam.
const path=require('node:path');require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet:true});
if(process.env.NODE_ENV==='production'){console.error('Demo test form cannot be seeded in production.');process.exit(1);}
const {db}=require('../src/db'),{createForm}=require('../src/pilot-service');
const admin=db.prepare("SELECT id FROM users WHERE role='super_admin' AND disabled=0 LIMIT 1").get();
if(!admin){console.error('Run npm run seed first to create a super admin.');process.exit(1);}
const code='DEMO-PILOT-001';
if(db.prepare('SELECT id FROM pilot_forms WHERE code=?').get(code)){console.log(code+' already exists; nothing changed.');process.exit(0);}
const key=n=>Array.from({length:n},(_,i)=>['A','B','C','D'][i%4]).join(', ');
const id=createForm(admin.id,{code,title:'DEMO ONLY — GEST Pilot test (not real questions)',reading_key:key(40),listening_key:key(35)});
console.log('Created sample form #'+id+' '+code+'. Keys: A,B,C,D repeating. DO NOT use this form to examine real candidates.');
console.log('Assign it to an empty DEMO session from /admin/pilot/forms.');
