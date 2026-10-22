import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {validateConfig,workflow,ids,createServer} from './controller.mjs';
test('HTTP rejects foreign hosts and cross-origin writes',{timeout:5000},async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const send=(path,method='GET',headers={},body)=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{host:'127.0.0.1:4310',...headers}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});req.on('error',reject);req.end(body);});
 const base=`http://127.0.0.1:${server.address().port}`;
 try {
  assert.equal((await fetch(base+'/api/daemons')).status,403);
  assert.equal(await send('/workflow','POST',{origin:'https://example.com','content-type':'application/json'},'{"question":"x"}'),403);
  assert.equal(await send('/workflow','POST',{'content-type':'text/plain'},'x'),403);
  assert.equal(await send('/unknown'),404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
import {runtimeConfig} from './runtime-config.mjs';
test('runtime denies Google and tools that modify files; optional Ollama is opt in',()=>{
 const c={providerID:'openai',modelID:'gpt-6.1-sol',effort:'medium',ollama:{enabled:false}};
 const r=runtimeConfig(c);assert.deepEqual(r.enabled_providers,['openai']);assert.ok(r.disabled_providers.includes('google'));assert.ok(r.disabled_providers.includes('antigravity'));assert.ok(r.disabled_providers.includes('ollama'));
 assert.equal(r.permission['*'],'deny');assert.equal(r.permission.read['*'],'deny');assert.equal(r.permission.read['workspace/antigravity-routing.md'],'allow');
 assert.equal(r.provider.openai.models['gpt-6-astra'].variants.high.reasoningEffort,'high');
 const optional=runtimeConfig({...c,ollama:{enabled:true,modelID:'local-model'}});
 assert.deepEqual(optional.enabled_providers,['openai','ollama']);assert.equal(optional.provider.ollama.options.baseURL,'http://host.docker.internal:11434/v1');
});
test('rejects forbidden providers and malformed model/effort',()=>{
 for(const providerID of ['google','gemini','antigravity','ollama','openai']) {
  assert.throws(()=>validateConfig({providerID,modelID:'unknown',effort:'medium'}));
 }
 assert.throws(()=>validateConfig({providerID:'openai',modelID:'gpt-6-astra',effort:'arbitrary'}));
 assert.deepEqual(validateConfig({providerID:'openai',modelID:'gpt-6-astra',effort:'high'}),{providerID:'openai',modelID:'gpt-6-astra',effort:'high'});
});
test('workflow waits for triage and all six specialists before decision',{timeout:2000},async()=>{
 const completed=[];
 const result=await workflow('audit',async(id,q)=>{
  if(id!=='omo-01')assert.ok(completed.includes('omo-01'));
  if(id==='omo-08')assert.equal(completed.length,7);
  assert.ok(q.includes('audit'));
  await new Promise(r=>setTimeout(r,2));completed.push(id);return{id,text:`result ${id}`};
 });
 assert.deepEqual(new Set(completed),new Set(ids));assert.equal(result.decision.id,'omo-08');assert.equal(result.specialists.length,6);
});
test('failed specialist prevents decision',{timeout:2000},async()=>{
 let decided=false;
 await assert.rejects(()=>workflow('audit',async id=>{if(id==='omo-04')throw Error('offline');if(id==='omo-08')decided=true;return{id,text:'ok'};}),/offline/);
 assert.equal(decided,false);
});
