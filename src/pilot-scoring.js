'use strict';
// Version 1 is a provisional, UNVALIDATED pilot scoring model — not a certified CEFR conversion.
const VERSION='GEST-PILOT-1.0';
const CRITERIA=['task','coherence','vocabulary','grammar'];
const SPEAKING_CRITERIA=['fluency','vocabulary','grammar','pronunciation'];
function integer(n,min,max,label){if(!Number.isInteger(n)||n<min||n>max)throw Error(`${label} must be an integer ${min}–${max}`);return n;}
function parseResponses(text,count){
 if(typeof text!=='string'||text.length>count*70)throw Error(`Enter exactly ${count} responses.`);
 const parts=text.replace(/\r/g,'').split(/[,\n]/);
 if(parts.length!==count)throw Error(`Expected ${count} answers (comma-separated or one per line); received ${parts.length}. Use - for skipped answers.`);
 return parts.map((part,i)=>{
  const value=part.trim().normalize('NFKC').toUpperCase().replace(/\s+/g,' ');
  if(value==='-'||value==='')return '';
  if(value.length>64||!/[\p{L}\p{N}]/u.test(value)||/[<>\x00-\x1F]/.test(value))throw Error(`Invalid answer at question ${i+1}.`);
  return value;
 });
}
function keyFromText(text,count){const responses=parseResponses(text,count);if(responses.some(x=>!x))throw Error('Answer key cannot contain blanks.');return responses;}
function markObjective(answers,key){if(!Array.isArray(answers)||!Array.isArray(key)||answers.length!==key.length||!([40,35].includes(key.length)))throw Error('Invalid test form or answer count.');let correct=0;for(let i=0;i<answers.length;i++){if(answers[i]!==''&&answers[i]===key[i])correct++;}return {correct,total:key.length,score:Math.round(correct/key.length*100)};}
function rubric(values,fields){if(!values||Array.isArray(values)||typeof values!=='object')throw Error('Rubric is required.');const ratings={};for(const key of fields)ratings[key]=integer(values[key],0,10,key);return ratings;}
function speakingScore(values){const r=rubric(values,SPEAKING_CRITERIA);return {rubric:r,score:Math.round(Object.values(r).reduce((a,b)=>a+b,0)*2.5)};}
function writingScore(task1,task2){const t1=rubric(task1,CRITERIA),t2=rubric(task2,CRITERIA);const total1=Object.values(t1).reduce((a,b)=>a+b,0),total2=Object.values(t2).reduce((a,b)=>a+b,0);return {task1:t1,task2:t2,task1_score:Math.round(total1*2.5),task2_score:Math.round(total2*2.5),score:Math.round(total1+1.5*total2)};}
function resolveWriting(scores){if(!Array.isArray(scores)||scores.length<2||scores.length>3)throw Error('Two independent Writing marks are required.');scores.forEach((s,i)=>integer(s,0,100,`Writing marker ${i+1}`));const conflict=Math.abs(scores[0]-scores[1])>10;if(conflict&&scores.length!==3)return {ready:false,needsThird:true,gap:Math.abs(scores[0]-scores[1])};if(!conflict&&scores.length!==2)throw Error('A third Writing marker is allowed only when the first two differ by more than 10 points.');return {ready:true,needsThird:conflict,gap:Math.abs(scores[0]-scores[1]),score:conflict?[...scores].sort((a,b)=>a-b)[1]:Math.round((scores[0]+scores[1])/2)};}
function combined(reading,listening,writing,speaking){return integer(Math.round((integer(reading,0,100,'Reading')+integer(listening,0,100,'Listening')+integer(writing,0,100,'Writing')+integer(speaking,0,100,'Speaking'))/4),0,100,'Overall');}
module.exports={VERSION,CRITERIA,SPEAKING_CRITERIA,parseResponses,keyFromText,markObjective,rubric,speakingScore,writingScore,resolveWriting,combined};
