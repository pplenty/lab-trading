import {defineRouting} from "next-intl/routing";

// ADR-0004: prefix-everywhere `/<lang>/<path>`. 1차 출시는 ko 단독 활성,
// en 은 messages 스켈레톤만 잠그고 Phase 2 에 활성화. en locale 을 routing
// 에 포함하지 않으면 후속 i18n 활성 PR 의 인프라 변경이 커지므로 미리 정의.
export const routing = defineRouting({
  locales: ["ko", "en"],
  defaultLocale: "ko",
  localePrefix: "always",
  localeCookie: false,
  localeDetection: false,
});
