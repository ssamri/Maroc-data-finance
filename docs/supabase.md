# Supabase : schéma isolé et administration

Le projet cible autorisé est désormais **lodgicore**. L’application utilise exclusivement le nouveau schéma `maroc_en_chiffres` et le nouveau bucket privé `maroc-en-chiffres-documents`. Les migrations ne modifient aucune table, donnée, fonction ou policy existante de `public`, ni aucun bucket préexistant. Le projet `Otels.ma` reste hors périmètre.

**Aucune migration distante n’a été exécutée.** Le projet autorisé est `vxuvjdskfmotauypkmav`, URL `https://vxuvjdskfmotauypkmav.supabase.co`. Le 16 octobre 2026, le domaine du projet et l’API de gestion répondent **401 Unauthorized** : le réseau fonctionne, mais aucune authentification de migration n’est fournie. Aucun outil MCP Supabase n’est exposé à cette session et aucune variable `SUPABASE_ACCESS_TOKEN` ou `SUPABASE_DB_URL` n’est présente. La clé publique de l’application est également absente. Les refus proxy 403 constatés le 14 octobre décrivent l’état initial, pas le blocage actuel. Ce travail prépare le SQL, le contrôle des droits et leur validation PostgreSQL locale ; il ne constitue pas une validation de Supabase Auth, Storage ou PostgREST sur le projet distant.

L’utilisateur a autorisé l’application directe des migrations à **lodgicore**. Il manque un moyen d’authentification, pas une nouvelle confirmation : rendre le MCP Supabase disponible dans la session Codex, ou fournir `SUPABASE_ACCESS_TOKEN` via les secrets sécurisés de l’environnement. Une clé publique anon/publishable permet de faire fonctionner le site sous RLS mais ne permet pas d’exécuter du SQL d’administration. Aucun secret ne doit être transmis dans le chat ou ajouté à Git.

## Vérifier le projet avant toute exécution

1. Ouvrir le Dashboard Supabase et vérifier explicitement que le projet sélectionné est `lodgicore`. Copier sa référence depuis les paramètres du projet ; un nom seul ne permet pas d’identifier une base.
2. Comparer cette référence au sous-domaine de `NEXT_PUBLIC_SUPABASE_URL` et à l’hôte de la connexion PostgreSQL. Le serveur refuse un hôte ne correspondant pas à `SUPABASE_PROJECT_REF`.
3. Inventorier les schémas, migrations, buckets et policies Storage existants. Les noms `maroc_en_chiffres`, `maroc-en-chiffres-documents` et les policies `finance_documents_*` doivent être disponibles. En cas de collision, arrêter et examiner l’objet existant : ne pas le supprimer, le renommer ou reprendre aveuglément son contenu.
4. Conserver une sauvegarde et une copie du schéma existant. Relire le diff SQL. Ne pas exécuter un reset, un `db pull` suivi d’un remplacement des fichiers, un `migration repair`, ou un déploiement d’un autre projet.

Les fichiers sont ordonnés : `202610140001_finance_schema.sql`, `202610140002_security_and_review.sql`, `202610140003_private_storage.sql`, `202610140004_draft_registry.sql`. Chaque fichier utilise une transaction. Le premier `CREATE SCHEMA` échoue si le schéma existe déjà ; il ne fusionne pas avec des objets inconnus. Aucun seed financier ni faux approbateur n’est injecté.

Le quatrième fichier fournit un répertoire **draft** : 9 institutions, 9 sources documentaires, 14 indicateurs et 14 définitions de travail. Leurs adresses institutionnelles correspondent au catalogue local ; les documents n’ont pas été récupérés (proxy 403), et aucun chiffre n’a été approuvé. Les définitions proposées doivent être corrigées d’après les documents avant validation, notamment fréquence, base comptable, échelle et date de validité. Le `valid_from` initial est la date administrative de création de la définition dans le projet, pas une date officielle d’une série économique. Le SQL bloque l’approbation d’une définition dont la base indique encore « À préciser » ou reste vide. Le back-office permet de corriger la définition avant examen.

Le CLI officiel consulté est `supabase@2.120.0`. Après avoir rapproché l’historique distant des migrations de ce dépôt, un opérateur peut lister puis appliquer les migrations à la connexion **vérifiée** :

```bash
# SUPABASE_DB_URL est fourni par les paramètres sécurisés, jamais par Git.
# Conserver sslmode=verify-full et le certificat CA officiel du projet.
npm exec --package=supabase@2.120.0 -- supabase migration list --db-url "$SUPABASE_DB_URL"
npm exec --package=supabase@2.120.0 -- supabase db push --db-url "$SUPABASE_DB_URL" --dry-run
# Après vérification du résultat et de la cible :
npm exec --package=supabase@2.120.0 -- supabase db push --db-url "$SUPABASE_DB_URL"
```

