import { describe, expect, it } from "vitest";
import { dateSchema, decimalSchema, definitionMetadataSchema, detectDocumentType, observationSchema, officialUrlSchema, reviewSchema } from "./validation";

describe("admin ingestion boundaries", () => {
  it("validates real calendar dates, including leap years", () => {
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(dateSchema.safeParse("2026-04-31").success).toBe(false);
  });
  it("preserves exact decimal strings and rejects exponent or floating input", () => {
    expect(decimalSchema.parse("999999999999999999.123456789012")).toBe("999999999999999999.123456789012");
    expect(decimalSchema.safeParse(120).success).toBe(false);
    expect(decimalSchema.safeParse("1e6").success).toBe(false);
    expect(decimalSchema.safeParse("01").success).toBe(false);
  });
  it("requires verifiable HTTPS URLs without embedded credentials", () => {
    expect(officialUrlSchema.safeParse("https://www.finances.gov.ma/report.pdf").success).toBe(true);
    expect(officialUrlSchema.safeParse("http://www.finances.gov.ma/report.pdf").success).toBe(false);
    expect(officialUrlSchema.safeParse("https://secret@example.org/report.pdf").success).toBe(false);
  });
  it("rejects forged approval fields in draft payloads and reversed periods", () => {
    const id = "3b8e93fa-227d-49cd-99b0-7f7892523449";
    const draft = { indicator_id: id, indicator_definition_id: id, value: "123", unit: "MAD", scale: 1, economic_scope: "treasury", period_start: "2025-12-31", period_end: "2025-01-01", published_at: "2026-01-31", institution_id: id, source_document_id: id, source_url: "https://www.finances.gov.ma/report.pdf", document_locator: "p. 42, tableau 1", observation_status: "observed" };
    expect(observationSchema.safeParse(draft).success).toBe(false);
    expect(observationSchema.safeParse({ ...draft, period_start: "2025-01-01", validation_status: "approved" }).success).toBe(false);
    expect(observationSchema.safeParse({ ...draft, period_start: "2025-01-01" }).success).toBe(true);
    expect(observationSchema.safeParse({ ...draft, period_start: "2025-01-01", period_end: "2025-12-31", published_at: "2025-12-30" }).success).toBe(false);
  });
  it("requires a meaningful review reason", () => {
    expect(reviewSchema.safeParse({ decision: "approved", reason: "ok" }).success).toBe(false);
    expect(reviewSchema.safeParse({ decision: "approved", reason: "Compared with the source document." }).success).toBe(true);
  });
  it("requires explicit accounting metadata and a valid definition period", () => {
    const definition = { definition: "Outstanding liabilities of the Moroccan Treasury at the reference date.", unit: "MAD", scale: 1000000, economic_scope: "treasury", frequency: "point_in_time", accounting_basis: "Outstanding nominal Treasury debt, as defined in the reviewed official report.", comparability_notes: null, valid_from: "2025-01-01", valid_until: null };
    expect(definitionMetadataSchema.safeParse(definition).success).toBe(true);
    expect(definitionMetadataSchema.safeParse({ ...definition, accounting_basis: "À préciser selon le document officiel avant validation" }).success).toBe(false);
    expect(definitionMetadataSchema.safeParse({ ...definition, valid_until: "2024-12-31" }).success).toBe(false);
    expect(definitionMetadataSchema.safeParse({ ...definition, validation_status: "approved" }).success).toBe(false);
  });
  it("rejects mismatched, empty, binary and incomplete document formats", () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(detectDocumentType(encode("%PDF-1.7\n"), "report.pdf")).toBe("pdf");
    expect(detectDocumentType(encode("year,value\n2025,100"), "report.csv")).toBe("csv");
    expect(() => detectDocumentType(encode("hello"), "report.pdf")).toThrow();
    expect(() => detectDocumentType(encode("a\0b"), "report.csv")).toThrow();
    expect(() => detectDocumentType(new Uint8Array([0x50, 0x4b, 3, 4]), "report.xlsx")).toThrow();
    expect(() => detectDocumentType(new Uint8Array(), "report.csv")).toThrow();
  });
});
