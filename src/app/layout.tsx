import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { t, type Locale } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Maroc en chiffres — Comprendre les finances publiques", template: "%s | Maroc en chiffres" },
  description: "Observatoire indépendant des finances publiques marocaines. Dette du Trésor, budget, sources et simulations transparentes.",
  applicationName: "Maroc en chiffres",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#091923" }, { media: "(prefers-color-scheme: light)", color: "#f6f8f7" }] };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const code = (await headers()).get("x-mec-locale");
  const locale: Locale = code === "en" || code === "ar" ? code : "fr";
  const d = t(locale);
  return <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('mec-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){}})()`}} /></head>
    <body><a className="skip-link" href="#main">{d.skip}</a><SiteHeader locale={locale}/><main id="main">{children}</main><SiteFooter locale={locale}/></body>
  </html>;
}
