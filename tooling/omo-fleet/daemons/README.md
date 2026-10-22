# Huit démons Docker locaux

Les services `omo-01` à `omo-08` utilisent **OpenCode 1.19.4**, paquet npm officiel `opencode-ai`, et son fournisseur OAuth ChatGPT/Codex intégré. Ce sont les démons de la flotte OmO; le moteur senpi d’OmO n’est pas exécuté dans ces conteneurs.

## Choix du serveur

L’aide de `C:\Users\fvegi\.local\bin\omo.exe` 5.1.41 et les documents installés `C:\Users\fvegi\.omo\binary-runtime\5.1.41\docs\rpc.md` documentent `--mode rpc`, `--multi-session`, `host ensure` et `--listen unix://...`/stdio. Aucun serveur HTTP équivalent à `/global/health` et `/session` n’y est documenté. Construire un pont RPC aurait ajouté un protocole à maintenir. Le repli demandé, [OpenCode serve](https://opencode.ai/docs/server), fournit déjà ces routes; les huit inférences authentifiées sont vérifiées dans `evidence/`.

OmO est installable sous Linux : l’[installeur officiel](https://get.omo.dev/install.sh) accepte une version (`curl -fsSL https://get.omo.dev/install.sh | bash -s -- 5.1.41`), choisit Linux/architecture/libc et vérifie les sommes SHA256. Il a été téléchargé pour inspection, **pas exécuté**. Le README officiel local `D:\Github\oh-my-openagent\README.md` documente aussi `npm i -g omo-ai`, et non le paquet tiers `omo`. Aucune installation OmO Linux n’est revendiquée ici.

Sources : [installation OpenCode](https://opencode.ai/docs/), [authentification ChatGPT Plus/Pro](https://opencode.ai/docs/providers/#openai), [liste fermée de fournisseurs](https://opencode.ai/docs/config/#enabled-providers), [serveur et authentification HTTP](https://opencode.ai/docs/server). La configuration utilise l’authentification OAuth existante autorisée par Francis, sans clé API payante additionnelle ni connexion interactive.

## Démarrer et vérifier

Depuis la racine du worktree, dans PowerShell 7 :

```powershell
node tooling\omo-fleet\daemons\setup.mjs
node tooling\omo-fleet\daemons\run.mjs 120 docker compose -f tooling\omo-fleet\daemons\docker-compose.yml build omo-01
node tooling\omo-fleet\daemons\run.mjs 45 docker compose -f tooling\omo-fleet\daemons\docker-compose.yml up -d --no-build
node tooling\omo-fleet\daemons\probe.mjs health
node --test --test-timeout=10000 tooling\omo-fleet\daemons\controller.test.mjs
```

`setup.mjs` crée seulement le mot de passe HTTP local dans `.env` ignoré. Le contexte de build contient uniquement le Dockerfile et les deux modules de démarrage/configuration. Aucun identifiant ni fichier de preuve n’entre dans l’image.

Huit ports sont publiés uniquement sur `127.0.0.1:4401…4408`; chaque serveur écoute sur 4096 dans son conteneur. L’accès direct exige HTTP Basic, utilisateur `opencode`, mot de passe du `.env` local. `rpc()` dans `controller.mjs` fournit un client sans afficher ce mot de passe. Ne pas copier la sortie de `docker compose config` ou d’un `docker inspect` complet dans les preuves : elle contient les variables privées.

Les sources hôtes sont limitées à trois fichiers : l’auth Codex, le rapport Antigravity et les paramètres VS Code. Les trois sont montés **en lecture seule**. Au premier démarrage, les champs OAuth sont convertis dans le format OpenCode et écrits dans un volume nommé privé par démon. Les redémarrages conservent ce volume et ne remplacent pas les jetons renouvelés. Les permissions de l’agent autorisent seulement la lecture des deux documents de travail; bash, écriture, recherche générale et accès aux identifiants sont refusés. Les motifs de lecture sont relatifs au `worktree` OpenCode `/`, donc `workspace/nom-du-fichier`.

## Contrôleur, tableau de bord et API

`http://127.0.0.1:4310` sert les nouveaux assets du dossier `dashboard/public` avec les tokens et styles existants. `electron/main.mjs` charge ce tableau de bord dans son mode démons; le mode de transport historique reste disponible. L’API refuse les hôtes étrangers et les mutations provenant d’une autre origine ou sans JSON. Elle est réservée aux applications locales de confiance; aucune authentification multiutilisateur n’est fournie sur 4310.

| Route | Fonction |
|---|---|
| `GET /api/daemons` | Santé réelle, fournisseurs, modèle/effort configurés, occupation et dernière réponse du processus courant |
| `PATCH /api/daemons/omo-01/config` | JSON `{ "providerID":"openai", "modelID":"gpt-6-astra", "effort":"high" }` |
| `POST /api/daemons/omo-01/message` | JSON `{ "question":"Lis /workspace/antigravity-routing.md et résume." }` |
| `GET /api/daemons/omo-01/logs` | 30 dernières lignes Docker, commande limitée à 10 secondes |
| `POST /workflow` | JSON `{ "question":"Question à analyser" }`; triage 01, six spécialistes 02–07, décision 08 |

Le changement de configuration passe par `PATCH /global/config`, invalide l’instance, vérifie `GET /config`, puis remplace atomiquement `config/omo-0N.json`. `PATCH /config` local seul n’était pas effectif dans cette topologie : il écrit `/workspace/config.json`, qui n’est pas rechargé comme configuration de projet. Le contrôleur transmet aussi explicitement modèle et variante dans chaque message. Un démon occupé refuse les changements. Une requête d’inférence est limitée à 180 secondes; en cas d’échec réseau, sa session est annulée. Les sessions OpenCode persistent; l’historique affiché par le contrôleur est en mémoire. Le workflow n’est pas une file durable et doit être relancé après un arrêt du contrôleur.

Les démons utilisent normalement `gpt-6.1-sol/medium`. `omo-03` reste sur `gpt-6-astra/high` pour conserver la configuration démontrée. Les limites de contexte/sortie dans `runtime-config.mjs` sont des plafonds locaux configurés, pas une découverte des limites commerciales des modèles.

## Ollama facultatif et MCP de l’hôte

Ollama est **désactivé par défaut**, sans repli automatique. Une activation volontaire peut utiliser `PATCH /api/daemons/omo-01/ollama` avec `{ "enabled":true, "modelID":"nom-exact-du-modele-local" }`. L’URL est fixée à `http://host.docker.internal:11434/v1`, via `@ai-sdk/openai-compatible`. Ensuite, `POST .../message` peut recevoir `"providerID":"ollama"`. Désactiver avec `{ "enabled":false }`. Le workflow continue d’utiliser OpenAI. La définition existe et est testée unitairement; aucune inférence Ollama n’a été exécutée, conformément à son état désactivé. Aucun essai NIM/NGC n’a été fait.

Les configurations hôtes `cua-driver` (`args=["mcp"]`) et `windows-mcp` (`args=["serve"]`) utilisent des commandes locales stdio. Aucun pont MCP HTTP configuré n’a été identifié. Les démons n’y accèdent donc pas; `host.docker.internal` ne transforme pas stdio en HTTP. Aucun pont supplémentaire ni montage du socket Docker n’a été ajouté.

## Démarrage Windows sans console

Pour recréer le raccourci : `pwsh -File tooling\omo-fleet\daemons\install-startup.ps1`.

Le raccourci installé est `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OmO Docker Fleet.lnk`. Sa cible est `C:\Windows\System32\wscript.exe`; ses arguments appellent `//B D:\Github\dr-knowledge-lab\consolewatch\hidden-run.js`, puis le chemin absolu de Node 24 et de `daemons\launch.mjs`. Le lanceur existant utilise `WScript.Shell.Run(cmd, 0, true)` : fenêtre console cachée, fenêtre Electron visible. [Référence Microsoft WshShell.Run](https://learn.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/windows-scripting/d5fk67ky(v=vs.84)).

Le lanceur retente Docker jusqu’à six fois avec un délai borné par commande. Il réutilise un contrôleur compatible sur 4310; `--controller-only` permet de le relancer sans ouvrir une deuxième fenêtre. Les PID et journaux de démarrage sont dans `runtime/`, ignoré. Le contrôleur, Electron et les huit démons sont des services intentionnellement persistants; les commandes de test/build passent par `run.mjs`, qui impose une limite ferme et ne termine que son propre arbre de processus. Fermer Electron laisse le contrôleur et les démons actifs. Docker Desktop doit démarrer à l’ouverture de session; cette option Windows préexistante n’a pas été changée.

Les preuves et limites exactes figurent dans [REPORT.md](REPORT.md).
