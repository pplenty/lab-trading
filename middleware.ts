import {NextResponse, type NextRequest} from "next/server";
import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";

// ADR-0003: Next 16 proxy.ts 는 Node.js runtime 강제라 @opennextjs/cloudflare
// (Edge Runtime 만 지원) 빌드 실패. middleware.ts(deprecated warning) + 명시적 edge
// runtime 이 현재 Cloudflare 호환의 유일한 경로 (yutils 와 동일 패턴 차용).
//
// ADR-0004: 1차 출시는 ko 단독. /en/* 진입 시 /ko/* 로 308 redirect.
// routing.locales 에 "en" 은 후속 Phase 2 i18n 활성 시 인프라 변경 비용 회피용으로 유지.

const intlMiddleware = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const {pathname} = req.nextUrl;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en/, "/ko");
    return NextResponse.redirect(url, 308);
  }
  return intlMiddleware(req);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};

export const runtime = "experimental-edge";
