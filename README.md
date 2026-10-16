# Maroc en chiffres

Plateforme indépendante de visualisation des finances publiques marocaines, en français, anglais et arabe RTL. Le compteur principal désigne la **dette du Trésor** ; la dette consolidée des administrations publiques possède son propre indicateur. Observations officielles, estimations et simulations restent distinctes.

La première version comprend les pages publiques, le simulateur, les graphiques et exports, un moteur financier testé, le back-office Supabase et les pipelines documentaires. Aucun chiffre officiel n’a encore été validé : l’accueil affiche **« Données en cours d’intégration »**. Les paramètres du simulateur sont explicitement illustratifs. Le projet n’est affilié à aucune institution publique marocaine.

## Mettre le site en ligne et ajouter les données

Suivre le **[guide de déploiement pas à pas](docs/deployment.md)**. Il explique le déploiement **Hostinger**, Supabase, le premier compte administrateur et l’ajout des liens documentaires. En cas d’erreur « package.json introuvable », il précise aussi comment vérifier la branche et le dossier racine.

| Besoin | Où agir |
| --- | --- |
| Déployer le site | Hostinger hPanel → application web Node.js → importer `ssamri/Maroc-data-finance`, framework Next.js, racine **`.`**, branche **`main`** après fusion |
| Renseigner l’URL et la clé publique Supabase | Hostinger → paramètres de l’application Node.js → variables d’environnement, selon [.env.example](.env.example) |
| Donner les droits au premier administrateur | Supabase → SQL Editor → uniquement `maroc_en_chiffres.admin_users`, procédure dans [deployment.md](docs/deployment.md#2-configurer-supabase) |
| Ajouter un document et son URL officielle | Le site → `/admin` → **Documents** → **Importer un document source** |
| Configurer les liens téléchargés automatiquement | GitHub → [data/collection-manifest.json](data/collection-manifest.json) → entrée de l’institution → `landingPages` et `documents` |
| Exécuter la collecte immédiatement | GitHub → Actions → **Collect official source documents** → **Run workflow** |
| Contrôler et publier un chiffre | `/admin` → **Référentiel**, puis **Documents**, puis **Observations** |

La collecte peut télécharger automatiquement des documents et extraire les fichiers disposant d’un mapping contrôlé. **Le transfert automatique des candidats vers Supabase reste à développer.** Pour cette version, les artefacts sont téléchargés depuis GitHub Actions, puis les documents et observations sont ajoutés et approuvés dans le back-office. Une URL seule ne suffit pas à extraire ni à publier un chiffre. Le fonctionnement exact figure dans [docs/automation.md](docs/automation.md).

## Installation locale

Versions utilisées : Node **24.19.0**, Python **3.12.14**. Minimum : Node ≥22.12 et Python ≥3.11. Les dépendances sont épinglées ; `npm ci` utilise le lockfile. Les tâches cloud sont déjà isolées : utiliser le checkout existant, sans créer de worktree supplémentaire.

```bash
cd /workspace/Maroc-data-finance
export NPM_CONFIG_CACHE=/tmp/mec-npm-cache
npm ci --include=dev
test -f .env.local || cp .env.example .env.local
npm run dev
```

Ouvrir `http://localhost:3000`. Les pages et le simulateur fonctionnent sans Supabase. Pour un serveur de production : `npm run build`, puis `npm run start`.

Pour extraire des PDF/XLSX en local :

```bash
python3 -m venv /workspace/.venvs/maroc-en-chiffres
/workspace/.venvs/maroc-en-chiffres/bin/python -m pip install \
  --cache-dir /tmp/mec-pip-cache -r data/requirements-ingestion.txt
export PATH="/workspace/.venvs/maroc-en-chiffres/bin:$PATH"
```

Les snapshots cloud peuvent conserver fichiers et dépendances ; les serveurs doivent être relancés. Publier l’environnement cloud ne déploie pas le site public.

## Configuration Supabase

Projet autorisé : **lodgicore**, référence `vxuvjdskfmotauypkmav`, URL `https://vxuvjdskfmotauypkmav.supabase.co`. L’application utilise le schéma **`maroc_en_chiffres`** et le bucket privé **`maroc-en-chiffres-documents`**. Elle ne réutilise aucune table métier de `public` et ne cible pas `Otels.ma`.

Les quatre migrations versionnées se trouvent dans [supabase/migrations](supabase/migrations). Elles doivent être appliquées dans l’ordre après vérification du projet et de l’absence de collisions. L’état d’application distante et la procédure sont documentés dans [docs/supabase.md](docs/supabase.md). Ne pas exécuter le bootstrap de test local sur le projet distant.

| Variable | Valeur ou origine |
| --- | --- |
| `SUPABASE_PROJECT_REF` | `vxuvjdskfmotauypkmav` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vxuvjdskfmotauypkmav.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **ou** `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique du même projet, depuis Supabase → Settings → API Keys |
| `NEXT_PUBLIC_SITE_URL` | URL HTTPS réelle du site déployé, puis domaine personnalisé s’il est configuré |
| `SUPABASE_DB_URL` | Connexion PostgreSQL réservée à l’opérateur des migrations ; inutile pour le site |

En local, utiliser `.env.local`, ignoré par Git. En production, utiliser les paramètres sécurisés de l’hébergeur. **Ne pas utiliser de clé secrète ou `service_role` dans une variable `NEXT_PUBLIC_*` ni dans Git.** Reconstruire après modification des variables publiques Next.js.

Le back-office utilise Supabase Auth, `auth.getUser()` et le profil actif de `maroc_en_chiffres.admin_users`. Chaque requête conserve le JWT de l’utilisateur ; les règles RLS s’appliquent aux lectures et écritures. La publication exige une institution, une source, un document et une définition approuvés. Les observations et définitions approuvées sont immuables ; les corrections passent par des révisions.

## Architecture

Next.js **16.4.0**, App Router, React **19.3.0**, TypeScript strict **5.9.3**, Tailwind **4.3.3**, Button shadcn/ui adapté avec Radix, ECharts **6.1.0**, Motion **14.2.0**, Lucide, Zod **4.6.7**, Supabase JS **2.117.3** et Decimal.js. Versions vérifiées au registre npm le 14 octobre 2026.

```text
src/app/                  Routes publiques, API administrateur et SEO
src/components/           Design system, compteurs, graphiques et simulateur
src/components/admin/     Connexion, référentiels, documents et validation
src/lib/finance/          Calculs décimaux indépendants et tests
src/lib/data/             Types, sources, validation, séries et lecteur Supabase
src/lib/supabase/         Clients RLS, Auth serveur et types PostgreSQL
data/                     Jeu public, sources et manifestes de collecte
scripts/                  Collecte HTTPS et extraction PDF/CSV/XLSX
supabase/migrations/      SQL versionné dans le schéma isolé
supabase/tests/           Tests PostgreSQL et RLS locaux
tests/e2e/                Navigation, mobile, RTL et accessibilité
.github/workflows/        Collecte documentaire quotidienne en lecture seule
docs/                     Déploiement, sources, méthodes et validation
```

Les montants exacts sont des chaînes décimales dans le moteur, les CSV et les compteurs. PostgreSQL exporte `numeric::text` ; seuls les graphiques utilisent une approximation `number`. Les révisions approuvées les plus récentes sont sélectionnées par définition et période. Les définitions comptables incompatibles ne sont pas réunies dans une même série.

## Fonctionnalités

- Accueil responsive, compteur du Trésor, repères financiers et statuts pédagogiques avec provenance.
- Routes `/`, `/dette-publique`, `/budget`, `/deficit`, `/interets`, `/historique`, `/comparateur`, `/simulateur`, `/sources`, `/methodologie`, `/a-propos`, `/admin` ; versions anglaises sous `/en` et arabes sous `/ar`.
- Thèmes clair/sombre, navigation clavier, prise en compte des animations réduites et arabe RTL.
- Historique avec filtres, zoom, courbes/barres, tableau accessible et export CSV exact. Les graphiques restent vides sans observation approuvée.
- Simulateur fonctionnel avec dette, croissance nominale, population, intérêts, principal, horizon et exports CSV/PNG.
- Moteur financier : ancrages, interpolation documentée, projections limitées à 366 jours, conversions et années bissextiles. Le déficit n’est jamais assimilé à la variation du stock de dette. Aucune projection nationale n’est activée sans méthode et ancrage approuvés.
- Back-office : authentification, référentiels, correction des définitions non approuvées, documents privés, SHA-256, observations exactes et revue auditée.
- SEO : métadonnées traduites, Open Graph, canonical/hreflang, sitemap, robots et JSON-LD.
- Bibliothèque de neuf institutions et quatorze indicateurs trilingues ; collecte documentaire quotidienne à **06:17 UTC** et extraction sur mappings explicites.

Les séries internationales harmonisées, la gestion éditoriale complète, les traductions administrables et le transfert automatique des extractions vers Supabase restent à compléter. La bibliothèque ne certifie pas la fraîcheur de documents non récupérés. Les résultats et limites des accès réellement vérifiés sont consignés dans [docs/validation.md](docs/validation.md).

## Vérifications

```bash
npm run lint
npm run typecheck
npm test
npm run test:ingestion
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm run test:db
```

Les tests navigateur exigent un build courant et le port 3000 libre ; ils lancent leur propre serveur de production. Utiliser un Chromium local ou installer celui de Playwright avec TLS vérifié. Les tests SQL utilisent un conteneur PostgreSQL 17 sans réseau ni port exposé ; son bootstrap Auth/Storage est uniquement une fixture locale.

Résultats détaillés : [docs/validation.md](docs/validation.md). Les tests locaux ne remplacent pas la validation de Supabase Auth, Storage et PostgREST sur le projet distant. Les Core Web Vitals sont à mesurer sur le déploiement ; un audit axe seul n’établit pas une conformité WCAG complète.

## Documentation et licence

- [Déployer et ajouter ses premiers documents](docs/deployment.md)
- [Migrations, isolation et droits Supabase](docs/supabase.md)
- [Collecte automatique et mappings](docs/automation.md)
- [Sources officielles et extraction](docs/sources.md)
- [Formules et limites financières](docs/calculations.md)
- [Résultats des vérifications](docs/validation.md)

Code sous **GPL-3.0**, conformément à la licence initiale du dépôt. Les données restent soumises aux droits de leurs producteurs. Attribution shadcn/ui dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
