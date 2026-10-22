import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const input=new URL('runtime/dashboard.b64',import.meta.url);
writeFileSync(new URL('evidence/electron-dashboard.png',import.meta.url),Buffer.from(readFileSync(input,'utf8'),'base64'));
unlinkSync(input);
console.log('Saved actual Windows-MCP dashboard capture');
