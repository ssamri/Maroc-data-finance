import { z } from "zod";

const uuid = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}, "Invalid calendar date");

export const officialUrlSchema = z.string().url().max(2048).refine((url) => {
  const parsed = new URL(url);
  return parsed.protocol === "https:" && !parsed.username && !parsed.password;
}, "An HTTPS document URL without credentials is required");

// Keep monetary observations as decimal strings through the API. Parsing them
// as JavaScript numbers would silently lose exact digits for large stocks.
export const decimalSchema = z.string().max(40).regex(/^-?(?:0|[1-9]\d{0,17})(?:\.\d{1,12})?$/);

export const observationSchema = z.object({
  indicator_id: uuid,
  indicator_definition_id: uuid,
  value: decimalSchema,
  unit: z.string().trim().min(1).max(40),
  scale: z.union([z.literal(1), z.literal(1000000), z.literal(1000000000)]),
  economic_scope: z.string().trim().min(1).max(180),
  period_start: dateSchema,
  period_end: dateSchema,
  published_at: dateSchema,
  institution_id: uuid,
  source_document_id: uuid,
  source_url: officialUrlSchema,
  document_locator: z.string().trim().min(1).max(500),
  observation_status: z.enum(["observed", "provisional", "estimated"]),
}).strict().superRefine((data, context) => {
  if (data.period_end < data.period_start) {
    context.addIssue({ code: "custom", path: ["period_end"], message: "The period ends before it starts" });
  }
  if (data.published_at < data.period_end) {
    context.addIssue({ code: "custom", path: ["published_at"], message: "An observed period cannot end after its publication date; use a forecast instead" });
  }
});

export const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(10).max(2000),
}).strict();

export const definitionMetadataSchema = z.object({
  definition: z.string().trim().min(20).max(5000),
  unit: z.string().trim().min(1).max(40),
  scale: z.union([z.literal(1), z.literal(1000000), z.literal(1000000000)]),
  economic_scope: z.string().trim().min(1).max(180),
  frequency: z.enum(["annual", "quarterly", "monthly", "point_in_time"]),
  accounting_basis: z.string().trim().min(3).max(500),
  comparability_notes: z.string().trim().max(5000).nullable(),
  valid_from: dateSchema,
  valid_until: dateSchema.nullable(),
}).strict().superRefine((data, context) => {
  if (data.valid_until && data.valid_until < data.valid_from) context.addIssue({ code: "custom", path: ["valid_until"], message: "Invalid definition validity period" });
  if (/^(?:à préciser|unspecified|todo|to be defined|tbd|n\/a)/i.test(data.accounting_basis)) context.addIssue({ code: "custom", path: ["accounting_basis"], message: "An explicit accounting basis is required" });
});

export const documentMetadataSchema = z.object({
  data_source_id: uuid,
  institution_id: uuid,
  title: z.string().trim().min(3).max(300),
  source_url: officialUrlSchema,
  published_at: dateSchema,
  language: z.enum(["fr", "ar", "en"]),
}).strict();

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** Recognise formats without executing PDF content or unzipping workbooks. */
export function detectDocumentType(bytes: Uint8Array, filename: string): "pdf" | "csv" | "xlsx" {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Invalid file size");
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "pdf";
  if (extension === "xlsx" && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // ZIP entries' names are visible in the central directory. Require the
    // workbook and OOXML manifest; the extraction pipeline must still validate
    // the complete archive before processing it.
    const visibleEntries = new TextDecoder("latin1").decode(bytes);
    if (visibleEntries.includes("[Content_Types].xml") && visibleEntries.includes("xl/workbook.xml")) return "xlsx";
  }
  if (extension === "csv") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.trim() && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) return "csv";
  }
  throw new Error("The file content does not match an accepted PDF, UTF-8 CSV, or XLSX format");
}
