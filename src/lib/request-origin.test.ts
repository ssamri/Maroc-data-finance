import { describe, expect, it } from "vitest";
import { isTrustedRequestOrigin } from "./request-origin";

describe("administrator request origin behind a TLS proxy", () => {
  it("accepts a direct request from the same origin", () => {
    const request = new Request("https://finance.example/api/admin/observations", { headers: { Origin: "https://finance.example" } });
    expect(isTrustedRequestOrigin(request)).toBe(true);
  });

  it("accepts the configured external HTTPS origin with an internal HTTP request URL", () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/observations", { headers: { Origin: "https://finance.example" } });
    expect(isTrustedRequestOrigin(request, "https://finance.example")).toBe(true);
  });

  it("rejects a foreign origin despite spoofed forwarding headers", () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/observations", { headers: {
      Origin: "https://evil.example",
      "X-Forwarded-Host": "evil.example",
      "X-Forwarded-Proto": "https",
      Forwarded: "host=evil.example;proto=https",
    } });
    expect(isTrustedRequestOrigin(request, "https://finance.example")).toBe(false);
  });

  it("accepts a CLI request without an Origin header", () => {
    const request = new Request("http://127.0.0.1:3000/api/admin/observations");
    expect(isTrustedRequestOrigin(request, "https://finance.example")).toBe(true);
  });

  it.each(["not a URL", "javascript:alert(1)", "https://user:password@finance.example", "https://finance.example/path"])('rejects invalid canonical configuration "%s" rather than falling back to the request URL', (configuration) => {
    const request = new Request("https://finance.example/api/admin/observations", { headers: { Origin: "https://finance.example" } });
    expect(isTrustedRequestOrigin(request, configuration)).toBe(false);
  });
});
