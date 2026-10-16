import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { buildDashboardData, getDashboardData, officialSources, type DashboardData, type Observation } from "./index";
import { observationDatasetSchema } from "./validation";

const exportRowSchema = z.object({
  id: z.string().min(1),
  indicator_code: z.string().min(1),
  value_exact: z.string().regex(/^-?\d+(?:\.\d+)?$/),
  scale_exact: z.string().regex(/^\d+(?:\.\d+)?$/),
  unit: z.string().min(1),
  economic_scope: z.string().min(1),
  period_start: z.string(),
  period_end: z.string(),
  reference_date: z.string(),
  published_at: z.string(),
  source_id: z.string().min(1),
  source_url: z.string().url(),
  source_document_id: z.string().min(1),
  document_title: z.string().min(3),
  document_page: z.number().int().positive().nullable(),
  document_locator: z.string().min(1),
  document_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  document_retrieved_at: z.string().datetime({ offset: true }),
  observation_status: z.enum(["observed", "provisional", "estimated"]),
  validation_status: z.literal("approved"),
  version: z.number().int().positive(),
  producer_name: z.string().min(1),
  definition_id: z.string().min(1),
  definition_version: z.number().int().positive(),
  accounting_basis: z.string().min(1),
  frequency: z.enum(["annual", "quarterly", "monthly", "point_in_time"]),
}).refine((row) => row.reference_date === row.period_end && row.period_end >= row.period_start,
  "Reference date and documented period disagree");

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

function periodLabel(start: string, end: string): string {
  if (start === end) return end;
  if (start.slice(0, 4) === end.slice(0, 4) && start.endsWith("-01-01") && end.endsWith("-12-31")) {
    return end.slice(0, 4);
  }
  return `${start}/${end}`;
}

function publicObservations(input: unknown): Observation[] {
  const rows = z.array(exportRowSchema).parse(input);
  return observationDatasetSchema.parse(rows.filter((row) => row.observation_status !== "estimated").map((row) => ({
    id: row.id,
    indicatorId: row.indicator_code,
    value: Number(row.value_exact),
    exactValue: row.value_exact,
    unit: row.unit,
    scale: Number(row.scale_exact),
    scope: row.economic_scope,
    period: periodLabel(row.period_start, row.period_end),
    referenceDate: row.reference_date,
    publicationDate: row.published_at,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    documentTitle: row.document_title,
    documentPage: row.document_page,
    documentLocator: row.document_locator,
    status: row.observation_status,
    validationStatus: row.validation_status,
    version: row.version,
    provenance: {
      documentId: row.source_document_id,
      documentSha256: row.document_sha256,
      retrievedAt: row.document_retrieved_at,
      indicatorDefinitionId: row.definition_id,
      definitionVersion: row.definition_version,
      accountingBasis: row.accounting_basis,
      frequency: row.frequency,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    },
  })));
}

/** The RPC joins approved institutions, sources, documents and definitions under
 * anonymous RLS. It serializes PostgreSQL financial numerics as text, preserving
 * the exact decimals. No service key or administrator session is used here.
 */
async function readLiveDashboardData(): Promise<DashboardData> {
  const snapshot = getDashboardData();
  if (!isSupabaseConfigured()) return {
    ...snapshot,
    integrationStatus: "snapshot",
    integrationNote: "Le jeu local approuvé est affiché ; la connexion de données n’est pas configurée.",
  };
  try {
    const client = createPublicSupabaseClient();
    const records: unknown[] = [];
    let complete = false;
    let expectedCount: number | null = null;
    const signal = AbortSignal.timeout(12_000);
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = records.length;
      const { data, error, count } = await client.rpc("export_approved_observations", {}, { count: "exact" })
        .order("period_end", { ascending: true }).order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1).abortSignal(signal);
      if (error || !Array.isArray(data) || count === null || !Number.isSafeInteger(count) || count < 0) {
        throw new Error("Public observation export unavailable");
      }
      if (expectedCount !== null && expectedCount !== count) throw new Error("Dataset changed during pagination");
      expectedCount = count;
      records.push(...data);
      if (records.length === count) { complete = true; break; }
      if (records.length > count || data.length === 0) throw new Error("Incomplete public observation export");
    }
    if (!complete) throw new Error("Public observation export exceeds the supported complete dataset size");
    const approved = publicObservations(records);
    const sources = officialSources.map((source) => {
      const available = approved.filter((item) => item.sourceId === source.id);
      if (available.length === 0) return source;
      const lastRetrieved = available.reduce((latest, item) => {
        const retrieved = item.provenance?.retrievedAt ?? latest;
        return retrieved > latest ? retrieved : latest;
      }, "");
      return {
        ...source,
        status: "available" as const,
        lastCheckedAt: lastRetrieved || source.lastCheckedAt,
        accessNote: "Des observations et leur chaîne documentaire approuvées sont disponibles dans la base connectée.",
      };
    });
    return {
      ...buildDashboardData(approved, sources),
      integrationStatus: "connected",
      integrationNote: "Observations approuvées lues depuis la base ; aucune estimation générée n’est mélangée aux sources officielles.",
    };
  } catch {
    // Do not expose Supabase internals, document drafts, credentials or raw errors.
    return {
      ...snapshot,
      integrationStatus: "unavailable",
      integrationNote: "La lecture de la base connectée est indisponible. Le jeu local approuvé est affiché ; sa fraîcheur doit être vérifiée.",
    };
  }
}

/** React memoization deduplicates reads within one render only. Routes consuming
 * this loader must remain dynamic so future administrator approvals are visible.
 */
export const loadDashboardData = cache(readLiveDashboardData);
