import type { OfficialSource } from "./types";

const lastCheckedAt = "2026-10-14T12:25:05Z";
const accessNote = "Accès HTTPS refusé par le proxy de cet environnement (CONNECT 403). Aucun document récupéré ni chiffre approuvé.";

/** Institutional addresses are a source directory, not proof of a retrieved publication. */
export const officialSources: OfficialSource[] = [
  {
    id: "mef", name: "Ministère de l’Économie et des Finances", abbreviation: "MEF",
    institution: "Ministère de l’Économie et des Finances", url: "https://www.finances.gov.ma",
    description: { fr: "Dette du Trésor, budget de l’État et rapports accompagnant les lois de finances.", ar: "دين الخزينة وميزانية الدولة والتقارير المرافقة لقوانين المالية.", en: "Treasury debt, State budget and reports accompanying finance laws." },
    priorityDocuments: { fr: "Rapport annuel sur la dette publique ; PLF 2026 et rapports annexes.", ar: "التقرير السنوي حول الدين العمومي؛ مشروع قانون المالية 2026 وتقاريره.", en: "Annual public debt report; 2026 draft finance law and accompanying reports." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "tgr", name: "Trésorerie Générale du Royaume", abbreviation: "TGR",
    institution: "Trésorerie Générale du Royaume", url: "https://www.tgr.gov.ma",
    description: { fr: "Exécution budgétaire, recettes, dépenses et financement du Trésor.", ar: "تنفيذ الميزانية والإيرادات والنفقات وتمويل الخزينة.", en: "Budget execution, revenue, expenditure and Treasury financing." },
    priorityDocuments: { fr: "Bulletins mensuels de statistiques des finances publiques.", ar: "النشرات الشهرية لإحصائيات المالية العمومية.", en: "Monthly public finance statistics bulletins." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "bam", name: "Bank Al-Maghrib", abbreviation: "BAM",
    institution: "Bank Al-Maghrib", url: "https://www.bkam.ma",
    description: { fr: "Statistiques monétaires et analyses macroéconomiques de la banque centrale.", ar: "الإحصائيات النقدية والتحليلات الاقتصادية للبنك المركزي.", en: "Central bank monetary statistics and macroeconomic analysis." },
    priorityDocuments: { fr: "Rapports annuels et séries statistiques.", ar: "التقارير السنوية والسلاسل الإحصائية.", en: "Annual reports and statistical time series." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "hcp", name: "Haut-Commissariat au Plan", abbreviation: "HCP",
    institution: "Haut-Commissariat au Plan", url: "https://www.hcp.ma",
    description: { fr: "Comptes nationaux, produit intérieur brut et population résidente.", ar: "الحسابات الوطنية والناتج الداخلي الإجمالي والسكان المقيمون.", en: "National accounts, gross domestic product and resident population." },
    priorityDocuments: { fr: "Comptes nationaux ; données démographiques et recensement.", ar: "الحسابات الوطنية؛ البيانات الديموغرافية والإحصاء العام.", en: "National accounts; demographic data and census." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "oc", name: "Office des Changes", abbreviation: "OC",
    institution: "Office des Changes", url: "https://www.oc.gov.ma",
    description: { fr: "Balance des paiements, position extérieure et échanges internationaux.", ar: "ميزان المدفوعات والوضع الخارجي والمبادلات الدولية.", en: "Balance of payments, external position and international trade." },
    priorityDocuments: { fr: "Rapports annuels de la balance des paiements.", ar: "التقارير السنوية لميزان المدفوعات.", en: "Annual balance of payments reports." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "cour", name: "Cour des comptes du Maroc", abbreviation: "CDC",
    institution: "Cour des comptes du Maroc", url: "https://www.courdescomptes.ma",
    description: { fr: "Contrôle de la gestion publique et rapports sur l’exécution budgétaire.", ar: "مراقبة التدبير العمومي وتقارير تنفيذ الميزانية.", en: "Public management audits and budget execution reports." },
    priorityDocuments: { fr: "Rapports annuels et rapports sur l’exécution des lois de finances.", ar: "التقارير السنوية وتقارير تنفيذ قوانين المالية.", en: "Annual reports and finance law execution reports." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "opendata", name: "Portail Open Data du Maroc", abbreviation: "Open Data",
    institution: "Portail Open Data du Maroc", url: "https://data.gov.ma",
    description: { fr: "Catalogue de jeux de données des institutions publiques marocaines.", ar: "فهرس مجموعات بيانات المؤسسات العمومية المغربية.", en: "Catalogue of Moroccan public institution datasets." },
    priorityDocuments: { fr: "Jeux de données avec producteur et métadonnées identifiables.", ar: "مجموعات البيانات مع جهة منتجة وبيانات وصفية واضحة.", en: "Datasets with identifiable producers and metadata." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "imf", name: "Fonds monétaire international", abbreviation: "FMI",
    institution: "International Monetary Fund", url: "https://www.imf.org",
    description: { fr: "Rapports pays et comparaisons internationales avec définitions harmonisées.", ar: "تقارير الدول والمقارنات الدولية بتعريفات منسجمة.", en: "Country reports and international comparisons with harmonized definitions." },
    priorityDocuments: { fr: "Rapports Article IV sur le Maroc ; définitions des séries comparées.", ar: "تقارير المادة الرابعة حول المغرب؛ تعريفات السلاسل المقارنة.", en: "Morocco Article IV reports; definitions of compared series." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
  {
    id: "worldbank", name: "Banque mondiale", abbreviation: "BM",
    institution: "World Bank", url: "https://www.worldbank.org",
    description: { fr: "Indicateurs de développement et séries de comparaison internationale.", ar: "مؤشرات التنمية وسلاسل المقارنة الدولية.", en: "Development indicators and international comparison series." },
    priorityDocuments: { fr: "Indicateurs documentés par pays, unité et périmètre.", ar: "مؤشرات موثقة حسب البلد والوحدة والنطاق.", en: "Indicators documented by country, unit and scope." },
    status: "not_retrieved", lastCheckedAt, accessNote,
  },
];
