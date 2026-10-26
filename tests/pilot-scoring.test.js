'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const p=require('../src/pilot-scoring');
test('objective scoring: Reading 30/40 = 75; Listening 28/35 = 80',()=>{
 const readingKey=Array.from({length:40},()=> 'A'),listeningKey=Array.from({length:35},()=> 'B');
 const readingAnswers=[...Array(30).fill('A'),...Array(10).fill('C')];
 const listeningAnswers=[...Array(28).fill('B'),...Array(7).fill('A')];
 assert.deepEqual(p.markObjective(readingAnswers,readingKey),{correct:30,total:40,score:75});
 assert.deepEqual(p.markObjective(listeningAnswers,listeningKey),{correct:28,total:35,score:80});
});
test('answers normalize case and blanks and require exact count',()=>{
 const text='a,b,c,-, D';assert.deepEqual(p.parseResponses(text,5),['A','B','C','','D']);
 assert.throws(()=>p.parseResponses('a,b,c',40),/40/);
 assert.throws(()=>p.keyFromText(Array(40).fill('-').join(','),40),/blank/i);
 assert.throws(()=>p.parseResponses(Array(40).fill('<script>').join(','),40),/Invalid answer/);
});
test('objective scoring gives no credit for omitted responses',()=>{
 assert.equal(p.markObjective(Array(40).fill(''),Array(40).fill('A')).correct,0);
});
test('speaking four rubric fields 0–10 produce 0–100 scale',()=>{
 assert.deepEqual(p.speakingScore({fluency:8,vocabulary:8,grammar:7,pronunciation:9}).score,80);
 assert.equal(p.speakingScore({fluency:0,vocabulary:0,grammar:0,pronunciation:0}).score,0);
 assert.equal(p.speakingScore({fluency:10,vocabulary:10,grammar:10,pronunciation:10}).score,100);
 assert.throws(()=>p.speakingScore({fluency:11,vocabulary:8,grammar:7,pronunciation:9}),/integer/);
});
test('Writing Task 1 is 40 percent, Task 2 is 60 percent',()=>{
 const t1={task:8,coherence:8,vocabulary:7,grammar:7};
 const t2={task:8,coherence:8,vocabulary:8,grammar:8};
 const s=p.writingScore(t1,t2);
 assert.equal(s.task1_score,75);assert.equal(s.task2_score,80);assert.equal(s.score,78);
 assert.throws(()=>p.writingScore({...t1,grammar:2.5},t2),/integer/);
});
test('two independent Writing marks average with rounded half up',()=>{
 assert.deepEqual(p.resolveWriting([76,79]),{ready:true,needsThird:false,gap:3,score:78});
 assert.equal(p.resolveWriting([70,80]).ready,true);
});
test('Writing difference above 10 requires independent third mark; median wins',()=>{
 assert.deepEqual(p.resolveWriting([60,80]),{ready:false,needsThird:true,gap:20});
 assert.deepEqual(p.resolveWriting([60,80,74]),{ready:true,needsThird:true,gap:20,score:74});
 assert.throws(()=>p.resolveWriting([60,65,80]),/third.*only/i);
 assert.throws(()=>p.resolveWriting([75]),/two independent/i);
});
test('overall score is rounded arithmetic mean of 4 scored skills',()=>{
 assert.equal(p.combined(75,80,78,80),78);assert.equal(p.combined(100,100,100,100),100);
 assert.throws(()=>p.combined(75,80,undefined,80));
 assert.equal(p.VERSION,'GEST-PILOT-1.0');
});
