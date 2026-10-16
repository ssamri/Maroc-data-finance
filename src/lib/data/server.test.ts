import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configured: vi.fn(), createClient: vi.fn(), rpc: vi.fn(), order: vi.fn(), range: vi.fn(), abortSignal: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: mocks.configured,
  createPublicSupabaseClient: mocks.createClient,
}));

import { loadDashboardData } from "./server";

// Synthetic values never enter the bundled or connected public dataset.
const fixture = {
  id: "test-observation", indicator_code: "debt_treasury", value_exact: "123456789012345678.123456789012",
  scale_exact: "1.000000", unit: "MAD", economic_scope: "treasury", period_start: "2025-01-01",
  period_end: "2025-12-31", reference_date: "2025-12-31", published_at: "2026-01-31",
  source_id: "mef", source_url: "https://www.finances.gov.ma/synthetic-test-only.pdf",
  source_document_id: "test-document", document_title: "Synthetic test report", document_page: null,
  document_locator: "p. 42, test table", document_sha256: "a".repeat(64),
  document_retrieved_at: "2026-02-01T12:00:00+00:00", observation_status: "observed", validation_status: "approved",
  version: 1, producer_name: "Ministère de l’Économie et des Finances", definition_id: "test-definition",
  definition_version: 1, accounting_basis: "Test nominal outstanding stock", frequency: "annual",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockReturnValue({ order: mocks.order });
  mocks.order.mockReturnValue({ order: mocks.order, range: mocks.range });
  mocks.range.mockReturnValue({ abortSignal: mocks.abortSignal });
  mocks.abortSignal.mockResolvedValue({ data: [fixture], error: null, count: 1 });
});

describe("public live dashboard loading", () => {
  it("uses the approved snapshot when no verified public connection is configured", async () => {
    mocks.configured.mockReturnValue(false);
    const result = await loadDashboardData();
    expect(result.integrationStatus).toBe("snapshot");
    expect(result.observations).toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("reads the exact approved export through the public client and preserves provenance", async () => {
    const result = await loadDashboardData();
    expect(mocks.rpc).toHaveBeenCalledWith("export_approved_observations", {}, { count: "exact" });
    expect(result.integrationStatus).toBe("connected");
    expect(result.latestDebt?.exactValue).toBe(fixture.value_exact);
    expect(result.latestDebt?.period).toBe("2025");
    expect(result.latestDebt?.sourceUrl).toBe(fixture.source_url);
    expect(result.latestDebt?.documentPage).toBeNull();
    expect(result.latestDebt?.provenance).toMatchObject({
      documentSha256: "a".repeat(64), retrievedAt: fixture.document_retrieved_at,
      periodStart: "2025-01-01", periodEnd: "2025-12-31", accountingBasis: fixture.accounting_basis,
    });
    expect(result.sources.find((source) => source.id === "mef")?.status).toBe("available");
  });

  it("treats an empty connected database as empty rather than a fictional balance", async () => {
    mocks.abortSignal.mockResolvedValue({ data: [], error: null, count: 0 });
    const result = await loadDashboardData();
    expect(result.integrationStatus).toBe("connected");
    expect(result.latestDebt).toBeNull();
    expect(result.years).toEqual([]);
  });

  it("reports a backend failure safely and keeps the approved snapshot", async () => {
    mocks.abortSignal.mockResolvedValue({ data: null, count: null, error: { message: "secret backend internals" } });
    const result = await loadDashboardData();
    expect(result.integrationStatus).toBe("unavailable");
    expect(result.observations).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("secret backend internals");
    expect(result.integrationNote).toContain("indisponible");
  });

  it("refuses unapproved or incomparable rows even if an export is misconfigured", async () => {
    for (const changes of [{ validation_status: "pending" }, { economic_scope: "general_government" }, { source_url: "https://unofficial.test/report" }]) {
      mocks.abortSignal.mockResolvedValue({ data: [{ ...fixture, ...changes }], error: null, count: 1 });
      const result = await loadDashboardData();
      expect(result.integrationStatus).toBe("unavailable");
      expect(result.observations).toEqual([]);
    }
  });

  it("keeps estimated records outside the official observations", async () => {
    mocks.abortSignal.mockResolvedValue({ data: [{ ...fixture, observation_status: "estimated" }], error: null, count: 1 });
    const result = await loadDashboardData();
    expect(result.integrationStatus).toBe("connected");
    expect(result.observations).toEqual([]);
  });

  it("reads subsequent pages even when the server caps rows below the requested range", async () => {
    mocks.abortSignal
      .mockResolvedValueOnce({ data: [fixture], error: null, count: 2 })
      .mockResolvedValueOnce({ data: [{ ...fixture, id: "other-year", period_start: "2024-01-01", period_end: "2024-12-31", reference_date: "2024-12-31" }], error: null, count: 2 });
    const result = await loadDashboardData();
    expect(result.integrationStatus).toBe("connected");
    expect(result.observations).toHaveLength(2);
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 1, 1000);
  });

  it("does not publish an incomplete or changing paginated dataset", async () => {
    mocks.abortSignal
      .mockResolvedValueOnce({ data: [fixture], error: null, count: 2 })
      .mockResolvedValueOnce({ data: [], error: null, count: 2 });
    expect((await loadDashboardData()).integrationStatus).toBe("unavailable");
    mocks.abortSignal
      .mockResolvedValueOnce({ data: [fixture], error: null, count: 2 })
      .mockResolvedValueOnce({ data: [], error: null, count: 1 });
    expect((await loadDashboardData()).integrationStatus).toBe("unavailable");
  });
});
