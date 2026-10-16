# Déployer Maroc en chiffres sur Hostinger et ajouter les données

Ce guide utilise **Hostinger pour l’application Next.js**, **Supabase pour la base, la connexion administrateur et les documents**, et **GitHub Actions pour la collecte quotidienne**. Le dossier racine du dépôt contient déjà l’application : le répertoire à sélectionner est **`.`**.

## 1. Déployer sur Hostinger

### Vérifier le type d’hébergement

Utiliser une offre Hostinger qui prend en charge les **applications web Node.js avec Next.js côté serveur**, ou un **VPS configuré pour Node.js**. Vérifier cette fonctionnalité dans votre formule Business/Cloud et dans hPanel : le seul nom de la formule ne garantit pas qu’un runtime Node.js soit disponible pour votre compte.

L’application contient des routes serveur pour Supabase et l’administration. Un hébergement limité à PHP, aux fichiers statiques ou au transfert FTP ne peut pas l’exécuter tel quel. Il ne suffit pas d’envoyer le dossier `.next` dans `public_html`. Si l’assistant GitHub/Node.js est déjà proposé dans hPanel, poursuivre avec cet assistant ; les libellés peuvent varier selon l’offre et la langue du panneau.

### Importer le bon dépôt et appliquer les réglages

1. Dans hPanel, ouvrir la gestion des **sites/applications**, puis l’assistant d’ajout ou de déploiement d’une **application Node.js**. Connecter GitHub et sélectionner **`ssamri/Maroc-data-finance`**. Si Hostinger n’affiche pas le dépôt, accorder à son intégration GitHub l’accès à ce dépôt.
2. Sélectionner **`main` après fusion du code**. Vérifier dans GitHub que cette branche contient **`package.json`**, **`package-lock.json`**, **`next.config.ts`** et **`src/`**. Si `main` ne contient encore que le README et la licence, le code est sur **`feat/maroc-en-chiffres-v1`** : utiliser cette branche temporairement, puis sélectionner `main` après fusion.
3. Dans le réglage du **dossier/répertoire racine**, choisir **`.`**, c’est-à-dire la racine du dépôt. Ne pas saisir `/workspace/Maroc-data-finance`, `Maroc-data-finance`, `src` ou `.next` : `/workspace` existe uniquement dans le cloud de développement.
4. Laisser détecter **Next.js**, ou choisir ce framework si le panneau le demande. Appliquer les réglages suivants lorsqu’ils sont proposés :

| Réglage | Valeur |
| --- | --- |
| Branche de production | `main`, une fois la PR fusionnée |
| Dossier racine | `.` |
| Framework | Next.js, avec exécution serveur |
| Node.js | **24.x** de préférence ; à défaut **22.x ≥22.12** |
| Gestionnaire de paquets | npm |
| Commande d’installation | `npm ci --include=dev` |
| Commande de build | `npm run build` |
| Commande de démarrage | `npm run start` |
| Dossier de sortie, s’il est demandé par le preset Next.js | Réglage automatique Next.js ; son build est `.next`, pas `dist` |

Les dépendances de développement sont nécessaires **pendant le build** : TypeScript et Tailwind en font partie. Le script `start` utilise déjà `next start --hostname 0.0.0.0`. **Conserver le port injecté par Hostinger dans `PORT`** ; Next.js le lit automatiquement. Ne pas imposer le port 3000 de votre poste de développement sur la plateforme gérée. Si le preset Next.js lit directement les scripts de `package.json`, il utilise les mêmes commandes sans champ supplémentaire.

Le script `build` utilise **`next build --webpack`** pour la production. Le journal Hostinger du 16 octobre 2026 montre un panic interne Turbopack pendant le lancement de son processus CSS/PostCSS ; Webpack utilise le chemin de compilation pris en charge sans ce mécanisme. Dans Hostinger, conserver **`npm run build`** pour utiliser ce réglage du dépôt, plutôt que lancer directement `next build`.

### Ajouter les variables d’environnement

Avant le build, ouvrir les paramètres/variables de l’application dans hPanel et ajouter :

