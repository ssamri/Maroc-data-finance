/** Observation values retain the published decimal string alongside the display number. */
export type LocalizedText = { fr: string; ar: string; en: string };
export type IndicatorId =
  | "debt_treasury"
  | "debt_general_government"
  | "debt_domestic"
  | "debt_external"
  | "debt_gdp"
  | "debt_per_capita"
  | "debt_stock_change"
  | "interest"
  | "deficit"
  | "revenue"
  | "expenditure"
  | "debt_service"
  | "population"
  | "gdp";
export type EconomicScope =
  | "treasury"
  | "general_government"
  | "central_government"
  | "national_economy"
  | "resident_population";
export type ObservationUnit = "MAD" | "percent" | "persons";
export type SourceId = "mef" | "tgr" | "bam" | "hcp" | "oc" | "cour" | "opendata" | "imf" | "worldbank";

export interface OfficialSource {
  id: SourceId;
  name: string;
  abbreviation: string;
  institution: string;
  url: string;
  description: LocalizedText;
  priorityDocuments: LocalizedText;
  status: "not_retrieved" | "available";
  lastCheckedAt: string;
  accessNote: string;
}

export interface IndicatorDefinition {
  id: IndicatorId;
  label: LocalizedText;
  description: LocalizedText;
  unit: ObservationUnit;
  scope: EconomicScope;
  category: "debt" | "budget" | "economy";
  expectedSourceIds: SourceId[];
  derived?: boolean;
}

export interface Observation {
  id: string;
  indicatorId: IndicatorId;
  value: number;
  exactValue: string;
  unit: ObservationUnit;
  scale: 1 | 1000000 | 1000000000;
  scope: EconomicScope;
  period: string;
  referenceDate: string;
  publicationDate: string;
  sourceId: SourceId;
  sourceUrl: string;
  documentTitle: string;
  documentPage: number | null;
  documentLocator: string;
  status: "observed" | "provisional" | "estimated" | "forecast";
  validationStatus: "approved";
  version: number;
  provenance?: {
    documentId: string;
    documentSha256: string | null;
    retrievedAt: string;
    indicatorDefinitionId: string;
    definitionVersion: number;
    accountingBasis: string;
    frequency: "annual" | "quarterly" | "monthly" | "point_in_time";
    periodStart: string;
    periodEnd: string;
  };
}

export interface ObservationFilters {
  indicatorId?: IndicatorId;
  scope?: EconomicScope;
  fromYear?: number;
  toYear?: number;
}
