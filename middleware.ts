import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";

// ADR-0003: Next 16 proxy.ts 는 Node.js runtime 강제라 @opennextjs/cloudflare
// (Edge Runtime 만 지원) 빌드 실패. middleware.ts(deprecated warning) + 명시적 edge
// runtime 이 현재 Cloudflare 호환의 유일한 경로 (yutils 와 동일 패턴 차용).

export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};

export const runtime = "experimental-edge";
