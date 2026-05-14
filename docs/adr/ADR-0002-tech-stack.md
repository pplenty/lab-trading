# ADR-0002: 기술 스택

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 확인 필요)
- 관련 ADR: ADR-0003 (호스팅), ADR-0011 (차트)

## 컨텍스트

사용자가 명시적으로 "UI는 yutils를 참고하고, CF로 배포할 거야"라고 했다. yutils는 다음 스택을 운영 중이고 (ADR-0001~0010), 안정적으로 검증됐다:

- Next.js 16 (App Router) + React 19
- Tailwind v4 (`@tailwindcss/postcss`)
- next-intl 4
- TypeScript strict
- bun 1.3+ / Node 22+
- `@opennextjs/cloudflare` 어댑터
- ESLint 9 (flat config)

같은 스택을 lab-trading에 차용할지, 차이가 큰 항목(특히 차트/데이터 계열)에서 다른 스택을 도입할지 결정한다.

## 검토한 옵션

### A. yutils 스택 그대로 차용
- 장점: 두 프로젝트의 컴포넌트(`AppShell`, `Sparkline`, `SearchBox`, `Header`, 테마 시스템 등) 직접 이식 가능. CF 배포 패턴(`@opennextjs/cloudflare`, `wrangler.jsonc`)도 검증됨. 학습 비용 0.
- 단점: 트레이딩 도메인 특화 패키지(차트, 데이터 fetch, 차트 SSR 회피)가 추가되면 yutils 패턴과 부분 불일치 발생 — 어쩔 수 없는 부분.

### B. Vite + React Router + Tanstack Query
- 장점: 차트 라이브러리·실시간 데이터 fetch와 더 친화적. SSR 강제 안 됨. 번들 컨트롤 좋음.
- 단점: yutils와 디버깅·컴포넌트 공유 불가. SEO·sitemap·hreflang·RSC 캐시는 직접 구현 필요. **사용자가 "UI 기반은 똑같고"라고 했는데 라우팅/렌더링 모델이 다르면 정확히 같은 UX를 재현하는 비용이 더 크다.**

### C. SvelteKit / Nuxt
- 장점: 번들이 가볍다.
- 단점: yutils 컴포넌트 재사용 불가. 사용자 요구사항 위배.

### D. Remix / TanStack Start
- 장점: SSR + 데이터 fetch 모델이 깔끔.
- 단점: 마찬가지로 yutils 컴포넌트 재사용 불가. CF 배포는 가능하나 검증된 워크플로우는 Next 쪽이 단단함.

## 결정

**옵션 A 채택 권장.**

근거:
1. 사용자가 "UI 기반은 똑같고"라고 명시했다. 같은 UX를 똑같이 재현하려면 동일한 React 19 + Tailwind v4 + next-intl 4 라우팅 모델을 쓰는 게 가장 비용이 적다.
2. yutils의 `AppShell.tsx` (sidebar resize + drawer + localStorage), `ToolsSidebar.tsx`, `SearchBox.tsx` (Cmd+K, ARIA combobox), `KeyboardShortcutsDialog.tsx` 같은 부품을 lab-trading에서도 같은 패턴으로 재사용한다. 코드를 처음에 복사한 뒤 추후 공통 라이브러리로 추출하는 것도 옵션.
3. CF 배포는 yutils ADR-0010·0024에서 검증됨 (`middleware.ts` + `experimental-edge` 패턴이 `@opennextjs/cloudflare`와 호환).
4. 데이터 fetch 차이는 React Server Components + Route Handler + `unstable_cache`로 흡수 가능. Tanstack Query는 클라이언트 갱신이 필요한 좁은 영역에만 도입(랭킹 페이지 폴링 등).

**잠금 항목:**
| 항목 | 값 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) |
| 런타임 라이브러리 | React 19 |
| 스타일 | Tailwind v4 + `@tailwindcss/postcss` |
| i18n | next-intl 4 |
| TypeScript | strict |
| 패키지 매니저 | bun 1.3+ |
| 로컬 Node | 22+ |
| 어댑터 | `@opennextjs/cloudflare` (ADR-0003) |
| Linter | ESLint 9 (flat config, `eslint-config-next`) |
| 테스트 | Vitest (1차 출시 후 도입) |

## 결과

### 긍정적
- yutils 컴포넌트·테마·라우팅 패턴 재사용. 1차 출시 셸 부트 시간 단축.
- CF 배포 워크플로우 그대로 (`bun run cf:{build,preview,deploy}`).
- TypeScript strict + bun + Tailwind v4의 빠른 개발 사이클 유지.

### 부정적
- yutils와 lab-trading이 모놀리포가 아니라 별도 레포라서, 공통 컴포넌트 추출 시점에 코드 중복이 우선 발생. → 완화: 1차 출시까지는 lab-trading에 직접 복제 → Phase 2에 `@lab/ui` 같은 npm 워크스페이스 또는 internal package로 추출 검토.
- React 19 / Tailwind v4가 신생이라 라이브러리 호환성 이슈 가능 (예: visx의 React 19 peer-dep 미선언). → 완화: 차트는 lightweight-charts (framework-agnostic)로 회피 (ADR-0011).

### 따라오는 작업
- `package.json` 부트 (yutils 의존성 복사 후 트레이딩 도메인 dependencies 제거: `bcryptjs`, `qrcode`, `sql-formatter`, `papaparse`, `js-beautify`, `@iarna/toml`, `cron-parser`, `cronstrue`, `diff`, `isomorphic-dompurify`, `jsonpath-plus`, `lucide-react`, `marked`, `spark-md5`, `ua-parser-js`, `yaml`, `ajv*`, `fast-xml-parser` — 거의 다 도구용)
- `wrangler.jsonc` + `open-next.config.ts` 작성 (yutils 패턴 차용, name만 `lab-trading`으로)
- `i18n/`, `messages/ko.json`, `middleware.ts`, `next.config.ts` 부트
- `lib/themes.ts` 차용 (12 라이트 프리셋 + system/light/dark)
- `AppShell.tsx`, `Header.tsx`, `Footer.tsx`, `SearchBox.tsx`, `ThemeSwitcher.tsx`, `ModeSwitcher.tsx`, `LocaleSwitcher.tsx`, `KeyboardShortcutsDialog.tsx` 차용

## 참고

- yutils ADR-0001 (프레임워크 — Next.js App Router)
- yutils ADR-0002 (스타일링 — Tailwind + 자체 토큰)
- yutils ADR-0007 (i18n 라이브러리 — next-intl)
- yutils ADR-0010 (Cloudflare 어댑터 — `@opennextjs/cloudflare`)
