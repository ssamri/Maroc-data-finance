import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { createAdminAuthClient, signOutAdministrator } from "./auth";

describe("shared-project administrator session isolation", () => {
  it("uses app-owned storage instead of the shared project's default session key", () => {
    const storageNamespaces = new Set<string>();
    mocks.createClient.mockImplementation((_url, _key, options: { auth: { storageKey: string } }) => {
      storageNamespaces.add(options.auth.storageKey);
      return {};
    });
    createAdminAuthClient("https://project.supabase.co", "public-key");
    expect(storageNamespaces.has("maroc-en-chiffres-auth")).toBe(true);
    expect(storageNamespaces.has("sb-project-auth-token")).toBe(false);
  });
  it("revokes only the current app session and preserves another app's session", async () => {
    const sessions = new Set(["maroc-en-chiffres", "lodgicore"]);
    const signOut = vi.fn(async ({ scope }: { scope?: string }) => {
      if (scope === "local") sessions.delete("maroc-en-chiffres");
      else sessions.clear();
      return { error: null };
    });
    await signOutAdministrator({ auth: { signOut } } as unknown as Pick<SupabaseClient, "auth">);
    expect(sessions).toEqual(new Set(["lodgicore"]));
  });
  it("propagates a failed signout so the interface cannot report false success", async () => {
    const failure = new Error("Signout failed");
    const signOut = vi.fn().mockResolvedValue({ error: failure });
    await expect(signOutAdministrator({ auth: { signOut } } as unknown as Pick<SupabaseClient, "auth">)).rejects.toBe(failure);
  });
});