| Nom | Valeur à renseigner |
| --- | --- |
| `SUPABASE_PROJECT_REF` | `vxuvjdskfmotauypkmav` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vxuvjdskfmotauypkmav.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé **publique publishable** du projet lodgicore, depuis Supabase → Settings → API Keys |
| `NEXT_PUBLIC_SITE_URL` | L’URL HTTPS finale réelle du site, sans chemin supplémentaire |

Si le projet fournit une clé publique historique **anon**, utiliser **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** à la place de `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Il suffit de renseigner l’une des deux. **Ne jamais choisir une clé secrète ni `service_role`.** `SUPABASE_DB_URL` n’est pas nécessaire sur Hostinger pour exécuter le site.

Ces variables doivent être disponibles **au build et à l’exécution**. Si le panneau distingue les deux phases, les configurer pour les deux. Les variables `NEXT_PUBLIC_*` sont incorporées au build : modifier une valeur exige une **reconstruction et un nouveau déploiement**, pas seulement un redémarrage du processus.

### Lancer et vérifier le déploiement

1. Lancer le déploiement depuis l’assistant. Lire les journaux : installation npm, build Next.js, puis démarrage du serveur doivent réussir. L’installation Python n’est pas nécessaire à l’hébergement web ; la collecte tourne séparément dans GitHub Actions.
2. Ouvrir l’URL de prévisualisation fournie par Hostinger ou le domaine configuré. Si le domaine n’était pas connu au premier build, laisser d’abord `NEXT_PUBLIC_SITE_URL` vide ; dès que son URL HTTPS est connue, renseigner la variable et reconstruire le site pour les URL SEO.
3. Associer le domaine dans la gestion de cette application/site, puis appliquer chez le gestionnaire DNS les enregistrements exacts affichés par Hostinger. Attendre la validation du domaine et du certificat HTTPS. Ne pas modifier les DNS d’un autre site au hasard.
4. Lorsque le domaine définitif est actif, utiliser son origine HTTPS dans `NEXT_PUBLIC_SITE_URL`, puis reconstruire/redéployer.
5. Vérifier que l’intégration suit **`main`**. Si Hostinger propose le déploiement automatique des nouveaux commits, l’activer pour cette branche ; sinon déclencher un nouveau déploiement après chaque mise à jour validée.

### Si « package.json introuvable » apparaît

Dans GitHub, ouvrir le dépôt puis la **même branche que celle sélectionnée dans Hostinger**. Le fichier `package.json` doit être visible à la racine. S’il manque sur `main`, actualiser l’import après la fusion de la PR ou choisir temporairement la branche `feat/maroc-en-chiffres-v1`. S’il est bien présent, remettre le dossier racine sur **`.`**, actualiser l’analyse du dépôt et relancer le déploiement. Aucun nouveau dossier ni fichier `package.json` vide n’est à créer.

### Si Turbopack échoue pendant la compilation CSS

Le journal reçu le 16 octobre 2026 contient `TurbopackInternalError`, `creating new process` et `node process exited before we could connect to it` pour `admin-console.module.css`. Le fichier CSS est valide ; le processus de compilation Turbopack ne parvient pas à établir sa connexion dans l’environnement Hostinger. Le correctif du dépôt choisit Webpack pour le build de production, sans supprimer de CSS ni désactiver la vérification TypeScript.

Après récupération du correctif sur `main`, relancer **`npm run build`**. Le journal doit afficher **`next build --webpack`**, puis **`Next.js 16.4.0 (webpack)`**. S’il affiche encore Turbopack, vérifier que Hostinger récupère bien le dernier commit de `main` et que la commande n’est pas remplacée par `next build` dans le panneau.

Les quatre alertes npm du journal sont une seule vulnérabilité transitive des outils de développement (`@next/eslint-plugin-next → fast-glob → micromatch → braces`, [avis GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). L’audit des dépendances de production ne remonte aucune vulnérabilité au 16 octobre 2026. Ces alertes ne causent pas le panic Turbopack. Aucun correctif de version compatible n’étant disponible à cette date, ne pas appliquer la rétrogradation majeure suggérée par `npm audit fix --force` pour tenter de corriger ce build.

### Si votre compte ne propose que l’hébergement statique/PHP

Activer une formule proposant les applications Node.js/Next.js ou utiliser un VPS. Sur VPS, la séquence applicative reste `npm ci --include=dev`, `npm run build`, `npm run start` avec les mêmes variables, Node 24 et un port interne. Le VPS demande en plus un gestionnaire de processus, un reverse proxy HTTPS, les mises à jour et une configuration réseau ; ces services ne sont pas configurés par ce dépôt. La voie hPanel Node.js gérée évite cette administration système.

Le support officiel est disponible sur [hostinger.com/support](https://www.hostinger.com/support/). Le 16 octobre 2026, sa consultation directe depuis ce cloud était refusée par le proxy ; les libellés exacts de votre panneau et les limites de votre formule doivent être vérifiés dans votre compte. Ce guide décrit les réglages attendus par le code, sans supposer l’accès à votre hPanel.

## 2. Configurer Supabase

Dans [le Dashboard Supabase](https://supabase.com/dashboard/project/vxuvjdskfmotauypkmav), vérifier que le projet sélectionné est **lodgicore**, référence **`vxuvjdskfmotauypkmav`**. Le projet partagé contient d’autres applications : notre périmètre est le schéma `maroc_en_chiffres` et le bucket privé `maroc-en-chiffres-documents`.

1. Vérifier l’état des quatre migrations dans [supabase.md](supabase.md). Si elles sont déjà appliquées, ne pas les réexécuter : le premier `CREATE SCHEMA` refuse volontairement un namespace déjà existant. Si leur exécution est bloquée par l’absence d’accès distant, suivre la procédure de ce document pour établir la connexion puis appliquer uniquement les nouveaux fichiers SQL, dans l’ordre. Ne pas lancer de reset ni le bootstrap de test local.
2. Dans **Data API → Exposed schemas** — selon la version du Dashboard, sous les réglages API — **ajouter `maroc_en_chiffres` à la liste existante**. Conserver tous les schémas déjà exposés. Les permissions SQL/RLS sont apportées par les migrations ; aucune lecture publique des brouillons n’est requise.
3. Dans **Settings → API Keys**, copier la clé publique du même projet vers les variables Hostinger décrites ci-dessus. Conserver toutes les clés existantes ; aucune rotation n’est nécessaire pour ce site.
4. Dans **Authentication → Users**, choisir un compte dédié à cette application disposant d’un e-mail et d’un mot de passe, ou créer ce compte selon la politique Auth déjà en place. Copier son **UUID**. Ne pas modifier les comptes ou les mots de passe des autres applications.
5. Dans **SQL Editor**, exécuter uniquement l’insertion suivante après remplacement de l’espace réservé par l’UUID réel :

```sql
insert into maroc_en_chiffres.admin_users
  (user_id, display_name, role, active)
