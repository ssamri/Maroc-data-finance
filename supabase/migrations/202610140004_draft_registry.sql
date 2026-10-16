-- Metadata only, all DRAFT: these institutional homepages were not retrieved.
-- No economic value, source document or artificial approver is inserted.
begin;

insert into maroc_en_chiffres.institutions(code,name,website_url,country_code) values
  ('MEF', 'Ministère de l’Économie et des Finances', 'https://www.finances.gov.ma', 'MA'),
  ('TGR', 'Trésorerie Générale du Royaume', 'https://www.tgr.gov.ma', 'MA'),
  ('BAM', 'Bank Al-Maghrib', 'https://www.bkam.ma', 'MA'),
  ('HCP', 'Haut-Commissariat au Plan', 'https://www.hcp.ma', 'MA'),
  ('OC', 'Office des Changes', 'https://www.oc.gov.ma', 'MA'),
  ('COUR', 'Cour des comptes du Maroc', 'https://www.courdescomptes.ma', 'MA'),
  ('OPEN_DATA', 'Portail Open Data du Maroc', 'https://data.gov.ma', 'MA'),
  ('IMF', 'Fonds monétaire international', 'https://www.imf.org', 'US'),
  ('WORLD_BANK', 'Banque mondiale', 'https://www.worldbank.org', 'US');

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'MEF — publications documentaires', 'https://www.finances.gov.ma', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'MEF';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'TGR — publications documentaires', 'https://www.tgr.gov.ma', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'TGR';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'BAM — publications documentaires', 'https://www.bkam.ma', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'BAM';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'HCP — publications documentaires', 'https://www.hcp.ma', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'HCP';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'OC — publications documentaires', 'https://www.oc.gov.ma', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'OC';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'CDC — publications documentaires', 'https://www.courdescomptes.ma', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'COUR';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'Open Data — publications documentaires', 'https://data.gov.ma', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'OPEN_DATA';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'FMI — publications documentaires', 'https://www.imf.org', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'IMF';

insert into maroc_en_chiffres.data_sources(institution_id,name,source_url,access_method,notes)
select id, 'BM — publications documentaires', 'https://www.worldbank.org', 'document', 'Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé. Adresse de répertoire ; URL du document, date et méthode à vérifier avant approbation.'
from maroc_en_chiffres.institutions where code = 'WORLD_BANK';

