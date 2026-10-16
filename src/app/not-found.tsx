import Link from "next/link";
import { headers } from "next/headers";
export default async function NotFound(){const code=(await headers()).get("x-mec-locale");const locale=code==="ar"||code==="en"?code:"fr";const copy={fr:["Page introuvable","Retour à l’accueil"],en:["Page not found","Back to overview"],ar:["الصفحة غير موجودة","العودة إلى الرئيسية"]}[locale];return <div className="container not-found"><p className="eyebrow">404</p><h1>{copy[0]}</h1><Link className="btn btn-primary" href={locale==="fr"?"/":`/${locale}`}>{copy[1]}</Link></div>;}