values
  ('UUID_REEL_DU_COMPTE_AUTH', 'Administrateur Maroc en chiffres', 'admin', true);
```

Cette instruction attribue un rôle **dans notre application**. Elle ne change aucun compte Auth ni aucun rôle métier de lodgicore. Si ce profil existe déjà, vérifier son rôle et son statut plutôt que réexécuter l’insertion.

6. Ouvrir **`https://votre-domaine/admin`**, saisir l’e-mail et le mot de passe de ce compte, puis vérifier que les onglets **Observations**, **Documents** et **Référentiel** apparaissent.

La connexion actuelle utilise e-mail/mot de passe, sans callback OAuth. Ne pas remplacer le **Site URL** global d’Auth de lodgicore pour ce déploiement. Si vous utilisez une invitation nécessitant une redirection vers cette application, ajouter seulement son URL HTTPS aux **Redirect URLs** existantes, en conservant la configuration des autres applications. Aucun secret n’est à envoyer dans un chat.

## 3. Où ajouter les liens des données

Deux emplacements correspondent à deux usages :

| Usage | Emplacement | Effet |
| --- | --- | --- |
| Archiver un document, conserver sa source, puis publier des observations après revue | Le site → **`/admin` → Documents → Importer un document source → URL documentaire HTTPS** | Le fichier est enregistré dans le bucket privé avec son URL et son empreinte. L’import n’effectue pas d’extraction automatique. |
| Télécharger périodiquement les publications officielles | GitHub → **`data/collection-manifest.json`** | GitHub Actions lit les pages configurées et télécharge les fichiers explicites ou découverts. |

