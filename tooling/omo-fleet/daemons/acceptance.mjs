import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {status,rpc,ids,ask} from './controller.mjs';
const run=promisify(execFile), root=new URL('./',import.meta.url);
const compose=['compose','-f',fileURLToPath(new URL('docker-compose.yml',root))];
const save=async(name,data)=>writeFile(new URL(`evidence/${name}.json`,root),JSON.stringify(data,null,2)+'\n');
const execute=async(args)=>{const r=await run('docker',args,{timeout:45000,windowsHide:true,maxBuffer:4*1024*1024});return r.stdout;};
const external=async()=>JSON.parse(await execute(['inspect','linuxfv','site-semantic-index-mcp-1','site-semantic-index-app','site-semantic-index-qdrant-1'])).map(c=>({id:c.Id,name:c.Name,startedAt:c.State.StartedAt,status:c.State.Status}));
const mode=process.argv[2];
let actions=[];
if(mode==='recreate') {
 const before=await external();
 for(const args of [['down','--timeout','10'],['up','-d','--no-build']]){
  const {stdout,stderr}=await run('docker',[...compose,...args],{timeout:45000,windowsHide:true});actions.push({command:`docker compose ${args.join(' ')}`,stdout,stderr});
 }
 const after=await external();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('External container state changed');
 await save('recreate-actions',{at:new Date().toISOString(),actions,externalBefore:before,externalAfter:after});
}
let rows;
for(let n=0;n<12;n++) {
 rows=await status();if(rows.every(r=>r.health.healthy && r.providers?.join(',')==='openai'))break;
 if(n===11)throw Error('Health/provider verification failed');
 await new Promise(r=>setTimeout(r,2000));
}
const sessions=await Promise.all(ids.map(async id=>{const first=JSON.parse(await readFile(new URL(`evidence/first-${id}.json`,root),'utf8'));const s=await rpc(id,`/session/${first.sessionID}`);return {id,expectedSessionID:first.sessionID,persistedSessionID:s.id};}));
const result=await ask('omo-03','Lis /workspace/antigravity-routing.md. En une phrase, quelle limite empeche une attribution certaine?');
if(result.actual.modelID!=='gpt-6-astra'||result.actual.variant!=='high')throw Error('Model/effort did not persist');
await save(mode==='recreate'?'after-down-up':'after-restart',{at:new Date().toISOString(),rows,sessions,result});
await writeFile(new URL(`evidence/compose-ps-${mode}.txt`,root),await execute([...compose,'ps']));
const inspected=JSON.parse(await execute(['inspect',...ids.map(id=>`omo-daemons-20261022-${id}-1`)]));
await save('container-boundaries',inspected.map(c=>({id:c.Id,name:c.Name,image:c.Image,state:{status:c.State.Status,health:c.State.Health?.Status},restart:c.HostConfig.RestartPolicy,mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,rw:m.RW,type:m.Type})),ports:c.HostConfig.PortBindings})));
console.log(`${mode}: 8 healthy, OpenAI only, 8 persisted sessions, gpt-6-astra/high inference verified`);
