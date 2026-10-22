import {ids,config,change} from './controller.mjs';
for(const id of ids){await change(id,await config(id));console.log(id+' runtime configuration verified');}