La page publique **`/sources`** est une bibliothèque de consultation. Elle ne contient pas le formulaire d’administration. Un lien ajouté dans Documents n’est pas automatiquement ajouté au manifeste GitHub ; un lien du manifeste n’est pas automatiquement importé dans Supabase.

### Ajouter un premier document et un premier chiffre depuis le site

1. Dans **`/admin` → Référentiel**, contrôler les institutions et sources dont vous allez utiliser les publications. Cliquer **Contrôler**, renseigner un motif documenté, puis **Approuver**. Ordre : **institution → source**.
2. Contrôler l’indicateur concerné, puis sa définition. Les migrations fournissent **9 institutions, 9 sources, 14 indicateurs et 14 définitions en brouillon**. Ils ne constituent pas des chiffres approuvés. Pour une définition, utiliser **Modifier la définition** pour préciser la base comptable, l’unité, l’échelle, le périmètre, la fréquence et la date de validité d’après la publication. Cette date doit couvrir la période observée. Une base « À préciser » empêche l’approbation. Ordre : **indicateur → définition**.
3. Aller dans **Documents → Importer un document source**. Sélectionner l’institution et la source approuvées ; remplir titre, **URL HTTPS exacte du fichier sur le site officiel**, date de publication et langue ; choisir le PDF, CSV ou XLSX original ; cliquer **Importer pour contrôle**. La date de publication doit provenir du document, pas du jour de téléchargement.
4. Consulter l’original et la copie privée. Cliquer **Contrôler**, expliquer la vérification et **Approuver** le document.
5. Aller dans **Observations → Soumettre une observation**. Sélectionner l’indicateur, sa définition et le document approuvés. Saisir la valeur exacte avec un **point décimal, sans séparateur de milliers**, les dates de période, le statut du producteur et une localisation précise : page, tableau, ligne ou cellule. L’unité et l’échelle viennent de la définition sélectionnée. Cliquer **Soumettre à validation**.
6. Comparer le chiffre à l’original, puis **Contrôler → Approuver**. Les prochaines lectures des pages publiques afficheront cette observation ; aucun redéploiement du site n’est nécessaire pour une approbation Supabase. Une révision reste un nouvel enregistrement, jamais un écrasement d’une observation approuvée.

**Taille des fichiers sur Hostinger :** vérifier la limite des requêtes de votre offre et du proxy devant Node.js. Le formulaire annonce 20 Mo ; une limite plus basse de l’hébergeur peut refuser le téléversement avant l’application. Ne pas tronquer un rapport officiel : pour un fichier dépassant la limite effective, il faut adapter l’hébergement ou intégrer un téléversement direct vers Supabase avec validation serveur.

### Ajouter un lien à la collecte automatique depuis GitHub