insert into maroc_en_chiffres.indicators(code,name,name_translations,category,description) values
  ('debt_treasury', 'Dette du Trésor', '{"fr":"Dette du Trésor","ar":"دين الخزينة","en":"Treasury debt"}'::jsonb, 'debt', 'Encours de dette intérieure et extérieure du Trésor. Ce périmètre ne représente pas la dette consolidée de l’ensemble des administrations publiques.'),
  ('debt_general_government', 'Dette des administrations publiques', '{"fr":"Dette des administrations publiques","ar":"دين الإدارات العمومية","en":"General government debt"}'::jsonb, 'debt', 'Dette consolidée des administrations publiques selon le périmètre explicite du document source.'),
  ('debt_domestic', 'Dette intérieure du Trésor', '{"fr":"Dette intérieure du Trésor","ar":"الدين الداخلي للخزينة","en":"Domestic Treasury debt"}'::jsonb, 'debt', 'Composante intérieure de l’encours du Trésor selon la classification du MEF.'),
  ('debt_external', 'Dette extérieure du Trésor', '{"fr":"Dette extérieure du Trésor","ar":"الدين الخارجي للخزينة","en":"External Treasury debt"}'::jsonb, 'debt', 'Composante extérieure de la dette du Trésor, distincte de la dette extérieure publique totale.'),
  ('debt_gdp', 'Dette du Trésor / PIB', '{"fr":"Dette du Trésor / PIB","ar":"دين الخزينة / الناتج الداخلي الإجمالي","en":"Treasury debt / GDP"}'::jsonb, 'debt', 'Rapport de l’encours du Trésor au PIB nominal pour une même période de référence.'),
  ('debt_per_capita', 'Dette du Trésor par habitant', '{"fr":"Dette du Trésor par habitant","ar":"دين الخزينة للفرد","en":"Treasury debt per capita"}'::jsonb, 'debt', 'Division de l’encours du Trésor par une population résidente comparable. Il s’agit d’un ratio statistique, pas d’une dette individuelle.'),
  ('debt_stock_change', 'Variation du stock de dette', '{"fr":"Variation du stock de dette","ar":"تغير رصيد الدين","en":"Change in debt stock"}'::jsonb, 'debt', 'Différence entre deux encours comparables. La variation du stock n’est pas une identité comptable avec le déficit budgétaire.'),
  ('interest', 'Charge d’intérêts', '{"fr":"Charge d’intérêts","ar":"تكلفة الفوائد","en":"Interest expenditure"}'::jsonb, 'interest', 'Intérêts de la dette du Trésor sur la période. Les remboursements de principal sont distincts.'),
  ('deficit', 'Déficit budgétaire', '{"fr":"Déficit budgétaire","ar":"عجز الميزانية","en":"Budget deficit"}'::jsonb, 'deficit', 'Solde budgétaire selon la convention de signe et le traitement des opérations précisés dans la source.'),
  ('revenue', 'Recettes de l’État', '{"fr":"Recettes de l’État","ar":"إيرادات الدولة","en":"State revenue"}'::jsonb, 'budget', 'Recettes budgétaires selon le périmètre de la source, sans assimilation des emprunts à des recettes ordinaires.'),
  ('expenditure', 'Dépenses de l’État', '{"fr":"Dépenses de l’État","ar":"نفقات الدولة","en":"State expenditure"}'::jsonb, 'budget', 'Dépenses budgétaires selon la nomenclature et le périmètre indiqués dans le document source.'),
  ('debt_service', 'Service de la dette', '{"fr":"Service de la dette","ar":"خدمة الدين","en":"Debt service"}'::jsonb, 'interest', 'Remboursements de principal et intérêts sur la période, en indiquant le traitement des refinancements.'),
  ('population', 'Population résidente', '{"fr":"Population résidente","ar":"السكان المقيمون","en":"Resident population"}'::jsonb, 'population', 'Population à la date et selon la méthode du HCP ; recensement et projection restent distincts.'),
  ('gdp', 'PIB nominal', '{"fr":"PIB nominal","ar":"الناتج الداخلي الإجمالي الاسمي","en":"Nominal GDP"}'::jsonb, 'gdp', 'Produit intérieur brut à prix courants ; base et révision des comptes nationaux doivent être documentées.');

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Encours de dette intérieure et extérieure du Trésor. Ce périmètre ne représente pas la dette consolidée de l’ensemble des administrations publiques.', 'MAD', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_treasury';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Dette consolidée des administrations publiques selon le périmètre explicite du document source.', 'MAD', 1, 'general_government', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_general_government';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Composante intérieure de l’encours du Trésor selon la classification du MEF.', 'MAD', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_domestic';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Composante extérieure de la dette du Trésor, distincte de la dette extérieure publique totale.', 'MAD', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_external';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Rapport de l’encours du Trésor au PIB nominal pour une même période de référence.', 'percent', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_gdp';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Division de l’encours du Trésor par une population résidente comparable. Il s’agit d’un ratio statistique, pas d’une dette individuelle.', 'MAD', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Ratio ou variation calculée à documenter ; ne pas le publier comme une observation sans source institutionnelle.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_per_capita';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Différence entre deux encours comparables. La variation du stock n’est pas une identité comptable avec le déficit budgétaire.', 'MAD', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Ratio ou variation calculée à documenter ; ne pas le publier comme une observation sans source institutionnelle.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_stock_change';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Intérêts de la dette du Trésor sur la période. Les remboursements de principal sont distincts.', 'MAD', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'interest';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Solde budgétaire selon la convention de signe et le traitement des opérations précisés dans la source.', 'MAD', 1, 'central_government', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'deficit';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Recettes budgétaires selon le périmètre de la source, sans assimilation des emprunts à des recettes ordinaires.', 'MAD', 1, 'central_government', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'revenue';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Dépenses budgétaires selon la nomenclature et le périmètre indiqués dans le document source.', 'MAD', 1, 'central_government', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'expenditure';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Remboursements de principal et intérêts sur la période, en indiquant le traitement des refinancements.', 'MAD', 1, 'treasury', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'debt_service';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Population à la date et selon la méthode du HCP ; recensement et projection restent distincts.', 'persons', 1, 'resident_population', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'population';

insert into maroc_en_chiffres.indicator_definitions(indicator_id,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from)
select id, 'Produit intérieur brut à prix courants ; base et révision des comptes nationaux doivent être documentées.', 'MAD', 1, 'national_economy', 'annual', 'À préciser selon le document officiel avant validation', 'Définition de travail : période, base comptable, signe, classification et compatibilité documentaire à valider. Aucun chiffre approuvé sans document.', date '2026-10-14'
from maroc_en_chiffres.indicators where code = 'gdp';

commit;
