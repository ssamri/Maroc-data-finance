# Données officielles et import documentaire

La plateforme publie des observations approuvées et documentées. Les estimations de l’horloge et les simulations restent dans des résultats de calcul distincts. Une adresse institutionnelle dans le catalogue ne signifie pas qu’une publication a été téléchargée ou qu’un chiffre a été vérifié.

## État réel de cette livraison

Le 14 octobre 2026, les requêtes HTTPS en lecture seule vers les neuf institutions demandées ont été refusées par le proxy réseau de l’environnement : `CONNECT 403`, serveur `envoy`, code de sortie `curl` 56. La vérification TLS est restée activée. Aucun PDF, CSV ou XLSX officiel n’a été obtenu ; aucune observation financière n’est donc publiée. Le fichier [source-access.json](../data/source-access.json) conserve les destinations, la méthode et le résultat. Il ne s’agit pas d’un diagnostic d’indisponibilité des sites eux-mêmes.

Le jeu initial [observations.json](../data/observations.json) vaut `[]`. L’interface doit afficher un état d’attente et ne doit pas remplacer une absence de données par zéro, une valeur de démonstration ou une projection prétendument officielle. Aucune affirmation n’est faite sur les chiffres les plus récents ni sur l’existence de publications précises. Le PLF 2026 et les rapports annuels ci-dessous constituent des documents à rechercher dès que l’accès est disponible.

| Institution | Adresse officielle de référence | Documents à rechercher et vérifier |
| --- | --- | --- |
| Ministère de l’Économie et des Finances | https://www.finances.gov.ma | Rapport sur la dette publique ; PLF 2026 ; rapports accompagnant le PLF |
| Trésorerie Générale du Royaume | https://www.tgr.gov.ma | Bulletins mensuels de statistiques des finances publiques |
| Bank Al-Maghrib | https://www.bkam.ma | Rapports annuels ; séries monétaires et macroéconomiques |
| Haut-Commissariat au Plan | https://www.hcp.ma | Comptes nationaux ; PIB nominal ; recensement et population |
| Office des Changes | https://www.oc.gov.ma | Balance des paiements et position extérieure |
| Cour des comptes | https://www.courdescomptes.ma | Rapports annuels ; exécution des lois de finances |
| Portail Open Data | https://data.gov.ma | Jeux de données avec producteur, date, unité et métadonnées identifiables |
| Fonds monétaire international | https://www.imf.org | Rapports Article IV ; séries et définitions pour comparaisons harmonisées |
| Banque mondiale | https://www.worldbank.org | Séries par pays et définitions d’indicateurs |

Un point d’entrée de la Banque mondiale a également été essayé sans obtenir de réponse de l’API. Cette API n’est pas intégrée. Son indicateur de dette de l’administration centrale ne peut pas être assimilé automatiquement à la dette du Trésor ni à celle des administrations publiques consolidées.

La collecte planifiée en lecture seule, ses manifestes et sa file de revue sont décrits dans [automation.md](automation.md). Elle n’invente pas de chemin documentaire et n’approuve aucun chiffre.

## Catalogue et frontière de publication

Le module `src/lib/data` exporte les institutions, les définitions trilingues des indicateurs et les observations approuvées. `getDashboardData()` renvoie les observations dans leur dernière révision, les institutions, les années disponibles, le dernier encours du Trésor ou `null`, et les observations les plus récentes par indicateur. `getObservations()` accepte un indicateur, un périmètre et une plage d’années et conserve les révisions présentes dans le jeu statique pour l’audit.

`latestApprovedRevisions()` fournit une vue de présentation sans supprimer les enregistrements d’origine. Les versions ne se remplacent qu’au sein de la même série comparable et de la même période. `getComparableSeriesKey()` distingue unité/échelle, producteur, périmètre, identifiant/version de définition, base comptable et fréquence : deux définitions approuvées peuvent avoir la même date sans constituer un doublon ni être réunies dans une courbe unique. Le tableau de bord choisit à date égale la publication la plus récente, puis la version de définition, et expose `comparabilityWarnings` lorsque plusieurs séries incompatibles restent disponibles à la date sélectionnée. La vue publique Supabase garde la dernière révision par définition et période ; l’historique complet demeure dans les tables de révision du back-office.

