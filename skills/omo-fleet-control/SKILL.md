---
name: omo-fleet-control
description: Piloter la flotte locale fvdev omo-01 a omo-08 dans Docker, lancer son workflow, envoyer une tache, regler modele et effort, et verifier les transmissions jusqu'a omo-08.
---

# Flotte locale fvdev

Utilise le controleur existant http://127.0.0.1:4310. Les huit serveurs sont OpenCode 1.19.4, pas le moteur senpi OMO. Le workflow fait triage 01, six analyses paralleles 02-07, puis synthese 08. Ce sont des agents en lecture seule avec deux documents montes; ne suppose pas qu'ils peuvent modifier un depot ou acceder aux MCP de l'hote.

Le client est `scripts/fleet.cjs` dans ce skill. Lance toujours avec Node. Sous Windows utilise Node 24 existant; depuis WSL, utilise `/mnt/c/Users/fvegi/AppData/Roaming/fnm/node-versions/v24.22.1/installation/node.exe` et le chemin Windows du script. Le localhost WSL ne rejoint pas ce controleur Windows. Si le chemin Node a change, retrouve l'installation existante, sans installer un second Node.

Commandes (arguments fichiers absolus pour les entrees et sorties):

```text
node fleet.cjs status sortie.json
node fleet.cjs workflow question.txt dossier-preuves
node fleet.cjs ask omo-04 question.txt sortie.json
node fleet.cjs config omo-03 configuration.json sortie.json
node fleet.cjs logs omo-03 sortie.json
node fleet.cjs verify workflow-result.json dossier-preuves
```

`config` accepte providerID=openai, modelID=gpt-6.1-sol ou gpt-6-astra, effort=low/medium/high. Ne change ces valeurs que lorsque la demande le justifie. Le client workflow et ask refuse une flotte/un demon occupe ou indisponible. Ne relance pas aveuglement une requete ayant expire: verifie d'abord occupation et dernieres sessions. Aucun repli fournisseur automatique.

Les commandes ont des delais fermes (maximum 560 secondes); utilise une execution qui rend la main et donne des mises a jour pendant l'attente. Ce client ne lance aucun service. Ne ferme pas les conteneurs, le controleur ou Electron, qui sont les services persistants de Francis.

Pour un workflow, le client conserve les reponses, relit les huit transcriptions depuis les serveurs puis compare les entrees reelles avec les sorties precedentes. Lis `workflow-verification.json`: PASS exige huit sessions distinctes, huit reponses concordantes et terminees, 6/6 receptions exactes du triage et 6/6 receptions exactes des analyses par 08, dans l'ordre temporel attendu. Le controle des lectures de fichiers y est informe, pas exige pour une question qui ne necessite pas de fichier. Lis la synthese avant de rapporter le resultat. Un voyant vert ne suffit pas.

Pour une preuve documentaire, demande explicitement a tous de lire `/workspace/antigravity-routing.md`. Le deuxieme document est `/workspace/vscode-settings.json`. Conserve les preuves dans le dossier de sortie de la conversation; les transcriptions peuvent contenir des extraits de ces documents, elles restent locales.

La configuration du service et `rpc()` sont dans `D:/Github/.wt/omo-fleet-20261022-ovplwz/tooling/omo-fleet/daemons/controller.mjs`. Le client reutilise rpc pour lire les transcriptions sans afficher le mot de passe. Ne lis pas auth.json, n'affiche pas .env et ne collecte pas un docker inspect complet. Si le worktree disparait, retrouve le chemin actif avant toute modification.

Ce skill rend le pilotage reutilisable sur ce PC; il ne constitue pas une surveillance autonome 24/7. Une demande de surveillance recurrente doit passer par les automations disponibles. Ne promets pas de fonctionner lorsque le PC, Docker ou le controleur est arrete.
