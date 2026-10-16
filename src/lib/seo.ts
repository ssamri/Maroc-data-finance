/** Production URLs must be configured; never emit fictitious canonical domains. */
export function siteUrl():string|null {
  const value=process.env.NEXT_PUBLIC_SITE_URL;
  if(!value)return null;
  try { const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.origin:null; } catch { return null; }
}
