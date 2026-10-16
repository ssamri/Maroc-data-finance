import { z } from "zod";
import { indicators } from "./indicators";
import { officialSources } from "./sources";
import type { Observation } from "./types";
import { getObservationPeriodKey } from "./series";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");

export const observationSchema = z.object({
  id: z.string().min(1),
  indicatorId: z.enum(["debt_treasury", "debt_general_government", "debt_domestic", "debt_external", "debt_gdp", "debt_per_capita", "debt_stock_change", "interest", "deficit", "revenue", "expenditure", "debt_service", "population", "gdp"]),
  value: z.number().finite(),
  exactValue: z.string().regex(/^-?\d+(?:\.\d+)?$/),
  unit: z.enum(["MAD", "percent", "persons"]),
  scale: z.union([z.literal(1), z.literal(1000000), z.literal(1000000000)]),
  scope: z.enum(["treasury", "general_government", "central_government", "national_economy", "resident_population"]),
  period: z.string().min(1),
  referenceDate: calendarDate,
  publicationDate: calendarDate,
  sourceId: z.enum(["mef", "tgr", "bam", "hcp", "oc", "cour", "opendata", "imf", "worldbank"]),
  sourceUrl: z.string().url(),
  documentTitle: z.string().min(3),
  documentPage: z.number().int().positive().nullable(),
  documentLocator: z.string().min(1),
  status: z.enum(["observed", "provisional"]),
  validationStatus: z.literal("approved"),
  version: z.number().int().positive(),
  provenance: z.object({
    documentId: z.string().min(1),
    documentSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    retrievedAt: z.string().datetime({ offset: true }),
    indicatorDefinitionId: z.string().min(1),
    definitionVersion: z.number().int().positive(),
    accountingBasis: z.string().min(1),
    frequency: z.enum(["annual", "quarterly", "monthly", "point_in_time"]),
    periodStart: calendarDate,
    periodEnd: calendarDate,
  }).strict().optional(),
}).strict().superRefine((observation, context) => {
  const issue = (path: string, message: string) => context.addIssue({ code: "custom", path: [path], message });
  if (Number(observation.exactValue) !== observation.value) issue("value", "Display value differs from the exact published value");
  if (observation.referenceDate > observation.publicationDate) issue("publicationDate", "Observed data cannot be published before its reference date");
  const indicator = indicators.find((item) => item.id === observation.indicatorId);
  if (indicator?.scope !== observation.scope) issue("scope", "Economic scope differs from the indicator definition");
  if (indicator?.unit !== observation.unit) issue("unit", "Unit differs from the indicator definition");
  if (!["deficit", "debt_stock_change"].includes(observation.indicatorId) && observation.value < 0) issue("value", "This indicator cannot be negative");
  if (["population", "gdp"].includes(observation.indicatorId) && observation.value <= 0) issue("value", "Population and GDP must be positive");
  if (observation.unit === "percent" && observation.scale !== 1) issue("scale", "Percentage values must use unit scale");
  const source = officialSources.find((item) => item.id === observation.sourceId);
  try {
    const url = new URL(observation.sourceUrl);
    const expected = new URL(source!.url).hostname.replace(/^www\./, "");
    if (url.protocol !== "https:" || url.username || url.password || !(url.hostname === expected || url.hostname.endsWith(`.${expected}`))) {
      issue("sourceUrl", "Source must be an HTTPS URL on the producer’s official domain");
    }
  } catch {
    issue("sourceUrl", "Invalid source URL");
  }
});

export const observationDatasetSchema = z.array(observationSchema).superRefine((dataset, context) => {
  const ids = new Set<string>();
  const revisions = new Set<string>();
  for (const [index, observation] of dataset.entries()) {
    const revision = JSON.stringify([getObservationPeriodKey(observation), observation.version]);
    if (ids.has(observation.id) || revisions.has(revision)) {
      context.addIssue({ code: "custom", path: [index], message: "Duplicate observation or revision" });
    }
    ids.add(observation.id);
    revisions.add(revision);
  }
}) satisfies z.ZodType<Observation[]>;
