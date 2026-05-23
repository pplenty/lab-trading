import type {MetadataRoute} from "next";

// PWA manifest — Next.js App Router file convention 자동으로 /manifest.webmanifest 생성.
// 모바일에서 "홈 화면에 추가" 가능 (Chrome / Safari iOS 18+).
//
// start_url = /ko (1차 ko 단독, ADR-0004). en 활성화 시 사용자 locale 기반.
// theme_color / background_color — jdgrid 패밀리 다크 chrome 통일 (#0f172a).
// icons — app/icon.svg 재사용 (SVG 지원 브라우저). PNG 192/512 추후 (resvg-wasm 호환 후).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "trading — 코인 · 해외주식 · 국내주식 + 일봉 백테스트",
    short_name: "trading",
    description:
      "세 자산군의 시세·랭킹을 한 곳에서 비교하고, 같은 화면에서 사용자 전략을 일봉 기준으로 백테스트.",
    start_url: "/ko",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    lang: "ko",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "검색",
        short_name: "검색",
        description: "종목 통합 검색",
        url: "/ko/search",
      },
      {
        name: "백테스트",
        short_name: "백테스트",
        description: "전략 백테스트",
        url: "/ko/backtest/new",
      },
      {
        name: "포트폴리오",
        short_name: "포트폴리오",
        description: "포트폴리오 백테스트",
        url: "/ko/backtest/portfolio",
      },
      {
        name: "비교 차트",
        short_name: "비교",
        description: "다중 종목 비교",
        url: "/ko/compare",
      },
    ],
  };
}