Chaque observation conserve : indicateur, `exactValue` décimal, `value` de présentation, unité, échelle, périmètre, période, date de référence, date de publication, institution, titre du document, URL officielle HTTPS, page ou localisation exacte, statut observé/provisoire, validation et version. `exactValue` conserve la décimale canonique sans séparateur de milliers ; `value` sert à l’affichage et n’est pas la représentation d’archive du chiffre.

La validation Zod à l’import du module refuse les candidats non approuvés, les estimations et prévisions, les doublons, les dates impossibles, les unités/périmètres incompatibles, les valeurs incohérentes et les URL hors du domaine institutionnel. Un domaine officiel ne suffit pas à établir l’authenticité du contenu : cette dernière nécessite la consultation et le contrôle du document.

Les pages publiques peuvent charger les observations à l’aide de `loadDashboardData()` dans `src/lib/data/server.ts`. Le module est réservé au serveur et utilise uniquement la clé publique Supabase : le RPC `export_approved_observations` joint une institution, une source, un document et une définition approuvés, sous RLS, et exporte les décimales PostgreSQL sous forme de texte. Une approbation du back-office apparaît dans les lectures suivantes des pages dynamiques ; le cache React du chargeur ne dure que le rendu courant. Les définitions, empreintes, dates de récupération et périodes originales restent dans `provenance`.

Le chargeur renvoie un statut explicite : `snapshot` si la connexion publique vérifiée n’est pas configurée ; `connected` lorsque la lecture complète du jeu approuvé réussit ; `unavailable` si une lecture, la validation ou une pagination échoue. Une base connectée sans observation conserve les valeurs absentes. En cas d’échec, le jeu local approuvé et une note sur la connexion sont renvoyés, sans masquer l’incertitude de fraîcheur. Aucune erreur interne, clé de service ni session administrateur n’est incluse dans la réponse publique. La pagination contrôle le nombre total exact plutôt que de supposer que la limite de lignes du serveur est celle demandée ; la lecture est bornée dans le temps.

Les indicateurs du Trésor conservent le périmètre `treasury`. La dette consolidée des administrations publiques utilise un indicateur et le périmètre `general_government` distincts. Le déficit conserve sa convention de signe documentée ; il n’est pas utilisé comme variation du stock de dette. Les agrégats budgétaires précisent leur classification. Un ratio dette/PIB demande la même période et un PIB nominal comparable ; la dette par habitant demande une population de référence documentée. Le service de la dette et la charge d’intérêts restent distincts.

## Pipeline local de revue

Le script [ingest.py](../scripts/ingest.py) lit un document fourni localement et un manifeste JSON explicite. Il produit un dossier d’import avec statut `pending_review`, une empreinte SHA-256, les localisations et les candidats. Il n’écrit jamais dans le jeu public, ne télécharge pas de fichiers, n’invente pas de source et n’approuve aucune observation. Un import JSON n’est pas automatiquement appliqué à Supabase : les candidats sont destinés au circuit de contrôle du back-office.

Le CSV utilise la bibliothèque standard Python. Pour PDF et XLSX, les versions testées sont épinglées dans [requirements-ingestion.txt](../data/requirements-ingestion.txt).

```bash
python3 -m venv /workspace/mec-ingestion-venv
/workspace/mec-ingestion-venv/bin/pip install -r data/requirements-ingestion.txt
```

Les fichiers d’entrée sont limités à 32 Mio et 50 000 observations. Les XLSX décompressés sont limités à 100 Mio. Les formules XLSX sont refusées : fournir les chiffres publiés, pas des formules locales dont la valeur en cache serait ambiguë. Les fichiers scannés sans couche de texte sont refusés en attendant un OCR et une vérification manuelle.

### CSV et XLSX

Copier [manifest.template.json](../data/manifest.template.json) hors du dépôt, puis remplacer chaque champ avec les informations du document réel : institution, URL exacte du document, titre et date de publication. Le manifeste accepte `expectedSha256` pour vérifier une empreinte attendue, `delimiter` pour le CSV et le nom `sheet` obligatoire pour le XLSX.

