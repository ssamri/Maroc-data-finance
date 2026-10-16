import type { MetadataRoute } from "next";
import { locales, publicRoutes, hrefFor } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
export default function sitemap():MetadataRoute.Sitemap {
  const base=siteUrl(); if(!base)return [];
  return locales.flatMap(locale=>["",...publicRoutes].map(path=>({url:`${base}${hrefFor(locale,path)}`,changeFrequency:"weekly" as const,priority:path? .7:1,alternates:{languages:Object.fromEntries(locales.map(lang=>[lang,`${base}${hrefFor(lang,path)}`]))}})));
}
