import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
export default function robots():MetadataRoute.Robots {
  const base=siteUrl(); return {rules:{userAgent:"*",allow:"/",disallow:["/admin","/en/admin","/ar/admin","/api/"]},...(base?{sitemap:`${base}/sitemap.xml`}:{})};
}
