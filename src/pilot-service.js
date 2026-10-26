'use strict';
const crypto=require('node:crypto');
const {db,audit}=require('./db');
const {overall,cefr}=require('./score');
const p=require('./pilot-scoring');
function positive(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw Error('Invalid ID');return n;}
function ratingInput(data,key){const v=data[key];if(typeof v!=='string'||! /^(?:10|[0-9])$/.test(v))throw Error(key+' must be an integer from 0 to 10.');return Number(v);}
function getPilotBooking(bookingId){return db.prepare(`SELECT b.id,b.status,b.checked_in_at,b.session_id,s.centre_id,s.test_date,
 ca.first_name,ca.family_name,ca.candidate_number,pf.id form_id,pf.code form_code,pf.title form_title,
 pf.reading_key,pf.listening_key,pf.fingerprint
 FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN candidates ca ON ca.user_id=b.user_id
 LEFT JOIN pilot_session_forms sf ON sf.session_id=s.id LEFT JOIN pilot_forms pf ON pf.id=sf.form_id WHERE b.id=?`).get(positive(bookingId));}
function getState(bookingId){const b=getPilotBooking(bookingId);if(!b)return null;const assessment=db.prepare('SELECT * FROM pilot_assessments WHERE booking_id=?').get(b.id);
const marks=db.prepare(`SELECT m.*,u.email FROM pilot_writing_marks m JOIN users u ON u.id=m.assessor_id WHERE m.booking_id=? ORDER BY m.id`).all(b.id);
const result=db.prepare('SELECT * FROM results WHERE booking_id=?').get(b.id);
const writing=marks.length>=2?p.resolveWriting(marks.map(m=>m.score)):null;
return {booking:b,assessment,marks,result,writing};}
function readyForEdit(state){if(!state?.booking?.form_id)throw Error('No pilot test form is assigned to this session.');if(state.booking.status!=='booked'||!state.booking.checked_in_at)throw Error('Check-in with original ID verification is required before marking.');if(state.result&&state.result.status!=='draft')throw Error('Scores are locked. Headquarters must reopen them.');if(state.assessment?.submitted_at)throw Error('Pilot assessment is locked. Headquarters must reopen the result.');}
function createForm(actor,{code,title,reading_key,listening_key}){
 if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code))throw Error('Form code must use 3–40 uppercase letters, numbers, hyphens or underscores.');
 if(typeof title!=='string'||title.trim().length<4||title.trim().length>120)throw Error('Invalid form title.');
 const reading=p.keyFromText(reading_key,40),listening=p.keyFromText(listening_key,35);
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify({reading,listening})).digest('hex');
 const id=db.prepare('INSERT INTO pilot_forms(code,title,reading_key,listening_key,fingerprint,created_by) VALUES(?,?,?,?,?,?)').run(code,title.trim(),JSON.stringify(reading),JSON.stringify(listening),fingerprint,actor).lastInsertRowid;
 audit(actor,'pilot_form_created','pilot_form',id,{code,fingerprint});return id;
}
function assignForm(actor,sessionId,formId){const sid=positive(sessionId),fid=positive(formId);
 const session=db.prepare('SELECT id FROM sessions WHERE id=?').get(sid);if(!session)throw Error('Session not found.');if(!db.prepare('SELECT id FROM pilot_forms WHERE id=?').get(fid))throw Error('Pilot test form not found.');
 if(db.prepare('SELECT session_id FROM pilot_session_forms WHERE session_id=?').get(sid))throw Error('Session already has a pilot form. Assignment cannot be changed.');
 if(db.prepare('SELECT r.id FROM results r JOIN bookings b ON b.id=r.booking_id WHERE b.session_id=? LIMIT 1').get(sid))throw Error('This session already has results. Use a clean pilot session to prevent retrospective score changes.');
 if(db.prepare('SELECT 1 FROM pilot_assessments a JOIN bookings b ON b.id=a.booking_id WHERE b.session_id=?').get(sid))throw Error('This session already has pilot assessments.');
 db.prepare('INSERT INTO pilot_session_forms(session_id,form_id,assigned_by) VALUES(?,?,?)').run(sid,fid,actor);
 audit(actor,'pilot_form_assigned','session',sid,{form_id:fid});
}
function recordRaw(actor,bookingId,data){const state=getState(bookingId);readyForEdit(state);const b=state.booking;
 const reading=p.parseResponses(data.reading_answers,40),listening=p.parseResponses(data.listening_answers,35);
 const r=p.markObjective(reading,JSON.parse(b.reading_key));const l=p.markObjective(listening,JSON.parse(b.listening_key));
 const rubric={};for(const field of p.SPEAKING_CRITERIA)rubric[field]=ratingInput(data,'speaking_'+field);const sp=p.speakingScore(rubric);
 db.prepare(`INSERT INTO pilot_assessments(booking_id,form_id,reading_responses,listening_responses,reading_correct,listening_correct,reading_score,listening_score,speaking_rubric,speaking_score,updated_by)
 VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET reading_responses=excluded.reading_responses,listening_responses=excluded.listening_responses,
 reading_correct=excluded.reading_correct,listening_correct=excluded.listening_correct,reading_score=excluded.reading_score,listening_score=excluded.listening_score,
 speaking_rubric=excluded.speaking_rubric,speaking_score=excluded.speaking_score,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`
 ).run(b.id,b.form_id,JSON.stringify(reading),JSON.stringify(listening),r.correct,l.correct,r.score,l.score,JSON.stringify(sp.rubric),sp.score,actor);
 audit(actor,'pilot_raw_marked','booking',b.id,{reading_correct:r.correct,listening_correct:l.correct,speaking_score:sp.score,form_id:b.form_id});return {reading:r,listening:l,speaking:sp};}
