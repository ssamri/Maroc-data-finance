/** Compare against the configured public origin when TLS terminates at a proxy.
 * Forwarded headers are client-controlled unless separately authenticated by the
 * hosting platform, so they never establish an allowed browser origin here.
 */
export function isTrustedRequestOrigin(request: Request, configuredSiteUrl?: string): boolean {
  let trustedOrigin: string;
  try {
    if (configuredSiteUrl !== undefined && configuredSiteUrl !== "") {
      const site = new URL(configuredSiteUrl);
      if (configuredSiteUrl !== configuredSiteUrl.trim() ||
        !["https:", "http:"].includes(site.protocol) || site.username || site.password ||
        site.search || site.hash || site.pathname !== "/") return false;
      trustedOrigin = site.origin;
    } else {
      trustedOrigin = new URL(request.url).origin;
    }
  } catch { return false; }

  const browserOrigin = request.headers.get("origin");
  // CLI clients still require the API's independent bearer-token and RLS gates.
  return browserOrigin === null || browserOrigin === trustedOrigin;
}
