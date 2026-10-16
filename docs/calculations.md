# Moteur financier

Le module indépendant `src/lib/finance` fonctionne dans Node.js et dans le navigateur. Ses entrées et sorties financières sont des chaînes décimales. Aucun montant n'est calculé avec un nombre flottant JavaScript. `decimal.js` utilise ici une précision interne de 80 chiffres significatifs; les entrées sont limitées à 60 chiffres significatifs. Les conversions d'échelle conservent les décimales; les résultats issus de divisions sont arrondis à 18 décimales à la sortie. L'affichage peut ensuite arrondir sans modifier la donnée source.

## Observations

`fixedObservation` conserve une observation officielle ou provisoire à sa date de référence. Le moteur ne certifie pas les sources: leur vérification et leur approbation appartiennent au pipeline d'ingestion. Une observation doit avoir un indicateur, une unité, une échelle, un périmètre et une date UTC explicites.

`interpolateObservations` exige le même **indicateur, la même unité, la même échelle et le même périmètre**, ainsi que des métadonnées `comparability` présentes et identiques : identifiant/version de définition, base comptable et fréquence. Une absence de définition comparable bloque le calcul. Il refuse les dates inversées, identiques ou hors de l'intervalle. Il applique `valeur_initiale + (valeur_finale − valeur_initiale) × temps_écoulé / durée_totale`. Le résultat porte toujours le statut `estimated`, jamais `official`.

## Horloge

`projectDebtStock` calcule `ancrage + variation_annuelle_du_stock × millisecondes_écoulées / millisecondes_de_l'année_de_référence`. Le millésime `rateReferenceYear` fixe un dénominateur de 365 ou 366 jours, y compris les exceptions séculaires. La variation peut être négative, mais le stock obtenu doit rester positif ou nul. Les changements d'échelle doivent être faits explicitement avant le calcul.

Chaque projection exige une date d'ancrage, un montant d'ancrage, une variation annuelle du **stock de dette**, une année de référence du taux, une méthode documentée et une échéance. Cette échéance est strictement après l'ancrage et au maximum 366 jours plus tard. Le moteur rejette toute date antérieure à l'ancrage ou postérieure à l'échéance; il ne prolonge jamais automatiquement un modèle expiré.

Le déficit n'est pas une identité de variation du stock: les opérations financières, décalages de trésorerie, valorisations et changements de périmètre peuvent créer des différences. Le moteur ne prend pas un déficit en entrée d'une projection de dette.

L'interface peut appeler la fonction toutes les secondes à partir de la même configuration déjà chargée. Aucune requête réseau par seconde n'est nécessaire. Si la validité expire, l'interface doit revenir à une observation datée ou afficher que l'estimation est expirée.

## Ratios et flux

`debtPerCapita` reçoit une dette en MAD et une population en personnes. `debtToGdpPercent` reçoit deux montants en MAD. Les dénominateurs doivent être strictement positifs. Les intérêts par jour et les flux par seconde sont des moyennes arithmétiques, et ne décrivent pas un versement continu effectif.

## Scénarios

`simulateDebtScenario` renvoie entre 1 et 30 années et impose une description des hypothèses. Chaque résultat porte `simulation`. Les montants initiaux et les flux sont exprimés en MAD, les taux en pourcentage. Le scénario conserve la population constante et applique la même hypothèse de flux et de taux chaque année.

Pour chaque année: stock final = stock d'ouverture + variation nette annuelle du stock; intérêts = stock d'ouverture × taux; PIB final = PIB d'ouverture × (1 + croissance / 100); service de dette = intérêts + remboursements de principal. La variation **nette** du stock intègre déjà les remboursements et autres opérations de financement. Le principal n'est donc pas soustrait une seconde fois. Les intérêts ne sont pas automatiquement capitalisés. Ce modèle explicite ne remplace pas une prévision macroéconomique officielle.

Les tests Vitest vérifient la précision au-delà de `Number.MAX_SAFE_INTEGER`, les conversions aller-retour, les frontières temporelles, les années bissextiles, les périmètres incompatibles, les divisions par zéro et la séparation entre intérêts, principal et variation nette du stock.
