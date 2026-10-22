const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const base = 'http://127.0.0.1:4310';
const service = 'D:/Github/.wt/omo-fleet-20261022-ovplwz/tooling/omo-fleet/daemons/controller.mjs';
const ids = Array.from({length:8},(_,i)=>`omo-0${i+1}`);
const timer = setTimeout(()=>{console.error('Hard deadline reached; check daemon status before retrying');process.exit(124);},560000);
async function save(file,value) { await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file,JSON.stringify(value,null,2)+'\n'); }
async function api(route,body,method='GET',ms=15000) {
  const r=await fetch(base+route,{method,signal:AbortSignal.timeout(ms),headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const value=await r.json(); if(!r.ok) throw Error(value.error||`HTTP ${r.status}`); return value;
}
async function ready(id) {
  const rows=await api('/api/daemons');
  const targets=id?rows.filter(r=>r.id===id):rows;
  if(targets.length!==(id?1:8)||targets.some(r=>!r.health?.healthy||r.busy)) throw Error('Required daemon(s) unavailable or busy; nothing submitted');
}
async function verify(result,dir) {
  const rows=[result.triage,...(result.specialists||[]),result.decision];
  if(rows.length!==8||rows.some((r,i)=>r?.id!==ids[i]||!r.sessionID||!r.text)) throw Error('Incomplete workflow');
  const {rpc}=await import(pathToFileURL(service).href);
  const transcripts=await Promise.all(rows.map(async row=>({id:row.id,sessionID:row.sessionID,messages:await rpc(row.id,`/session/${row.sessionID}/message`)})));
  const text=messages=>messages.flatMap(m=>m.parts||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n');
  const times=transcripts.map(t=>t.messages.filter(m=>m.info.role==='assistant').map(m=>m.info.time));
  const checks=rows.map((row,i)=>{
    const t=transcripts[i];const user=text(t.messages.filter(m=>m.info.role==='user'));
    const assistants=t.messages.filter(m=>m.info.role==='assistant');
    const actualText=text(assistants);
    return {id:row.id,sessionID:row.sessionID,actual:row.actual,
      responseMatchesTranscript:actualText===row.text,
      completed:assistants.length>0&&assistants.every(m=>m.info.time?.completed&&!m.info.error),
      triageReceivedExactly:i>0&&i<7?user.includes(result.triage.text):null,
      analysesReceivedExactly:i===7?result.specialists.map(s=>({id:s.id,received:user.includes(JSON.stringify(s.text).slice(1,-1))})):null,
      completedFileRead:row.tools?.some(p=>p.tool==='read'&&p.status==='completed')||false,
      tokens:assistants.map(m=>m.info.tokens),times:times[i]};
  });
  const start=i=>Math.min(...times[i].map(t=>t.created));
  const end=i=>Math.max(...times[i].map(t=>t.completed));
  const chronology=[1,2,3,4,5,6].every(i=>start(i)>=end(0))&&start(7)>=Math.max(...[1,2,3,4,5,6].map(end));
  const pass=new Set(rows.map(r=>r.sessionID)).size===8&&chronology&&checks.every(c=>c.completed&&c.responseMatchesTranscript&&c.triageReceivedExactly!==false&&(!c.analysesReceivedExactly||c.analysesReceivedExactly.every(a=>a.received)));
  const verification={at:new Date().toISOString(),verdict:pass?'PASS':'FAIL',chronology,elapsedSeconds:(end(7)-start(0))/1000,checks};
  await save(path.join(dir,'workflow-transcripts.json'),transcripts);
  await save(path.join(dir,'workflow-verification.json'),verification);
  if(!pass) process.exitCode=1;
  return verification;
}
async function main() {
  const [mode,a,b,c]=process.argv.slice(2);
  if(mode==='status') {if(!a)throw Error('Output file required');const rows=await api('/api/daemons');await save(a,rows);console.log(JSON.stringify(rows.map(r=>({id:r.id,healthy:r.health?.healthy,busy:r.busy,model:r.config?.modelID,effort:r.config?.effort}))));return;}
  if(mode==='workflow') {
    if(!a||!b)throw Error('Question file and evidence directory required');
    const question=await fs.readFile(a,'utf8');if(!question.trim()||question.length>18000)throw Error('Question required, maximum 18000 characters to leave room for relay');
    await ready();await save(path.join(b,'workflow-request.json'),{question,started:new Date().toISOString()});
    const result=await api('/workflow',{question},'POST',550000);await save(path.join(b,'workflow-result.json'),result);
    const v=await verify(result,b);console.log(JSON.stringify({verdict:v.verdict,elapsedSeconds:v.elapsedSeconds,decision:result.decision.text}));return;
  }
  if(mode==='verify') {if(!a||!b)throw Error('Result file and evidence directory required');console.log(JSON.stringify(await verify(JSON.parse(await fs.readFile(a,'utf8')),b)));return;}
  if(!ids.includes(a)||!['ask','config','logs'].includes(mode))throw Error('Use status, workflow, verify, ask, config or logs; daemon omo-01..omo-08');
  if(mode==='logs') {if(!b)throw Error('Output file required');await save(b,await api(`/api/daemons/${a}/logs`));console.log('Logs saved');return;}
  if(!b||!c)throw Error('Input file and output file required');
  await ready(a);
  if(mode==='ask') {const question=await fs.readFile(b,'utf8');if(!question.trim()||question.length>24000)throw Error('Invalid question');const answer=await api(`/api/daemons/${a}/message`,{question},'POST',200000);await save(c,answer);console.log(answer.text);return;}
  const config=JSON.parse(await fs.readFile(b,'utf8'));
  if(config.providerID!=='openai'||!['gpt-6.1-sol','gpt-6-astra'].includes(config.modelID)||!['low','medium','high'].includes(config.effort)||Object.keys(config).some(k=>!['providerID','modelID','effort'].includes(k)))throw Error('Invalid model/effort configuration');
  const changed=await api(`/api/daemons/${a}/config`,config,'PATCH');
  const after=(await api('/api/daemons')).find(r=>r.id===a);
  await save(c,{changed,after});if(after.config.modelID!==config.modelID||after.config.effort!==config.effort)throw Error('Configuration readback mismatch');console.log(JSON.stringify(changed));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>clearTimeout(timer));