Ne pas désactiver la vérification TLS pour résoudre une erreur de certificat. Récupérer le CA officiel depuis les paramètres du projet et configurer `PGSSLROOTCERT` / la chaîne de connexion suivant les instructions Supabase. Ne jamais imprimer les valeurs des variables, les jetons ou la chaîne de connexion.

Dans **Data API → Exposed schemas**, **ajouter** `maroc_en_chiffres` à la liste actuelle. Conserver tous les schémas déjà exposés et ne pas modifier la configuration des autres applications. Les clients du dépôt ciblent ce schéma avec `db.schema`, sans utiliser `public`. Vérifier ensuite une lecture via PostgREST avec la clé publique, puis un utilisateur autorisé.

## Variables et démarrage

Copier `.env.example` vers `.env.local` (ignoré par Git), ou utiliser les secrets de l’environnement cloud. Les variables nécessaires sont :

| Variable | Utilisation |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Référence du projet `lodgicore` vérifiée par l’opérateur. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS `https://<référence>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique ; accès soumis à RLS. |
| `SUPABASE_DB_URL` | Facultative au runtime, réservée à l’opérateur des migrations. |

Sans ces variables, l’application publique peut afficher les observations locales documentées ; le back-office affiche son état non connecté et les endpoints d’administration refusent les opérations. Les valeurs du dataset local ne sont pas automatiquement importées dans Supabase.

## Créer le premier administrateur

Utiliser un utilisateur Auth explicitement choisi pour cette application. Dans un projet partagé, **ne pas modifier les réglages globaux d’Auth**, les utilisateurs existants, leurs mots de passe ou leurs sessions pour configurer cette application. Créer/inviter ce compte depuis le Dashboard selon la politique déjà appliquée au projet. Récupérer son UUID, puis l’opérateur SQL ajoute uniquement son profil dans notre schéma :

```sql
insert into maroc_en_chiffres.admin_users(user_id, display_name, role, active)
values ('UUID_DU_COMPTE_AUTH_VERIFIE', 'Administrateur Maroc en chiffres', 'admin', true);
```

`UUID_DU_COMPTE_AUTH_VERIFIE` est un placeholder à remplacer par un utilisateur réel ; ce SQL n’est pas un seed à exécuter tel quel. Aucun utilisateur connecté, même administrateur applicatif, ne peut créer ou modifier son rôle, son activation ou le profil d’un autre membre. Cette gestion reste réservée à l’opérateur ou à une future route serveur authentifiée.

| Rôle actif | Accès |
| --- | --- |
| `reader` | Lire les brouillons, les originaux privés et les journaux. |
| `editor` | Ajouter les références, documents et observations, créer une révision. |
| `reviewer` | Droits éditeur et décisions d’approbation/rejet. |
| `admin` | Droits reviewer ; aucune gestion globale d’Auth dans cette application partagée. |

La connexion utilise Supabase Auth. Chaque route reçoit `Authorization: Bearer <access_token>`. `requireAdmin()` appelle `auth.getUser(token)` sur le serveur, puis vérifie le profil actif par la session de cet utilisateur. Le client retourné conserve son jeton : RLS reste appliqué et `auth.uid()` attribue les écritures dans l’audit. Il n’y a pas de bypass service-role pour les opérations financières.

## Provenance, approbation et révisions

1. Créer puis faire approuver une institution, une source de données, un indicateur et sa définition. Une source déclarée API exige une date de vérification réelle ; aucune API n’est supposée existante.
2. Importer un document privé sous `<UUID_UTILISATEUR>/<UUID_DOCUMENT>.<extension>`, conserver le SHA-256 et l’URL officielle HTTPS. Le fichier est limité à 25 Mio et aux formats déclarés. L’original ne peut être écrasé ; un import échoué peut nettoyer son propre fichier encore sans référence documentaire.
3. Vérifier le document et l’approuver avec un compte reviewer/admin. L’accès à un original approuvé reste privé ; le public consulte l’URL officielle ou un endpoint autorisé fournissant une URL signée de courte durée.
4. Ajouter une observation `pending` avec valeur décimale exacte, échelle, unité, périmètre, période, date de publication, institution, document et repère documentaire. Un producteur doit correspondre à l’institution du document ; unité, échelle et périmètre correspondent à la définition versionnée par une clé étrangère composée. La date de publication est postérieure à la période observée. L’approbation exige une URL et une date identiques à celles du document, une définition valide sur toute la période, une valeur positive pour PIB/population et les conventions de signe déclarées pour les autres indicateurs.
5. Appeler `review_observation` pour approuver ou rejeter. Un rejet exige un motif. `review_source_document` et `review_registry` appliquent le même contrôle. Le déclencheur SQL exige que les parents soient approuvés ; le contrôle de l’interface n’est pas la barrière de sécurité.
6. Pour corriger un chiffre, ajouter une nouvelle observation avec `previous_observation_id` et `version = version_précédente + 1`, dans la même série/période. Le contenu d’une observation reste immuable, y compris avant approbation. La vue publique choisit la dernière version approuvée ; une révision encore en attente ne remplace pas la précédente.

Les données d’un producteur, y compris ses estimations officielles, restent dans `observations`. Les prévisions institutionnelles sont dans `forecasts` et les sorties calculées dans `projections`, avec leurs hypothèses, ancrage, méthode et horizon maximal. Leur statut économique ne peut pas être confondu avec une mesure officielle en direct.

PostgreSQL conserve les valeurs avec `numeric(38,12)` et les taux avec `numeric(38,18)`. Le RPC `export_approved_observations` exporte les dernières observations approuvées avec la définition, le producteur et le repère documentaire ; il est SECURITY INVOKER. Les lectures publiques utilisent `approved_observations.value_exact` et `scale_exact`, convertis en texte **dans PostgreSQL** avant la sérialisation JSON. `approved_forecasts` et `approved_projections` exposent de la même façon leurs montants, bornes et taux. Dans le back-office, demander également `value_exact:value::text`. Ne pas reconstituer un montant exact depuis un `number` JavaScript ; les colonnes numériques brutes peuvent être arrondies par le client.

La révocation d’un parent masque également les documents et chiffres dépendants pour les utilisateurs publics. Le contenu de toute entité ayant déjà été approuvée reste immuable, même après révocation : créer une nouvelle version. L’attribution historique ne peut être effacée, et seul un reviewer peut changer un motif de revue. Les journaux d’audit et de révision sont générés atomiquement et ne sont ni modifiables ni supprimables par les utilisateurs applicatifs. Les logs ne doivent jamais recevoir de mots de passe, clés, jetons ou en-têtes d’authentification.

## Isolation du Storage partagé

Les nouvelles policies permissives autorisent uniquement nos utilisateurs actifs pour le nouveau bucket. Des policies **restrictives**, dont la condition est toujours vraie pour tous les autres buckets, empêchent une ancienne policy globale permissive d’exposer nos originaux ou de permettre un déplacement vers/depuis notre bucket. Elles conservent le comportement des buckets existants. Aucune clé ni client service-role n’est utilisé par l’application. Le rôle PostgreSQL service_role existant reçoit seulement les droits nécessaires sur nos nouveaux objets ; il reste une capacité privilégiée de la plateforme.

L’exposition via Realtime n’est pas activée par les migrations. Ne pas ajouter ces tables à une publication ou activer des fonctions privilégiées sans vérifier les effets sur les brouillons, les documents privés et la charge. Les index de séries et de provenance couvrent les lectures usuelles ; ne pas faire de requête à chaque tick de l’horloge.

## Validation locale reproductible

Le Docker de test est sans réseau. `supabase/tests/local-bootstrap.sql` crée des stubs locaux `auth` et `storage` ; **ne jamais l’exécuter dans Supabase**, où ces schémas existent et sont gérés par la plateforme. Le test SQL utilise de vraies sessions `SET ROLE anon/authenticated` : les vérifications ne reposent pas sur le propriétaire PostgreSQL qui contourne RLS.

```bash
bash supabase/tests/run-local.sh
```

Le runner utilise une image PostgreSQL 17 épinglée par son digest, attend une disponibilité de trente secondes au maximum, puis supprime uniquement son conteneur de test à la sortie. Aucun port n’est publié et le réseau du conteneur est désactivé. Les fixtures synthétiques sont rollbackées et ne sont pas des chiffres économiques. **Les quatre migrations, 78 assertions et 74 refus attendus passent sous PostgreSQL 17 local.** Les checks couvrent la précision décimale, le rejet des NaN, la chronologie et la provenance, les brouillons et agrégats publics, les comptes désactivés, les lecteurs/éditeurs/reviewers, l’interdiction d’auto-promotion, les révisions, l’audit, le bucket privé et la préservation des accès aux anciennes tables/buckets et à leurs policies et droits.

Une fois le projet distant accessible, compléter ces tests par : sign-in/sign-out réel, utilisateur non autorisé, accès PostgREST au schéma exposé, téléversement autorisé, URL signée expirée, absence d’accès public au bucket et comparaison du schéma/policies/buckets préexistants avant/après. Régénérer les types avec le CLI officiel en ciblant uniquement `--schema maroc_en_chiffres`, puis conserver le type des valeurs exactes et les contrôles de compilation.

Références officielles : [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [schémas personnalisés](https://supabase.com/docs/guides/api/using-custom-schemas), [auth.getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [Storage et accès](https://supabase.com/docs/guides/storage/security/access-control), [migrations](https://supabase.com/docs/guides/deployment/database-migrations).
