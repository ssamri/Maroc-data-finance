import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), from: vi.fn(), rpc: vi.fn(), storage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  DOCUMENTS_BUCKET: "maroc-en-chiffres-documents",
  requireAdmin: mocks.requireAdmin,
  AdminAuthError: class extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
  },
}));

import { AdminAuthError } from "@/lib/supabase/server";
import { POST as createObservation } from "../observations/route";
import { PATCH as reviewObservation } from "../observations/[id]/route";
import { POST as uploadDocument } from "../documents/route";
import { PATCH as reviewRegistry } from "../registry/[entity]/[id]/route";
import { PATCH as editDefinition } from "../definitions/[id]/route";
import { readBoundedBody } from "./http";

const id = "3b8e93fa-227d-49cd-99b0-7f7892523449";
const draft = { indicator_id: id, indicator_definition_id: id, value: "123456789012345678.123456789012", unit: "MAD", scale: 1, economic_scope: "treasury", period_start: "2025-01-01", period_end: "2025-12-31", published_at: "2026-01-31", institution_id: id, source_document_id: id, source_url: "https://www.finances.gov.ma/report.pdf", document_locator: "p. 42, tableau 1", observation_status: "observed" };
const request = (path: string, body: unknown) => new Request(`https://example.org/api/admin/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer opaque-token", "Origin": "https://example.org" }, body: JSON.stringify(body) });

beforeEach(() => {
  mocks.requireAdmin.mockReset(); mocks.from.mockReset(); mocks.rpc.mockReset(); mocks.storage.mockReset();
  mocks.requireAdmin.mockResolvedValue({ user: { id }, profile: { role: "admin", active: true }, client: { from: mocks.from, rpc: mocks.rpc, storage: { from: mocks.storage } } });
});

describe("authenticated admin API boundaries", () => {
  it("stops before any database or storage access when authorization fails", async () => {
    mocks.requireAdmin.mockRejectedValue(new AdminAuthError(403, "ADMIN_FORBIDDEN", "private detail"));
    const result = await createObservation(request("observations", draft));
    expect(result.status).toBe(403);
    expect(await result.json()).toEqual({ error: "ADMIN_FORBIDDEN" });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });
  it("retains exact monetary decimals and creates only a pending observation", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ insert });
    const result = await createObservation(request("observations", draft));
    expect(result.status).toBe(201);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(expect.any(Request), { roles: ["editor", "admin"] });
    expect(insert).toHaveBeenCalledWith({ ...draft, validation_status: "pending", version: 1 });
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects client-injected approval and mismatched origins without inserts", async () => {
    const forged = await createObservation(request("observations", { ...draft, validation_status: "approved" }));
    expect(forged.status).toBe(400);
    const crossOrigin = request("observations", draft);
    crossOrigin.headers.set("Origin", "https://other.example.org");
    expect((await createObservation(crossOrigin)).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("keeps review role checks and atomic review RPC arguments", async () => {
    mocks.rpc.mockResolvedValue({ data: { id }, error: null });
    const result = await reviewObservation(request(`observations/${id}`, { decision: "approved", reason: "Compared with the official source document." }), { params: Promise.resolve({ id }) });
    expect(result.status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(expect.any(Request), { roles: ["reviewer", "admin"] });
    expect(mocks.rpc).toHaveBeenCalledWith("review_observation", { p_observation_id: id, p_decision: "approved", p_reason: "Compared with the official source document." });
  });
  it("rejects non-registry table names before invoking an RPC", async () => {
    const result = await reviewRegistry(request(`registry/admin_users/${id}`, { decision: "approved", reason: "Attempted privilege escalation." }), { params: Promise.resolve({ entity: "admin_users", id }) });
    expect(result.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("edits only unapproved definitions and preserves the existing review record", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const approvalFilter = vi.fn(() => ({ select }));
    const statusFilter = vi.fn(() => ({ is: approvalFilter }));
    const eq = vi.fn(() => ({ in: statusFilter }));
    const update = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ update });
    const metadata = { definition: "Outstanding liabilities of the Moroccan Treasury at the reference date.", unit: "MAD", scale: 1000000, economic_scope: "treasury", frequency: "point_in_time", accounting_basis: "Nominal outstanding Treasury debt in the approved official source.", comparability_notes: null, valid_from: "2025-01-01", valid_until: null };
    const result = await editDefinition(request(`definitions/${id}`, metadata), { params: Promise.resolve({ id }) });
    expect(result.status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledWith(expect.any(Request), { roles: ["editor", "reviewer", "admin"] });
    expect(update).toHaveBeenCalledWith({ ...metadata, validation_status: "draft" });
    expect(statusFilter).toHaveBeenCalledWith("validation_status", ["draft", "pending", "rejected"]);
    expect(approvalFilter).toHaveBeenCalledWith("approved_at", null);
  });
  it("rejects disguised document content before storage writes", async () => {
    const form = new FormData();
    Object.entries({ data_source_id: id, institution_id: id, title: "Official report", source_url: "https://www.finances.gov.ma/report.pdf", published_at: "2026-01-31", language: "fr" }).forEach(([key, value]) => form.set(key, value));
    form.set("file", new File(["not a PDF"], "report.pdf", { type: "application/pdf" }));
    const result = await uploadDocument(new Request("https://example.org/api/admin/documents", { method: "POST", body: form }));
    expect(result.status).toBe(415);
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("uploads into an isolated private bucket with a generated safe path and source fingerprint", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    mocks.storage.mockReturnValue({ upload });
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id }, error: null }) }) }));
    mocks.from.mockReturnValue({ insert });
    const pdf = "%PDF-1.7\n%%EOF";
    const form = new FormData();
    const metadata = { data_source_id: id, institution_id: id, title: "Official report", source_url: "https://www.finances.gov.ma/report.pdf", published_at: "2026-01-31", language: "fr" };
    Object.entries(metadata).forEach(([key, value]) => form.set(key, value));
    form.set("file", new File([pdf], "../../unsafe.pdf", { type: "application/pdf" }));
    // An attempted multipart approval field never controls stored status.
    form.set("validation_status", "approved");
    const result = await uploadDocument(new Request("https://example.org/api/admin/documents", { method: "POST", body: form }));
    expect(result.status).toBe(201);
    expect(mocks.storage).toHaveBeenCalledWith("maroc-en-chiffres-documents");
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${id}/[0-9a-f-]{36}\\.pdf$`)), expect.any(Uint8Array), { contentType: "application/pdf", upsert: false, cacheControl: "0" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ...metadata, byte_size: new TextEncoder().encode(pdf).length, validation_status: "pending", sha256: createHash("sha256").update(pdf).digest("hex") }));
  });
  it("bounds chunked bodies without relying on Content-Length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(33)); }, cancel });
    const upload = new Request("https://example.org/upload", { method: "POST", body, duplex: "half" } as RequestInit & { duplex: "half" });
    await expect(readBoundedBody(upload, 32)).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
    expect(cancel).toHaveBeenCalled();
  });
  it("does not disclose PostgreSQL internals on draft errors", async () => {
    mocks.from.mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "23505", message: "private database detail" } }) }) }) });
    const result = await createObservation(request("observations", draft));
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: "DUPLICATE_OBSERVATION" });
  });
});
