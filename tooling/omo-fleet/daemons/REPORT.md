# Rapport — flotte Docker OmO, 22 octobre 2026

Worktree : `D:\Github\.wt\omo-fleet-20261022-ovplwz`. Branche : `feat/omo-docker-daemons-20261022`. Aucun push.

## Résultat démontré

Huit serveurs **OpenCode 1.19.4** sont actifs sous les noms de service `omo-01` à `omo-08`, avec `restart: unless-stopped`, healthchecks authentifiés, huit volumes privés et publication uniquement sur `127.0.0.1:4401…4408`. Le repli OpenCode autorisé a été choisi après inspection d’OmO 5.1.41/senpi : RPC Unix/stdio disponible, aucune API HTTP adaptée documentée. L’installateur Linux officiel OmO a été inspecté sans être exécuté. Voir [README.md](README.md) pour les sources et le choix détaillé.

| Vérification | Preuve |
|---|---|
| Huit serveurs et santé | `evidence/compose-ps.txt`, `health-providers.json` |
| Fournisseurs par démon : uniquement `openai` | `health-providers.json`, `after-down-up.json` |
| Huit réponses réelles et lecture de fichiers achevée | `first-omo-01.json` à `first-omo-08.json`, champs `actual`, `tools`, `text` |
| Modèle et effort changés | `model-effort-change.json` : `gpt-6-astra/high` sur `omo-03` |
| Survie à `docker compose restart` | `restart-command.txt`, `after-restart.json`, `compose-ps-restart.txt` |
| Survie à `down/up`, avec volumes conservés | `recreate-actions.json`, `after-down-up.json`, `compose-ps-recreate.txt` |
| Huit sessions antérieures toujours présentes après chaque opération | `sessions` dans les deux preuves de survie |
| Inférence `gpt-6-astra/high` après chaque opération | `result` dans les deux preuves de survie |
| Chaînage HTTP complet 01 → 02…07 → 08 | `workflow.json` : triage, six spécialistes, décision, HTTP 200 |
| Tests du contrôleur | `unit-tests.txt` : cinq tests, cinq réussites |
| Montages RO, ports et politique de redémarrage | `container-boundaries.json` |
| Fenêtre Electron réelle sur Windows | `electron-dashboard.png`; fenêtre « OmO — huit démons Docker » laissée ouverte |
| Ports hôtes, Startup et processus persistants | `host-listeners.json`, `startup.json`, `task-processes.json` |
| Configuration effective et permissions des huit serveurs | `effective-configs.json` |

Les premières tâches répartissent le résumé du rapport Antigravity, ses limites de preuve et ses contrôles de non-régression, ainsi que l’audit des réglages VS Code auto-approve, Copilot et pi-code. Chaque preuve contient un appel `read` achevé et une réponse non vide. Le contrôleur expose le modèle et l’effort par démon, leurs changements à chaud, les derniers journaux Docker et `/workflow` sur `127.0.0.1:4310`. Les identités de modèle/variante sont les métadonnées retournées par OpenCode; elles ne constituent pas une attestation indépendante du déploiement interne d’OpenAI.

Les paramètres de démarrage sont `gpt-6.1-sol/medium`, sauf `omo-03` laissé à `gpt-6-astra/high` pour conserver le changement prouvé. Les paramètres hôtes audités n’ont pas été modifiés.

## Identifiants et restrictions

`~/.codex/auth.json` est monté RO. Au premier démarrage, le jeton OAuth existant est converti dans le format du fournisseur officiel OpenCode, puis conservé dans le volume privé du démon. Aucun secret n’est intégré à l’image ou suivi dans git. Le mot de passe HTTP est généré dans `.env` ignoré. Les deux documents hôtes sont montés RO. Les permissions de l’agent autorisent uniquement leur lecture; les autres outils et lectures sont refusés. Aucun socket Docker ni répertoire utilisateur complet n’est monté.

Google, Gemini, Google Vertex et Antigravity sont explicitement désactivés; la liste fermée des fournisseurs n’autorise qu’OpenAI. Les huit lectures API confirment cet état. Il s’agit d’une restriction applicative vérifiée, sans pare-feu de sortie indépendant. Aucun essai NIM/NGC n’a été effectué. Ollama est défini comme fournisseur local secondaire facultatif, désactivé partout, sans repli automatique; son activation est documentée et sa configuration est testée unitairement, son inférence reste non testée.

## Écarts et limites

- **Moteur Docker Desktop non redémarré** : cette opération aurait affecté `linuxfv` et les services `site-semantic-index`. L’alternative autorisée `compose down/up` a été utilisée uniquement sur le projet créé pour cette tâche, sans suppression de volumes. Les quatre conteneurs préexistants ont conservé leurs ID, état et heure de démarrage (`externalBefore`/`externalAfter` dans `recreate-actions.json`). Un redémarrage réel de Windows ou du moteur reste non vérifié.
- **MCP hôte non reliés** : `cua-driver` et `windows-mcp` sont configurés comme processus stdio, sans pont HTTP identifié. Aucun pont improvisé n’a été ajouté. `host.docker.internal` est prévu pour Ollama, pas comme conversion stdio/HTTP.
- **Renouvellement OAuth à expiration non forcé** : l’utilisation actuelle est prouvée et le stockage est inscriptible/persistant. Le renouvellement simultané de huit copies d’un même identifiant n’a pas été testé; une révocation ou expiration peut demander une réauthentification et un réamorçage des copies privées. Le fichier hôte reste protégé en lecture seule.
- **Démarrage Windows** : raccourci Startup installé vers `wscript.exe //B ...\hidden-run.js`, qui utilise `WshShell.Run` avec style 0. Le lancement sans console et la fenêtre visible sont observés. Une nouvelle ouverture de session Windows n’a pas été déclenchée. Docker Desktop doit lui-même être disponible au démarrage; le lanceur effectue six essais bornés.
- **Contrôleur local** : une session active par démon, sans file de workflows durable ni reprise automatique d’un workflow interrompu. Son dernier résultat est en mémoire; les sessions OpenCode restent dans les volumes. Le port 4310 est destiné aux processus locaux de confiance, sans authentification multiutilisateur.

Deux particularités ont été corrigées pendant la validation : la modification utilise `/global/config` avec invalidation et lecture de contrôle, plutôt que le fichier local non rechargé écrit par `/config`; les règles de lecture sont relatives au worktree `/`. Electron ouvre sa fenêtre après `app.whenReady()` sans bloquer l’évaluation de son module ESM. Les preuves finales de lecture rejettent une réponse dépourvue d’appel `read` achevé.

## Commandes de vérification

Depuis la racine du worktree, PowerShell 7 :

```powershell
docker compose -f tooling\omo-fleet\daemons\docker-compose.yml ps
node tooling\omo-fleet\daemons\probe.mjs health
Invoke-RestMethod http://127.0.0.1:4310/api/daemons
node --test --test-timeout=10000 tooling\omo-fleet\daemons\controller.test.mjs
node tooling\omo-fleet\daemons\run.mjs 550 node tooling\omo-fleet\daemons\probe.mjs workflow
```

Les commandes de preuve ont des délais fermes; les processus transitoires de la tâche sont terminés. Les huit démons, le contrôleur et la fenêtre Electron restent intentionnellement actifs. Les PID et les journaux de lancement sont conservés localement dans `runtime/`, ignoré par git. Les commits sont locaux seulement.
