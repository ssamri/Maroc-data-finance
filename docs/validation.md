# Validation exécutée — 14 octobre 2026

## Mise à jour du 16 octobre 2026

Le journal Hostinger du build `01a1456d-6fe8-73ca-8764-7e4bd580468e` établit que le dépôt et `package.json` sont bien trouvés, puis montre un panic Turbopack lors de la connexion au processus CSS/PostCSS. Le build de production utilise désormais l’option Next.js prise en charge **`--webpack`**. Sa compilation, la vérification TypeScript, la génération des pages et les traces de production ont réussi localement. Le CSS n’a pas été supprimé et les vérifications restent actives.

`npm run check` a de nouveau réussi : lint sans avertissement, TypeScript strict, **97 tests TypeScript dans 9 fichiers**, **24 tests Python** et build de production. Huit nouveaux cas protègent les requêtes administrateur derrière le reverse proxy HTTPS d’Hostinger : origine publique configurée acceptée, origines étrangères et configuration invalide refusées, aucun en-tête transféré arbitraire considéré comme fiable.

Le code est publié sur la branche GitHub `feat/maroc-en-chiffres-v1`. Le guide [Hostinger](deployment.md) et le README indiquent la racine `.` et les commandes Node.js. La création/fusion de PR doit être vérifiée par son état GitHub, pas déduite de cette documentation.

L’API GitHub fonctionne à nouveau. Supabase et son API de gestion répondent maintenant **401 Unauthorized** ; le réseau est accessible, mais aucun MCP Supabase n’est exposé et aucun identifiant SQL/Management API n’est injecté. Les migrations distantes ne sont donc toujours pas exécutées. Les refus proxy consignés ci-dessous restent la preuve de l’état initial du 14 octobre.

## Résultats initiaux

Instance cloud courante, branche `feat/maroc-en-chiffres-v1`, Node 24.19.0, Python 3.12.14. Aucun environnement distant ni déploiement de production n’est couvert par ces résultats.

| Vérification | Résultat |
| --- | --- |
| Installation reproductible `npm ci` | Réussie après épinglage et correction des compatibilités ESLint ; script cloud enregistré rejoué intégralement avec succès |
| Installation Python dans un venv isolé | pypdf 6.10.0 / openpyxl 3.1.5 installés, TLS conservé |
| `npm run lint` | Réussi, zéro avertissement autorisé |
| `npm run typecheck` | Réussi, TypeScript strict / noUncheckedIndexedAccess |
| `npm test` | **89 tests réussis**, 8 fichiers ; aucun échec, skip ou suite vide |
| `npm run test:ingestion` dans le venv | **24 tests réussis**, collecte et PDF/CSV/XLSX |
| `npm run build` | Build de production Next.js 16.4.0 réussi |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` | **19 tests réussis**, serveur de production démarré et requêtes réelles |
| Tests PostgreSQL locaux `npm run test:db` | Quatre migrations appliquées en fixture isolée, **78 assertions et 74 refus attendus** réussis |
| Accès GitHub HTTPS en lecture | Réussi sur le dépôt sélectionné |
| Collecte réelle des neuf sources | **Bloquée** : proxy HTTPS CONNECT 403, zéro document, code 2 `all_sources_unavailable` |
| Santé Supabase lodgicore | **Bloquée** : proxy HTTPS CONNECT 403 ; clé publique encore absente |
| Migrations/Auth/Storage Supabase distants | **Non exécutés**, aucun objet existant modifié |
| Workflow GitHub planifié | Préparé, **non publié ni exécuté à distance** |

## Portée des tests

Le moteur couvre les grands montants exacts, toutes les conversions d’échelle, UTC/années bissextiles, les horizons bornés, les bases comptables incompatibles, les divisions par zéro, les scénarios et la distinction dette/déficit/intérêts/principal. Les tests de présentation protègent également les entiers dépassant la précision JavaScript et les exports contre l’injection de formules CSV.

L’ingestion et la collecte utilisent des fixtures synthétiques, jamais publiées dans le jeu public. Elles vérifient les redirections, les hôtes HTTPS, les bornes de lecture, les délais, les signatures, les checksums, les dates/unités/périmètres et la production exclusive de candidats à contrôler.

Les API administrateur sont testées avec des clients simulés pour l’autorisation, la validation, la revue et le stockage privé. Les tests Chromium vérifient les **36 chemins localisés** via HTTP, les 404, le simulateur réellement recalculé, les téléchargements CSV/PNG, les paramètres invalides, le thème persistant, le passage français/arabe, le menu mobile et l’absence de débordement sur six pages à 390 pixels. Les routes administrateur refusent les requêtes anonymes sans retourner de données privées.

Le runner démarre un serveur neuf pour le build testé et refuse désormais la réutilisation d’un serveur déjà présent : une passe sur un ancien processus après rebuild a exposé des assets périmés. Ce processus a été arrêté et la validation reprise sur le build courant. Le test PNG vérifie également la signature binaire du fichier téléchargé.

Les audits axe WCAG 2 A/AA et 2.1 AA ne présentent aucune violation détectée sur sept pages en clair et quatre en sombre. Deux défauts réels du premier passage — contraste des chiffres dorés et langue/sens de lecture conservés après navigation client — ont été corrigés et revérifiés. Ce résultat ne constitue pas un audit manuel WCAG complet. Les Core Web Vitals terrain restent à mesurer après déploiement.

Les tests SQL utilisent PostgreSQL 17 dans un conteneur sans réseau et sans port exposé. Les roles anon/authenticated sont réellement exercés. La fixture comporte des tables/buckets/policies préexistants pour vérifier leur préservation et des policies Storage permissives pour vérifier l’isolation de notre nouveau bucket. Elle couvre aussi les droits, revues, dates/provenance, immutabilité après approbation et révisions/audits. Le bootstrap Auth/Storage local ne doit jamais être exécuté dans une base Supabase distante.

## Limites et prérequis suivants

L’application fonctionne localement avec ses états d’intégration et son simulateur ; aucune observation officielle ni projection nationale n’a été activée. La bibliothèque identifie des institutions, sans attester de la fraîcheur de documents non récupérés.

La collecte automatisée archive des fichiers et extrait les documents avec mapping explicite. Les mappings officiels et le transport des artefacts vers la file Supabase restent à configurer/développer. Aucune donnée extraite ne peut devenir publique sans approbation.

Pour valider le projet distant : autoriser le domaine Supabase, renseigner sa clé publique, vérifier/apppliquer les migrations dans `lodgicore`, ajouter le schéma `maroc_en_chiffres` aux schémas déjà exposés sans les remplacer et habiliter un compte pour cette application. Puis tester Auth, RLS/PostgREST, Storage et un cycle documentaire réel. Pour les sources : autoriser leurs domaines ou fournir les originaux et URL exactes, puis contrôler les mappings et licences.

Les changements de configuration cloud enregistrés sont un brouillon. Leur publication et la restauration dans une nouvelle tâche n’ont pas été effectuées pendant cette validation.
