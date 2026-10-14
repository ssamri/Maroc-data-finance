import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Home } from "@/components/home";
import { PublicPage } from "@/components/public-page";
import { resolveRoute, publicRoutes, routeLabels, hrefFor, t, type PublicRoute } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
type Props={params:Promise<{path?:string[]}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const {locale,slug}=resolveRoute((await params).path);const d=t(locale);
  const title=slug==="admin"?d.admin:slug ? d[routeLabels[slug as PublicRoute]]:d.brand;
  const base=siteUrl();const url=base?`${base}${hrefFor(locale,slug)}`:undefined;
  return { title:title??d.brand,description:d.heroText, ...(url?{alternates:{canonical:url,languages:{fr:`${base}${hrefFor("fr",slug)}`,en:`${base}${hrefFor("en",slug)}`,ar:`${base}${hrefFor("ar",slug)}`,"x-default":`${base}${hrefFor("fr",slug)}`}}}:{}),openGraph:{title:title??d.brand,description:d.heroText,siteName:d.brand,type:"website",locale:{fr:"fr_MA",en:"en_GB",ar:"ar_MA"}[locale],...(url?{url,images:[{url:`${base}/opengraph-image.svg`,width:1200,height:630,alt:"Maroc en chiffres"}]}:{})},...(slug==="admin"?{robots:{index:false,follow:false}}:{}) };
}
export default async function Page({params}:Props) {
  const {locale,slug,valid}=resolveRoute((await params).path);
  if(!valid || (slug && slug!=="admin" && !(publicRoutes as readonly string[]).includes(slug))) notFound();
  const base=siteUrl();
  return <>{!slug && base && <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:t(locale).brand,url:`${base}${hrefFor(locale)}`,inLanguage:locale,description:t(locale).heroText}).replaceAll("<","\\u003c")}}/>}{slug ? <PublicPage locale={locale} route={slug as PublicRoute|"admin"}/> : <Home locale={locale}/>}</>;
}
