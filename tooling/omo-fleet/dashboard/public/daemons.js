const $=s=>document.querySelector(s);
async function api(path,method='GET',body){const r=await fetch(path,{method,headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
const cards=new Map();
async function refresh(){try{const rows=await api('/api/daemons');$('#summary').textContent=`${rows.filter(r=>r.health.healthy).length}/8 en santé · mis à jour ${new Date().toLocaleTimeString('fr-CA')}`;
for(const r of rows){let card=cards.get(r.id);if(!card){card=document.createElement('article');card.innerHTML='<h2></h2><p class="health"></p><p class="meta providers"></p><label>Modèle <select class="model"><option>gpt-6.1-sol</option><option>gpt-6-astra</option></select></label><label>Effort <select class="effort"><option>low</option><option>medium</option><option>high</option></select></label><button class="save">Appliquer</button><button class="logs">Journaux</button><textarea class="prompt" aria-label="Tâche du démon" placeholder="Tâche en lecture seule"></textarea><button class="send">Envoyer</button><pre class="result"></pre><pre class="log-output"></pre>';
card.querySelector('h2').textContent=r.id;$('#daemons').append(card);cards.set(r.id,card);
card.querySelector('.model').value=r.config.modelID;card.querySelector('.effort').value=r.config.effort;
const action=async fn=>{try{$('#notice').textContent='En cours…';await fn();$('#notice').textContent='Résultat reçu et vérifié.';await refresh();}catch(e){$('#notice').textContent=e.message;}};
card.querySelector('.save').onclick=()=>action(()=>api(`/api/daemons/${r.id}/config`,'PATCH',{providerID:'openai',modelID:card.querySelector('.model').value,effort:card.querySelector('.effort').value}));
card.querySelector('.logs').onclick=()=>action(async()=>card.querySelector('.log-output').textContent=(await api(`/api/daemons/${r.id}/logs`)).logs);
card.querySelector('.send').onclick=()=>action(async()=>card.querySelector('.result').textContent=JSON.stringify(await api(`/api/daemons/${r.id}/message`,'POST',{question:card.querySelector('.prompt').value}),null,2));}
card.querySelector('.health').textContent=`${r.health.healthy?'● En santé':'● Indisponible'} · ${r.busy?'occupé':'disponible'} · ${r.config.modelID} / ${r.config.effort}`;
card.querySelector('.health').className='health '+(r.health.healthy?'good':'bad');card.querySelector('.providers').textContent=`Fournisseurs: ${(r.providers||[]).join(', ')} · ${r.health.version||r.error||''}`;
if(r.last)card.querySelector('.result').textContent=JSON.stringify(r.last,null,2);
}}catch(e){$('#summary').textContent=e.message;}}
$('#workflow').onclick=async()=>{const b=$('#workflow');b.disabled=true;$('#workflow-result').textContent='Triage, puis six spécialistes, puis décision…';try{$('#workflow-result').textContent=JSON.stringify(await api('/workflow','POST',{question:$('#question').value}),null,2);}catch(e){$('#workflow-result').textContent=e.message;}finally{b.disabled=false;}};
refresh();setInterval(refresh,10000);
