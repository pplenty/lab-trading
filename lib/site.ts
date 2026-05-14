// canonical · hreflang · JSON-LD · sitemap 에 사용할 사이트 절대 URL.
// production 도메인 결정 후 wrangler.jsonc vars 또는 호스팅 환경변수에 NEXT_PUBLIC_SITE_URL 박는다.
// dev/CI 에서 미설정 시 localhost 로 폴백.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
