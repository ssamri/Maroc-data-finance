# Collecte documentaire automatique

Le workflow [collect-data.yml](../.github/workflows/collect-data.yml) est prêt pour une exécution quotidienne à **06:17 UTC** et un déclenchement manuel depuis GitHub Actions. GitHub active le calendrier lorsque ce fichier est présent sur la branche par défaut d'un dépôt avec Actions autorisé; les exécutions planifiées peuvent être retardées par GitHub. Ce travail n'a pas publié le workflow ni déclenché une exécution distante.

La collecte archive les documents et prépare, lorsque des règles d'extraction explicites existent, des candidats à contrôler. Elle ne modifie pas le jeu public, n'approuve aucun chiffre, ne pousse aucun commit et ne contacte aucun projet Supabase. Le workflow n'a que la permission `contents: read`; les identifiants du checkout ne persistent pas. Les actions sont épinglées sur des SHA immuables, obtenus par une lecture des tags dans leurs dépôts officiels.

## Fonctionnement et limites

Le [manifeste de collecte](../data/collection-manifest.json) contient les neuf institutions et leurs adresses d'accueil. Il ne contient actuellement aucune URL documentaire inventée ni aucun mapping d'extraction présumé. Le collecteur lit les pages HTML configurées, suit au maximum un niveau de liens internes pertinents, puis télécharge des PDF, CSV UTF-8 ou XLSX. Le choix est borné par des mots-clés configurés et des limites de pages et de documents; l'ordre des liens ne prouve jamais qu'un document est le plus récent. Les liens chargés exclusivement par JavaScript et les portails nécessitant une connexion demandent une configuration spécifique après vérification.

Chaque destination et chaque redirection doivent utiliser HTTPS, le port 443 et un hôte expressément autorisé pour la même institution. Une redirection hors de cette liste, une URL authentifiée ou une rétrogradation HTTP sont refusées. TLS reste vérifié. Les téléchargements sont bornés à 32 Mio, les pages à 2 Mio, les délais à 15 secondes par opération réseau et les redirections à cinq; le manifeste fixe aussi le nombre de pages, documents et travailleurs. Aucun cookie, identifiant de site ou header d'authentification n'est ajouté.

Chaque archive conserve sa source, ses URL initiale/finale, sa date de récupération UTC, le statut HTTP, une sélection de headers documentaires (`Content-Type`, `Content-Length`, `Last-Modified`, `ETag`, `Date`), sa taille et son empreinte SHA-256. La date de récupération, le header `Last-Modified` et le nom de fichier ne sont pas assimilés à une date de publication. L'authenticité, la fraîcheur et les chiffres restent à vérifier. Les rapports conservent aussi les URL découvertes et les erreurs de chaque destination.

Les artefacts GitHub comprennent `raw/`, `review/` et `report.json`; ils sont conservés **14 jours**, y compris lorsque la collecte échoue. Un archivage durable se fait ensuite dans le stockage documentaire prévu pour le back-office. Aucune clé Supabase n'est requise pour cette collecte; ce script ne fait pas d'import automatique dans Supabase et ne demande pas de secret dans le chat.

## Exécution et état réellement testé

```bash
python3 scripts/collect_sources.py \
  --manifest data/collection-manifest.json \
  --output-dir .local/collection/run-unique \
  --extract
```

Le dossier de sortie doit être nouveau: une exécution précédente n'est jamais écrasée. Le collecteur utilise uniquement la bibliothèque standard Python; installer les versions épinglées de [requirements-ingestion.txt](../data/requirements-ingestion.txt) pour les extractions PDF/XLSX.

| Code | Résultat |
| --- | --- |
| 0 | Au moins un document archivé; le rapport signale les éventuelles sources en échec avec `partial_collection` |
| 1 | Configuration ou entrée locale invalide |
| 2 | Toutes les sources sont inaccessibles |
| 3 | Des pages répondent, mais aucun document utilisable n'a été archivé |
| 4 | Une extraction explicitement configurée a échoué; les archives restent conservées |

