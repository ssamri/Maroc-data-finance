import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const segment = request.nextUrl.pathname.split("/")[1];
  headers.set("x-mec-locale", segment === "en" || segment === "ar" ? segment : "fr");
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!api|_next|favicon.ico|sitemap.xml|robots.txt|icon.svg).*)"] };
