import {spawn,execFile} from 'node:child_process';
import {readFile,writeFile,open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
const root=new URL('./',import.meta.url);
const execute=promisify(execFile);
for(let attempt=0;attempt<6;attempt++) {
  try {await execute('docker',['compose','-f',fileURLToPath(new URL('docker-compose.yml',root)),'up','-d','--no-build'],{timeout:25000,windowsHide:true});break;}
  catch(e){if(attempt===5)throw e;await new Promise(r=>setTimeout(r,3000));}
}
let running=false;
try{const r=await fetch('http://127.0.0.1:4310/api/daemons',{signal:AbortSignal.timeout(3000)});const s=await r.json();running=r.ok&&s.length===8&&s.every(x=>/^omo-0[1-8]$/.test(x.id));}catch{}
const processes=[];
if(!running){const log=await open(new URL('runtime/controller.log',root),'a');const c=spawn(process.execPath,[fileURLToPath(new URL('controller.mjs',root))],{detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});processes.push({role:'controller',pid:c.pid});c.unref();await log.close();}
for(let i=0;i<20;i++){try{const r=await fetch('http://127.0.0.1:4310/api/daemons',{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,500));if(i===19)throw Error('Controller startup timeout');}
if(process.argv.includes('--controller-only')) {
 await writeFile(new URL('runtime/controller-launch.json',root),JSON.stringify({at:new Date().toISOString(),processes},null,2));
 process.exit(0);
}
const env={...process.env,OMO_FLEET_URL:'http://127.0.0.1:4310',OMO_FLEET_DAEMONS:'1'};delete env.ELECTRON_RUN_AS_NODE;
const electron=fileURLToPath(new URL('../electron/node_modules/electron/dist/electron.exe',root));
const desktopLog=await open(new URL('runtime/electron.log',root),'a');
const desktop=spawn(electron,[fileURLToPath(new URL('../electron/main.mjs',root))],{env,detached:true,windowsHide:true,stdio:['ignore',desktopLog.fd,desktopLog.fd]});
processes.push({role:'electron',pid:desktop.pid});desktop.unref();
await desktopLog.close();
await writeFile(new URL('runtime/launch.json',root),JSON.stringify({at:new Date().toISOString(),processes},null,2));
