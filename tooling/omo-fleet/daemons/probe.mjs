import {status,ask,change,rpc,ids} from './controller.mjs';
import {writeFile} from 'node:fs/promises';
const root=new URL('./evidence/',import.meta.url);
const mode=process.argv[2]||'health';
const save=async(name,data)=>{await writeFile(new URL(name+'.json',root),JSON.stringify(data,null,2)+'\n');console.log(name+': saved');};
if(mode==='health') {
 const rows=await status();await save(process.argv[3]||'health-providers',rows);
 console.log(rows.map(r=>`${r.id} healthy=${r.health.healthy} providers=${r.providers} error=${r.error||''}`).join('\n'));
 if(rows.some(r=>!r.health.healthy || r.providers?.some(p=>p!=='openai')))process.exitCode=1;
} else if(mode==='first') {
 const tasks=[
  'Lis /workspace/antigravity-routing.md. Resume les conclusions principales et leurs limites en 100 mots.',
  'Lis /workspace/vscode-settings.json. Audite les reglages auto-approve. Cite les noms exacts des reglages presents, en 100 mots.',
  'Lis /workspace/vscode-settings.json. Audite les reglages Copilot presents; cite leurs noms exacts et les risques en 100 mots.',
  'Lis /workspace/vscode-settings.json. Examine les reglages pi-code presents; cite leurs noms exacts et les limites en 100 mots.',
  'Lis /workspace/antigravity-routing.md. Quelles preuves distinguent configuration et routage reel? 100 mots.',
  'Lis /workspace/antigravity-routing.md. Propose trois controles de non-regression a partir du contenu reel. 100 mots.',
  'Lis /workspace/vscode-settings.json. Quels reglages pertinents pour approbations et execution meritent une revue humaine? 100 mots.',
  'Lis /workspace/antigravity-routing.md. Produis une decision prudente et cite les faits verifiables du document. 100 mots.'
 ];
 await Promise.all(ids.map(async(id,i)=>{try{const result=await ask(id,tasks[i]);if(!result.tools.some(t=>t.tool==='read'&&t.status==='completed'))throw Error('No completed file read');await save('first-'+id,result);console.log(result.actual, result.text.slice(0,250));}catch(e){await save('first-'+id,{error:e.message});process.exitCode=1;}}));
} else if(mode==='change') {
 const call=async(path,method,body)=>{const r=await fetch('http://127.0.0.1:4310'+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(190000)});const value=await r.json();if(!r.ok)throw Error(value.error);return value;};
 const before=await call('/api/daemons/omo-03/config','PATCH',{providerID:'openai',modelID:'gpt-6.1-sol',effort:'medium'});
 const changed=await call('/api/daemons/omo-03/config','PATCH',{providerID:'openai',modelID:'gpt-6-astra',effort:'high'});
 const result=await call('/api/daemons/omo-03/message','POST',{question:'Lis /workspace/antigravity-routing.md et donne une conclusion utile en 50 mots.'});
 if(result.actual.modelID!=='gpt-6-astra'||result.actual.variant!=='high'||!result.tools.some(t=>t.tool==='read'&&t.status==='completed'))throw Error('Model/effort/file-read verification failed');
 await save('model-effort-change',{transport:'controller HTTP PATCH config, POST message',before,changed,config:await rpc('omo-03','/config'),result});console.log(result.actual,result.text.slice(0,250));
} else if(mode==='workflow') {
 const r=await fetch('http://127.0.0.1:4310/workflow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Quelle politique de verification appliquer a cette flotte Docker en lecture seule, avec OpenAI seulement et aucun fournisseur Google?' }),signal:AbortSignal.timeout(550000)});
 const result=await r.json();await save('workflow',result);console.log(r.status,result.decision?.text||result.error);if(!r.ok)process.exitCode=1;
}