La seule accessibilité d'une page d'accueil n'est donc pas annoncée comme une collecte réussie. Le 14 octobre 2026, le test réseau réel depuis ce cloud a produit le code **2**, `all_sources_unavailable`: les neuf connexions HTTPS ont été refusées par le proxy avec `Tunnel connection failed: 403 Forbidden`. Aucun document officiel et aucun chiffre n'ont été collectés. Le rapport local est `.local/collection-validation-20261014/report.json`. Le fonctionnement réseau sur les runners GitHub reste à vérifier lors de la première exécution publiée.

## Documents à fournir ou à référencer en priorité

Pour rendre la collecte financière ciblée, fournir les fichiers officiels ou leurs **liens HTTPS exacts**, accompagnés du titre, de la date de publication, de la page/table, de l'unité et du périmètre. Ces informations permettront de contrôler et de figer les premiers mappings plutôt que de déduire des chiffres de titres ou de résumés.

1. **MEF:** rapport annuel sur la dette publique le plus récent accessible, notamment le rapport accompagnant le PLF 2026 lorsqu'il est disponible; préciser les pages du stock de dette du Trésor, de sa répartition intérieure/extérieure, de la variation du stock, des intérêts et du service de dette.
2. **TGR:** bulletin mensuel de statistiques des finances publiques le plus récent accessible; préciser le mois de référence, les recettes, dépenses et solde budgétaire, avec leurs classifications et conventions de signe.
3. **HCP:** publication du RGPH 2024 pour la population de référence, toute projection démographique ultérieure explicitement qualifiée et les publications de PIB nominal des périodes correspondantes. Une population de recensement et une projection ne constituent pas le même statut de donnée.

Ces documents sont des priorités de recherche; aucune disponibilité, édition récente ni valeur n'est attestée à ce stade. Un PDF scanné peut être archivé, mais son extraction exige un OCR contrôlé séparément. Les instructions détaillées de validation et d'extraction figurent dans [sources.md](sources.md).

## Ajouter un document et son mapping

Dans l'entrée de l'institution, ajouter un objet à `documents` avec `url` exact et `format` (`pdf`, `csv` ou `xlsx`). Pour extraire automatiquement après téléchargement, ajouter `extractionManifest`: chemin relatif vers un fichier JSON situé dans le dossier du manifeste, par exemple `extraction/report-reviewed.json`. Le fichier doit exister. Les URL de ce mapping doivent citer le même document et la même institution. Sa date de publication et les métadonnées économiques proviennent du document contrôlé, jamais du collecteur.

Le schéma du mapping est celui de [ingest.py](../scripts/ingest.py): métadonnées `document`, colonnes explicites pour CSV/XLSX, nom de feuille pour XLSX, ou pages physiques et expressions régulières avec capture nommée `value` pour PDF. `expectedSha256` peut verrouiller une édition vérifiée. Si le contenu change, l'empreinte différente doit être revue: aucun checksum attendu n'est réécrit automatiquement. L'option `--extract` invoque le pipeline existant sans shell, avec un délai de 60 secondes. Ses sorties restent `pending_review` et `authenticityVerified: false`.

L'ajout d'un mapping n'ajoute pas une observation au site. L'administrateur contrôle et approuve les candidats dans le circuit prévu. Les observations officielles, les interpolations et les simulations gardent leurs statuts distincts.

## Vérification hors réseau

```bash
python3 -m unittest discover -s scripts -p 'test_collect_sources.py' -v
python3 -m unittest discover -s scripts -p 'test_*.py' -v
```

Les 14 tests du collecteur utilisent des fixtures synthétiques. Ils vérifient la profondeur, les bornes, les signatures documentaires, les destinations et redirections, TLS, les refus proxy, les réponses tronquées ou excessivement lentes, les checksums, la provenance, le non-écrasement et l'intégration avec une extraction qui reste en attente de revue.

La CLI accepte aussi `--offline-fixtures /tmp/fixtures.json`: ce mode remplace entièrement les accès réseau. Le JSON a une clé `responses`, associant chaque URL configurée à `status`, `headers` et exactement un champ `bodyText` ou `bodyFile`; les fichiers doivent rester sous le dossier des fixtures. Une URL sans fixture est une erreur locale et ne déclenche jamais une requête réelle. Les archives et rapports portent `offline_fixture` et `offlineFixtures: true`; ils n'établissent aucun fait officiel.
