# OmO Fleet — fvdev

Flotte privée de huit serveurs OpenCode 1.19.4 dans Docker, avec contrôleur local, tableau de bord, fenêtre Electron et skill Codex de pilotage.

## Fonctionnement

`omo-01` produit le triage → `omo-02` à `omo-07` analysent en parallèle → `omo-08` synthétise les six réponses. Le contrôleur transmet les textes entre les sessions. OpenAI est le fournisseur actif; Ollama est désactivé. Les agents sont limités à la lecture des documents autorisés. Le moteur senpi OMO ne tourne pas dans ces conteneurs.

- Tableau de bord : `http://127.0.0.1:4310`.
- Serveurs authentifiés : `127.0.0.1:4401` à `4408`.
- Instructions : [daemons/README.md](tooling/omo-fleet/daemons/README.md).
- Pilotage : [omo-fleet-control](skills/omo-fleet-control/SKILL.md).

## Preuve du 22 octobre 2026

Test réussi en **37,558 secondes** : huit sessions distinctes, huit lectures réussies, six réceptions exactes du triage et réception exacte des six analyses par `omo-08`. Les réponses et la chronologie ont été vérifiées directement dans les sessions. Code de relais : `RONCE-642`.

[Verdict détaillé](evidence/2026-10-22/workflow-verification.json). Les transcriptions complètes restent sur le PC. Les noms de modèles sont ceux rapportés par OpenCode. Les liens vers les anciennes preuves brutes dans les documents sources désignent des fichiers conservés seulement sur le poste.

## Sauvegarde et restauration

Les fichiers du runtime sont copiés sans modification depuis le commit local `d0a267a`; leurs empreintes figurent dans [le manifeste](evidence/2026-10-22/source-manifest.json). Les composants LSP et le transport terminal historique ne font pas partie de cette sauvegarde.

Les chemins locaux fvdev sont conservés : le skill pointe vers le contrôleur actif dans `D:/Github/.wt/omo-fleet-20261022-ovplwz`. Pour restaurer ailleurs, adapter les chemins du skill, les deux montages documentaires Docker et le lanceur `hidden-run.js`, qui appartient à `D:/Github/dr-knowledge-lab/consolewatch` et n'est pas inclus. Les documents de travail, identifiants, volumes Docker, binaires et `node_modules` ne sont pas inclus.

Copier `skills/omo-fleet-control` dans `%USERPROFILE%/.agents/skills/`, puis invoquer `$omo-fleet-control`. Le skill est installé et validé sur fvdev; ses commandes `status` et `verify` ont été exécutées avec succès.

La flotte doit être en marche. Aucune surveillance autonome 24/7 n'est configurée. Les sessions persistent dans les volumes; l'historique du tableau de bord est en mémoire.

## Vérification locale sans inférence

```powershell
node --test --test-timeout=10000 tooling/omo-fleet/daemons/controller.test.mjs
node --check skills/omo-fleet-control/scripts/fleet.cjs
```

Lancer la flotte avec `daemons/launch.mjs`. L'ancien script Electron `npm run desktop` concerne le transport historique absent de cette sauvegarde.