1. Ouvrir [data/collection-manifest.json](https://github.com/ssamri/Maroc-data-finance/blob/main/data/collection-manifest.json), puis **Edit this file**. Si le fichier n’est pas encore sur `main`, choisir `feat/maroc-en-chiffres-v1` dans le sélecteur de branche GitHub. Modifier l’entrée de l’institution concernée ; conserver les autres entrées et les limites.
2. Dans **`landingPages`**, placer la page HTTPS officielle qui liste les rapports pertinents. Une page précise de publications fonctionne mieux qu’une page d’accueil générale. Dans **`discoveryTerms`**, garder les mots qui permettent d’identifier ces publications.
3. Dans **`documents`**, ajouter les liens directs vérifiés vers les PDF/CSV/XLSX à collecter. Pour le MEF, l’entrée suivante montre la forme attendue ; **remplacer `URL_HTTPS_EXACTE_DU_DOCUMENT_OFFICIEL` par un vrai lien avant d’enregistrer**. Ce bloc remplace seulement l’entrée `mef`, pas tout le fichier :

```json
{
  "id": "mef",
  "allowedHosts": ["finances.gov.ma", "www.finances.gov.ma"],
  "landingPages": ["https://www.finances.gov.ma/"],
  "discoveryTerms": ["dette", "budget", "PLF", "rapport"],
  "documents": [
    {
      "url": "URL_HTTPS_EXACTE_DU_DOCUMENT_OFFICIEL",
      "format": "pdf"
    }
  ]
}
```

4. Si le fichier utilise un autre **sous-domaine de cette même institution**, ajouter son nom exact dans `allowedHosts`. Le collecteur vérifie aussi les redirections : tous leurs hôtes doivent être déclarés. Il refuse les destinations hors du domaine institutionnel, les URL nécessitant une authentification et les connexions HTTP. Ne pas ajouter un domaine tiers simplement pour faire passer une erreur.
5. Enregistrer la modification par un commit sur la branche autorisée ou par une PR vers `main`, selon les règles du dépôt. Le manifeste ne contient aucune clé ni aucun mot de passe.

Pour **l’extraction automatique**, ajouter `extractionManifest` à l’objet documentaire, uniquement lorsqu’un mapping réel existe dans `data/`, par exemple `"extractionManifest": "extraction/rapport-mef-verifie.json"`. Le chemin est relatif au dossier du manifeste de collecte, et le fichier doit déjà exister. Utiliser [manifest.template.json](../data/manifest.template.json) et les instructions [CSV/XLSX ou PDF](sources.md#pipeline-local-de-revue) : la source et l’URL doivent correspondre au document, la date doit être vérifiée, et chaque entrée PDF doit décrire la page physique et la capture exacte. Ajouter ce champ sans mapping fait échouer la configuration. Les candidats extraits restent **`pending_review`**.

Un lien direct fixe une édition ; lorsque l’institution publie une autre édition, ce lien peut devoir être ajouté au manifeste. La découverte par page de publications peut archiver de nouveaux fichiers, mais leur structure ne devient pas automatiquement un mapping économique fiable. Les changements de format demandent une revue des règles d’extraction.

## 4. Activer et contrôler la collecte quotidienne

1. Dans le dépôt GitHub, ouvrir **Actions** et autoriser les workflows si GitHub le demande. Le workflow **Collect official source documents**, fichier [.github/workflows/collect-data.yml](../.github/workflows/collect-data.yml), doit être présent sur la branche par défaut `main`. Tant qu’il n’est pas fusionné sur la branche par défaut, le calendrier quotidien ne démarre pas et le déclenchement manuel depuis l’interface peut ne pas être proposé.
2. Ouvrir ce workflow → **Run workflow** → choisir **`main`** → **Run workflow**.
3. Ouvrir l’exécution. Le workflow installe les parseurs épinglés, exécute leurs tests, puis collecte les documents. Une exécution échouée peut quand même produire un rapport exploitable ; ouvrir le journal de l’étape concernée.
4. Dans **Artifacts**, télécharger **`official-source-collection-<identifiant>`**. Il contient **`report.json`** — sources, URL, erreurs, statut —, **`raw/`** — fichiers et provenance — et, si un mapping a pu être appliqué, **`review/`** — candidats à contrôler. Les artefacts expirent après **14 jours** ; archiver les originaux nécessaires dans le back-office avant cette échéance.
5. Comparer les candidats au document officiel, puis ajouter le document et les observations dans `/admin` selon la procédure ci-dessus. **Aucun transport automatique de ces artefacts vers Supabase n’est encore branché.** Ce workflow n’a pas de secret Supabase et n’écrit pas dans la base.

L’exécution planifiée est **chaque jour à 06:17 UTC**. GitHub peut retarder le calendrier ; consulter l’historique des exécutions. Le manifeste initial identifie les neuf institutions, mais n’a pas encore de liens documentaires précis ni de mappings validés. Une page accessible sans document téléchargé est signalée comme une collecte incomplète ; elle ne donne aucun chiffre au site.

Priorités pour obtenir les premiers mappings : **MEF — dette du Trésor et intérêts ; TGR — bulletin mensuel recettes/dépenses/solde ; HCP — population et PIB nominal**. Pour chaque original, conserver le lien direct, le titre, la date de publication, les pages ou tableaux, les unités, l’échelle et le périmètre. Les règles pourront ensuite réutiliser les publications de même structure tout en conservant une approbation humaine.

## 5. Vérifier le déploiement

- Ouvrir `/`, `/historique` et `/simulateur` sur ordinateur et téléphone ; vérifier le thème, l’arabe RTL, le calcul et les exports.
- Vérifier que `/sources` et `/methodologie` expliquent l’origine des données et les limites, et que les compteurs vides restent **« Données en cours d’intégration »**.
- Ouvrir `/admin` avec le compte habilité, puis avec un utilisateur sans profil actif : seul le premier doit accéder aux brouillons et aux opérations.
- Après l’approbation d’une observation, rafraîchir sa page publique et vérifier valeur, échelle, date, périmètre et référence documentaire.
- Ouvrir `/sitemap.xml` et `/robots.txt`, puis vérifier que les URL absolues utilisent la valeur réelle de `NEXT_PUBLIC_SITE_URL`.
- Exécuter une collecte manuelle et lire `report.json` pour vérifier les fichiers réellement obtenus, pas seulement le statut global du workflow.

## Résoudre les problèmes courants

| Symptôme | Vérification à effectuer |
| --- | --- |
| Build « package.json introuvable » | Choisir la branche contenant le code et la racine `.` ; si `main` est encore vide, utiliser temporairement `feat/maroc-en-chiffres-v1`. |
| « Connexion administrateur à configurer » | Renseigner la clé publique dans Hostinger et reconstruire/redéployer ; vérifier que l’URL et la référence ciblent le même projet. |
| Connexion réussie, accès administrateur refusé | Vérifier l’UUID Auth, le rôle et `active = true` dans `maroc_en_chiffres.admin_users`. |
| Référentiel vide ou lecture Supabase impossible | Vérifier l’application des migrations et l’ajout de `maroc_en_chiffres` aux schémas exposés, sans retirer les schémas existants. |
| Document impossible à soumettre | Approuver d’abord l’institution et sa source ; vérifier domaine HTTPS, format, taille et date de publication. |
| Import documentaire répond 413 | Vérifier la taille du fichier et les limites de requête de l’offre Hostinger ; un réglage dans le formulaire ne peut pas augmenter la limite du proxy. |
| Observation impossible à approuver | Contrôler les parents approuvés, la validité de la définition, l’unité, l’échelle, le périmètre et les dates ; ne pas retirer les contraintes SQL. |
| Collecte ne trouve aucun document | Renseigner une page de publications ou un lien direct vérifié ; consulter les URL et erreurs de `report.json`. |
| Le document est téléchargé, mais aucun chiffre ne change | Ajouter un mapping contrôlé pour extraire, puis importer et approuver les candidats dans `/admin`. |


## Alternative facultative : Vercel

Si vous choisissez ultérieurement Vercel, importer le même dépôt avec la racine `.`, le framework Next.js, Node 24.x, `npm ci --include=dev` et `npm run build`, puis renseigner les mêmes variables avant le build. Conserver la sortie automatique Next.js et la branche de production `main`. Le runtime serveur est requis, sans export statique. Après toute modification d’une variable `NEXT_PUBLIC_*`, redéployer.

La route documentaire actuelle passe par une Function : sur Vercel, limiter les imports à **4 Mo** pour rester sous sa limite de requête de 4,5 Mo. Les rapports plus volumineux demandent un upload direct Supabase avec validation serveur ou un hébergement dont la limite convient. Voir les documentations [Next.js sur Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) et [limites des Functions](https://vercel.com/docs/functions/limitations).
