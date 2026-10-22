import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {ids,rpc} from './controller.mjs';
const root=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL('evidence/'+name+'.json',root),'utf8'));
const first=await Promise.all(ids.map(id=>read('first-'+id)));
first.forEach((r,i)=>{assert.equal(r.id,ids[i]);assert.ok(r.text);assert.equal(r.actual.providerID,'openai');assert.ok(r.tools.some(t=>t.tool==='read'&&t.status==='completed'));});
for(const name of ['after-restart','after-down-up']) {
 const p=await read(name);assert.equal(p.rows.length,8);assert.ok(p.rows.every(r=>r.health.healthy&&r.providers.join(',')==='openai'));
 assert.ok(p.sessions.every(s=>s.expectedSessionID===s.persistedSessionID));assert.equal(p.result.actual.modelID,'gpt-6-astra');assert.equal(p.result.actual.variant,'high');
}
const workflow=await read('workflow');assert.equal(workflow.triage.id,'omo-01');assert.equal(workflow.specialists.length,6);assert.equal(workflow.decision.id,'omo-08');
const c=await read('recreate-actions');assert.deepEqual(c.externalBefore,c.externalAfter);
const boundaries=await read('container-boundaries');assert.equal(boundaries.length,8);boundaries.forEach(c=>{
 assert.equal(c.restart.Name,'unless-stopped');assert.ok(c.mounts.filter(m=>m.type==='bind').every(m=>m.rw===false));assert.ok(Object.values(c.ports).flat().every(p=>p.HostIp==='127.0.0.1'));
});
const configs=await Promise.all(ids.map(async id=>({id,config:await rpc(id,'/config')})));
configs.forEach(({config:c})=>{assert.deepEqual(c.enabled_providers,['openai']);assert.ok(c.disabled_providers.includes('antigravity'));assert.equal(c.permission.read['*'],'deny');assert.equal(c.permission.read['workspace/antigravity-routing.md'],'allow');});
await writeFile(new URL('evidence/effective-configs.json',root),JSON.stringify(configs,null,2)+'\n');
// Compare exact known secrets in memory, never print their values.
const auth=JSON.parse(await readFile('C:/Users/fvegi/.codex/auth.json','utf8'));
const env=await readFile(new URL('.env',root),'utf8');
const secrets=[env.split('=')[1]?.trim(),...Object.values(auth.tokens||{})].filter(s=>typeof s==='string'&&s.length>30);
const staged=execFileSync('git',['diff','--cached','--binary'],{encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024,windowsHide:true});
assert.ok(secrets.every(secret=>!staged.includes(secret)),'Known credential present in staged diff');
console.log('PASS: 8 real file reads; model/effort; workflow; restarts; unchanged external containers; RO mounts; loopback; restricted providers/reads; no known secret in staged diff.');