function recordWriting(actor,bookingId,data){const state=getState(bookingId);readyForEdit(state);if(state.marks.some(m=>m.assessor_id===actor))throw Error('You have already submitted an independent Writing mark. It cannot be changed by the marker.');
 if(state.marks.length>=3)throw Error('All Writing marks have already been submitted.');
 if(state.marks.length===2&&!p.resolveWriting(state.marks.map(m=>m.score)).needsThird)throw Error('A third Writing mark is only required when the first two differ by more than 10.');
 const task1={},task2={};for(const k of p.CRITERIA){task1[k]=ratingInput(data,'task1_'+k);task2[k]=ratingInput(data,'task2_'+k);}
 const mark=p.writingScore(task1,task2);
 db.prepare('INSERT INTO pilot_writing_marks(booking_id,assessor_id,task1_json,task2_json,task1_score,task2_score,score) VALUES(?,?,?,?,?,?,?)').run(state.booking.id,actor,JSON.stringify(mark.task1),JSON.stringify(mark.task2),mark.task1_score,mark.task2_score,mark.score);
 audit(actor,'pilot_writing_marked','booking',state.booking.id,{marker_number:state.marks.length+1,score:mark.score});return mark;
}
function submitPilot(actor,bookingId,comments){const state=getState(bookingId);readyForEdit(state);
 if(!state.assessment)throw Error('Reading, Listening and Speaking must be entered first.');
 if(!state.writing?.ready)throw Error(state.writing?.needsThird?'Writing marks differ by more than 10 points: a third independent assessor is required.':'Two different Writing assessors must submit before scores can be sent.');
 if(typeof comments!=='string'||comments.length>2000)throw Error('Comments must not exceed 2000 characters.');
 const a=state.assessment,w=state.writing.score,o=overall([a.listening_score,a.reading_score,w,a.speaking_score]);const level=cefr(o),submittedAt=new Date().toISOString();
 const snap={version:p.VERSION,form_id:state.booking.form_id,form_code:state.booking.form_code,form_fingerprint:state.booking.fingerprint,
 reading:{correct:a.reading_correct,total:40,score:a.reading_score,responses:JSON.parse(a.reading_responses)},
 listening:{correct:a.listening_correct,total:35,score:a.listening_score,responses:JSON.parse(a.listening_responses)},
 writing:{score:w,markers:state.marks.map(m=>({assessor_id:m.assessor_id,score:m.score,task1_score:m.task1_score,task2_score:m.task2_score,task1:JSON.parse(m.task1_json),task2:JSON.parse(m.task2_json)})),third_required:state.writing.needsThird},
 speaking:{score:a.speaking_score,rubric:JSON.parse(a.speaking_rubric)},overall:o,provisional_cefr:level,pilot_only:true};
 const id=db.transaction(()=>{
 const current=db.prepare('SELECT id,status FROM results WHERE booking_id=?').get(state.booking.id);
 if(current&&current.status!=='draft')throw Error('Results locked.');
 let resultId;
 if(current){resultId=current.id;db.prepare("UPDATE results SET listening=?,reading=?,writing=?,speaking=?,overall=?,cefr=?,comments=?,status='submitted',submitted_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(a.listening_score,a.reading_score,w,a.speaking_score,o,level,comments.trim(),submittedAt,resultId);}
 else resultId=db.prepare("INSERT INTO results(booking_id,listening,reading,writing,speaking,overall,cefr,comments,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,'submitted',?)").run(state.booking.id,a.listening_score,a.reading_score,w,a.speaking_score,o,level,comments.trim(),submittedAt).lastInsertRowid;
 db.prepare('INSERT INTO pilot_result_snapshots(result_id,form_id,version,snapshot_json) VALUES(?,?,?,?) ON CONFLICT(result_id) DO UPDATE SET form_id=excluded.form_id,version=excluded.version,snapshot_json=excluded.snapshot_json,created_at=CURRENT_TIMESTAMP').run(resultId,state.booking.form_id,p.VERSION,JSON.stringify(snap));
 db.prepare('UPDATE pilot_assessments SET submitted_at=? WHERE booking_id=?').run(submittedAt,state.booking.id);
 return resultId;})();
 audit(actor,'pilot_scores_submitted','result',id,{version:p.VERSION,form_id:state.booking.form_id,overall:o,cefr_provisional:level});return id;}
function reopenPilot(resultId){const row=db.prepare('SELECT r.booking_id FROM results r JOIN pilot_result_snapshots s ON s.result_id=r.id WHERE r.id=?').get(positive(resultId));if(row)db.prepare('UPDATE pilot_assessments SET submitted_at=NULL WHERE booking_id=?').run(row.booking_id);}
module.exports={getPilotBooking,getState,createForm,assignForm,recordRaw,recordWriting,submitPilot,reopenPilot};
