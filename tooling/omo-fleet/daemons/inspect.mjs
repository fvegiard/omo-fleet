import {rpc} from './controller.mjs';
for(const p of ['/path','/config','/provider']) {
 const r=await rpc('omo-03',p);
 if(p==='/provider')console.log({providers:r.all.map(x=>({id:x.id,models:Object.keys(x.models).filter(x=>x.includes('6'))})),connected:r.connected});
 else console.log(p==='/config'?{model:r.model,permission:r.permission}:r);
}