[observations.template.csv](../data/observations.template.csv) fournit uniquement les en-têtes. Chaque ligne doit indiquer explicitement `indicatorId`, `exactValue`, `unit`, `scale`, `scope`, `period`, `referenceDate` et `status`. Aucune unité ou aucun périmètre n’est déduit. `documentPage` et `documentLocator` permettent de citer précisément le document ; à défaut de localisation textuelle, le script enregistre la ligne CSV ou la feuille/ligne XLSX.

Les valeurs décimales acceptent un point ou une virgule décimale et les espaces de groupement français. Les combinaisons ambiguës de points et virgules sont refusées. Les colonnes décimales doivent de préférence être des chaînes dans les feuilles de travail afin de préserver l’écriture publiée. Les chiffres de test du dossier `scripts` sont synthétiques et ne doivent jamais être ajoutés aux données publiques.

```bash
python3 scripts/ingest.py table /tmp/document.csv \
  --manifest /tmp/manifest.json --output /tmp/imports/job-unique.json

python3 scripts/ingest.py table /tmp/document.xlsx \
  --manifest /tmp/manifest.json --output /tmp/imports/job-xlsx-unique.json
```

Le script refuse d’écraser un fichier de sortie existant. Les documents, manifestes, sorties d’import et valeurs sensibles ne doivent pas être placés par défaut dans Git.

### PDF

Ajouter `entries` au manifeste. Chaque entrée précise tous les champs sémantiques de l’observation, une page PDF physique à partir de 1 et une expression régulière `pattern` avec la capture nommée `(?P<value>...)`. La capture doit produire exactement une correspondance sur cette page : zéro ou plusieurs correspondances font échouer l’import. Il est nécessaire de distinguer la page physique du PDF de la pagination imprimée, décrite dans `documentLocator`.

La structure d’une entrée est la suivante, avec des espaces réservés qui doivent être remplacés par les informations contrôlées du document réel :

```json
{
  "indicatorId": "debt_treasury",
  "unit": "MAD",
  "scale": 1000000,
  "scope": "treasury",
  "period": "REFERENCE_PERIOD_FROM_DOCUMENT",
  "referenceDate": "YYYY-MM-DD",
  "status": "observed",
  "documentPage": 1,
  "documentLocator": "EXACT_TABLE_ROW_AND_PRINTED_PAGE",
  "pattern": "EXACT_DOCUMENT_LABEL\\s+(?P<value>[0-9][0-9 \\u00a0\\u202f]*[,.][0-9]+)"
}
```

Les unités, échelles et pages de cet exemple illustrent le schéma ; ce ne sont pas des métadonnées attestées d’un rapport. L’extrait textuel entourant la capture est enregistré avec le candidat pour faciliter la revue.

```bash
python3 scripts/ingest.py pdf /tmp/document.pdf \
  --manifest /tmp/manifest-pdf.json --output /tmp/imports/job-pdf-unique.json
```

### Approbation et révisions

Avant toute publication, un administrateur doit vérifier l’origine du document sur le site officiel, son édition, sa date, chaque valeur, la page/table, le périmètre, l’échelle, les périodes, les révisions et les conventions de signe. Une extraction qui passe les validations reste un candidat. `authenticityVerified` vaut toujours `false` à la sortie du pipeline.

Le back-office stocke le document, le job et les candidats ; son approbation passe par l’autorisation administrateur et les règles RLS. Les fichiers candidats ne sont pas acceptés directement par le schéma des observations publiques. Pour un jeu statique relu, les métadonnées d’extraction doivent être archivées séparément et seules les observations explicitement approuvées peuvent être ajoutées à `data/observations.json`, sans leurs champs internes de revue. La version et l’historique doivent préserver toute correction d’une valeur déjà publiée.

## Vérification

```bash
python3 -m unittest discover -s scripts -p 'test_*.py' -v
npm test -- src/lib/data/validation.test.ts
```

Les tests vérifient notamment le CSV et les décimales, l’extraction PDF explicite, les feuilles XLSX, les formules interdites, la provenance, les empreintes, les dates, les doublons, les domaines institutionnels, les périmètres et la séparation des estimations. Les tests PDF/XLSX sont signalés comme ignorés si leurs dépendances optionnelles ne sont pas installées.
