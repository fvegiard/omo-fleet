import http from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runtimeConfig } from './runtime-config.mjs';
const execute = promisify(execFile);
export const ids = Array.from({length:8}, (_, i) => `omo-${String(i+1).padStart(2,'0')}`);
const root = new URL('./', import.meta.url);
const history = new Map();
const busy = new Set();
let password;
export function validateConfig(c) {
  if (!c || c.providerID !== 'openai' || !['gpt-6.1-sol','gpt-6-astra'].includes(c.modelID) ||
    !['low','medium','high'].includes(c.effort)) throw new Error('Invalid model/provider/effort');
  return { providerID:c.providerID, modelID:c.modelID, effort:c.effort };
}
export async function rpc(id, path, body, timeout = 15000, method) {
  if (!ids.includes(id)) throw new Error('Unknown daemon');
  password ??= (await readFile(new URL('.env',root),'utf8')).match(/^OPENCODE_SERVER_PASSWORD=(.+)$/m)?.[1].trim();
  if (!password) throw new Error('Run setup.mjs');
  const response = await fetch(`http://127.0.0.1:${4401+ids.indexOf(id)}${path}`, {
    method:method ?? (body ? 'POST':'GET'), signal:AbortSignal.timeout(timeout),
    headers:{ Authorization:`Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`, 'content-type':'application/json' },
    ...(body ? {body:JSON.stringify(body)} : {})
  });
  if (!response.ok) throw new Error(`Daemon HTTP ${response.status}`);
  return response.json();
}
export async function config(id) { return JSON.parse(await readFile(new URL(`config/${id}.json`,root),'utf8')); }
export async function change(id, input) {
  if (!ids.includes(id)) throw new Error('Unknown daemon');
  if (busy.has(id)) throw new Error('Daemon busy');
  busy.add(id);
  try {
    const next = {...await config(id), ...validateConfig(input)};
    await rpc(id,'/global/config',runtimeConfig(next),15000,'PATCH');
    await rpc(id,'/instance/dispose',{});
    const check = await rpc(id,'/config');
    if (check.model !== `${next.providerID}/${next.modelID}`) throw new Error('Model readback mismatch');
    const file = new URL(`config/${id}.json`,root);
    await writeFile(new URL(`config/${id}.json.tmp`,root), JSON.stringify(next,null,2)+'\n');
    await rename(new URL(`config/${id}.json.tmp`,root),file);
    return next;
  } finally {busy.delete(id);}
}
export async function setOllama(id,input) {
  if(!ids.includes(id) || typeof input?.enabled!=='boolean' ||
    (input.enabled && !/^[a-zA-Z0-9._:/-]{1,120}$/.test(input.modelID||''))) throw Error('Invalid Ollama configuration');
  if(busy.has(id))throw Error('Daemon busy');
  busy.add(id);
  try {
    const next={...await config(id),ollama:{enabled:input.enabled,modelID:input.enabled?input.modelID:'',baseURL:'http://host.docker.internal:11434/v1'}};
    await rpc(id,'/global/config',runtimeConfig(next),15000,'PATCH');
    await rpc(id,'/instance/dispose',{});
    const p=await rpc(id,'/provider');
    if(p.all.some(x=>!['openai','ollama'].includes(x.id)) || p.all.some(x=>x.id==='ollama')!==input.enabled)throw Error('Provider readback mismatch');
    const file=new URL(`config/${id}.json`,root);
    await writeFile(new URL(`config/${id}.json.tmp`,root),JSON.stringify(next,null,2)+'\n');
    await rename(new URL(`config/${id}.json.tmp`,root),file);
    return next;
  } finally {busy.delete(id);}
}
export async function ask(id, question, providerID='openai') {
  if (typeof question !== 'string' || !question.trim() || question.length>24000) throw new Error('Question required (max 24000)');
  if (busy.has(id)) throw new Error('Daemon busy');
  busy.add(id);
  try {
    const c = await config(id);
    if(providerID!=='openai' && !(providerID==='ollama' && c.ollama?.enabled)) throw Error('Provider disabled');
    const modelID=providerID==='ollama'?c.ollama.modelID:c.modelID;
    const session = await rpc(id,'/session',{title:`Fleet ${id} read-only`});
    const answer = await rpc(id,`/session/${session.id}/message`, {
      model:{providerID, modelID}, ...(providerID==='openai'?{variant:c.effort}:{}),
      parts:[{type:'text',text:question}],
      system:'Travaille en lecture seule. Ne modifie aucun fichier. Reponds en francais, brievement. Ne cite jamais de secret.'
    },180000).catch(async error=>{await rpc(id,`/session/${session.id}/abort`,{},10000).catch(()=>{});throw error;});
    if (answer.info?.error) throw new Error(`Inference failed: ${JSON.stringify(answer.info.error)}`);
    const text = answer.parts?.filter(x=>x.type==='text').map(x=>x.text).join('\n');
    if (!text) throw new Error('No assistant text returned');
    const transcript=await rpc(id,`/session/${session.id}/message`);
    const result = {id,at:new Date().toISOString(),sessionID:session.id,requested:c,
      actual:{providerID:answer.info?.providerID,modelID:answer.info?.modelID,variant:answer.info?.variant},
      text,tools:transcript.flatMap(m=>m.parts||[]).filter(p=>p.type==='tool').map(p=>({tool:p.tool,status:p.state?.status,input:p.state?.input}))};
    history.set(id,result);
    return result;
  } finally {busy.delete(id);}
}
export async function workflow(question, send=ask) {
  const triage = await send('omo-01',`Triage cette question et propose des angles d'analyse en 100 mots: ${question}`);
  const specialists = await Promise.all(ids.slice(1,7).map((id,i)=>send(id,
    `Question: ${question}\nTriage: ${triage.text}\nSpecialite: ${['securite','fiabilite','configuration','tests','exploitation','risques et limites'][i]}. Analyse en 80 mots.`)));
  const decision = await send('omo-08',`Question: ${question}\nAnalyses: ${JSON.stringify(specialists.map(x=>({id:x.id,text:x.text})))}\nDonne la decision et les verifications utiles en 150 mots.`);
  return {at:new Date().toISOString(),triage,specialists,decision};
}
export async function status() {
  return Promise.all(ids.map(async id=>{
    const c=await config(id);
    try { const [health,p]=await Promise.all([rpc(id,'/global/health'),rpc(id,'/provider')]);
      return {id,config:c,health,providers:p.all?.map(x=>x.id),connected:p.connected,busy:busy.has(id),last:history.get(id)};
    } catch(e) {return {id,config:c,health:{healthy:false},error:e.message};}
  }));
}
async function body(req) {
  let s=''; for await (const chunk of req) {s+=chunk; if(s.length>30000) throw new Error('Body too large');}
  return JSON.parse(s);
}
export function createServer() {
  return http.createServer(async(req,res)=>{
    const reply=(code,data)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(data));};
    try {
      if(req.headers.host!=='127.0.0.1:4310') return reply(403,{error:'Invalid host'});
      if(req.method!=='GET' && ((req.headers.origin && req.headers.origin!=='http://127.0.0.1:4310') || !req.headers['content-type']?.startsWith('application/json'))) return reply(403,{error:'Invalid origin/content-type'});
      const path=new URL(req.url,'http://127.0.0.1:4310').pathname;
      const assets={'/':['../dashboard/public/daemons.html','text/html'], '/daemons.js':['../dashboard/public/daemons.js','text/javascript'], '/tokens.css':['../dashboard/public/tokens.css','text/css'], '/styles.css':['../dashboard/public/styles.css','text/css']};
      if(req.method==='GET' && assets[path]) {const [file,type]=assets[path];res.writeHead(200,{'content-type':type,'content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",'cache-control':'no-store'});return res.end(await readFile(new URL(file,root)));}
      if(req.method==='GET' && path==='/api/daemons') return reply(200,await status());
      if(req.method==='POST' && path==='/workflow') return reply(200,await workflow((await body(req)).question));
      const m=/^\/api\/daemons\/(omo-0[1-8])\/(config|message|logs|ollama)$/.exec(path);
      if(m) {
        if(req.method==='PATCH' && m[2]==='config') return reply(200,await change(m[1],await body(req)));
        if(req.method==='PATCH' && m[2]==='ollama') return reply(200,await setOllama(m[1],await body(req)));
        if(req.method==='POST' && m[2]==='message') {const input=await body(req);return reply(200,await ask(m[1],input.question,input.providerID));}
        if(req.method==='GET' && m[2]==='logs') {
          const {stdout,stderr}=await execute('docker',['compose','-f',fileURLToPath(new URL('docker-compose.yml',root)),'logs','--no-color','--tail','30',m[1]],{timeout:10000,windowsHide:true,maxBuffer:131072});
          return reply(200,{logs:(stdout+stderr).replace(/(Bearer|sk-|access_token|refresh_token)\S*/gi,'[REDACTED]')});
        }
      }
      reply(404,{error:'Not found'});
    }catch(e){reply(502,{error:e.message});}
  });
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const server=createServer(); server.requestTimeout=240000;
  server.listen(4310,'127.0.0.1',()=>console.log('Fleet controller http://127.0.0.1:4310'));
  for(const s of ['SIGTERM','SIGINT']) process.on(s,()=>server.close());
}
