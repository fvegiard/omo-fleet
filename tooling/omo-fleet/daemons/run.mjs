// Bounded command runner; stops only the process tree it created.
import {spawn,execFileSync} from 'node:child_process';
const [seconds,command,...args]=process.argv.slice(2);
if(!Number.isFinite(+seconds)||+seconds<=0||!command)throw Error('Usage: node run.mjs seconds command args...');
const child=spawn(command,args,{stdio:'inherit',windowsHide:true});
const timer=setTimeout(()=>{if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:5000,stdio:'ignore'});else child.kill('SIGKILL');},+seconds*1000);
child.on('error',e=>{clearTimeout(timer);console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{clearTimeout(timer);process.exitCode=code??1;});
