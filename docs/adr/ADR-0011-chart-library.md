# ADR-0011: 차트 라이브러리

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0002 (스택), ADR-0012 (컬러)

## 컨텍스트

3 유형의 차트가 필요:
1. **카드/랭킹/대시보드 스파크라인** — 30-100 포인트, 미니, 인라인
2. **종목 상세 캔들 + 거래량** — 1년+ 일봉, 십자선, 핀치 줌
3. **백테스트 결과** — 자산 가치 곡선 + 매수/매도 마커 + 비교 buy-and-hold

조사 결과(2026-05-12) 후보 톱:

| 라이브러리 | gzip | 강점 | 약점 |
|---|---|---|---|
| TradingView Lightweight Charts v5 | ~38KB | 금융 전용, 캔들+볼륨 멀티패널, options 즉시 갱신 | window 필요(dynamic ssr:false) |
| ECharts (tree-shake) | 60-100KB | 다재다능, SVG 옵션 | 옵션 객체 스타일 |
| Recharts | ~90-110KB | React composable | 캔들 직접 구현 |
| Visx | 15-40KB (모듈) | 작음 | React 19 peer-dep 미선언 |
| uPlot | ~22KB | 초경량 | 저수준, 캔들 직접 |
| 자체 SVG (yutils Sparkline 패턴) | ~5KB | 의존 0, RSC 호환 | 캔들 직접 구현 부담 |
| Plotly / Highcharts / ApexCharts | 100KB+ | 풍부 | 무겁고 라이선스/번들 부담 |

## 검토한 옵션

### A. lightweight-charts v5 + 자체 SVG Sparkline (조사 권장)
- 장점: 메인 차트는 금융 전용 라이브러리, 스파크라인은 의존 0. 평균 페이지 무게 yutils 200KB 목표 통과.
- 단점: 라이브러리 2개 패턴 (한 곳은 SSR-safe, 한 곳은 dynamic).

### B. ECharts 단독
- 장점: 모든 차트 일관 스타일.
- 단점: 평균 페이지 80KB+ 무게. 스파크라인엔 과함.

### C. Recharts 단독
- 장점: React composable. SVG라 SSR 친화.
- 단점: 캔들 직접 구현 필요. lab-trading 핵심은 캔들이라 부적합.

### D. lightweight-charts 단독 (스파크라인도)
- 장점: 라이브러리 1개.
- 단점: 스파크라인 1개당 인스턴스 메모리 ↑. 랭킹 테이블 50행에 50 캔버스 인스턴스는 비효율.

### E. 모든 차트 자체 SVG
- 장점: 의존 0. 완벽 RSC.
- 단점: 캔들 차트 (십자선, 핀치 줌, 오버레이) 직접 구현 비용 큼.

## 결정

**옵션 A 채택 권장.**

근거:
1. 스파크라인은 yutils의 검증된 `Sparkline.tsx` 패턴(4.4KB) 그대로 이식. RSC로 서버 렌더 가능 → 카드 50개에 0 JS.
2. 메인 캔들 차트는 직접 구현 비용 회수 안 됨. lightweight-charts v5는 38KB 가성비 + 금융 전용 디테일(시간축 자동 정렬, 거래량 패널 동기화) 완성도 최고.
3. lightweight-charts는 `dynamic({ssr:false})`로 동적 import → 종목 상세·백테스트 페이지에서만 로드 → 평균 페이지 부담 0.
4. ECharts는 1차 출시 제외 (대시보드 히트맵·트리맵이 필요해지는 Phase 2에 재검토).

**잠금 항목:**

| 컴포넌트 | 라이브러리 | 위치 |
|---|---|---|
| `<Sparkline>` | 자체 SVG (yutils 이식) | `components/charts/Sparkline.tsx` |
| `<CandleChart>` | `lightweight-charts` v5 | `components/charts/CandleChart.tsx` (`"use client"` + dynamic) |
| `<VolumeBars>` | `lightweight-charts` (캔들과 동기화) | 캔들 차트 안 |
| `<EquityCurve>` (백테스트) | `lightweight-charts` line series | `components/charts/EquityCurve.tsx` |

**컬러:** ADR-0012의 `--color-up`/`--color-down` CSS 토큰. lightweight-charts는 `applyOptions({ upColor, downColor })`로 토큰 값 주입 (CSS 변수 → `getComputedStyle`로 추출).

**번들 가드:** `scripts/check-bundle-size.ts` (yutils 차용) — 종목 상세 페이지 chunk 200KB gzip 초과 시 CI 실패.

## 결과

### 긍정적
- 평균 페이지 무게 0KB 추가 (스파크라인 RSC).
- 종목 상세·백테스트 페이지에서만 38KB 차트 라이브러리 로드.
- 컬러 시맨틱 전환(한국식/글로벌식)이 1줄로 가능.

### 부정적
- 라이브러리 1개 추가. → 완화: 가성비 압도적, 트레이딩 사이트의 핵심 자산.
- v5가 신생(2026 출시)이라 호환성 이슈 가능. → 완화: 운영 시 GitHub issue 모니터링. fallback으로 v4 사용.

### 따라오는 작업
- `bun add lightweight-charts`
- `components/charts/Sparkline.tsx` — yutils에서 차용
- `components/charts/CandleChart.tsx` — `dynamic({ssr:false})` + applyOptions(theme)
- `lib/themes.ts`에 `--color-up`/`--color-down` 토큰 추가
- 다크/라이트 모드 전환 시 차트 색 자동 갱신 (matchMedia + applyOptions)

## 참고

- background agent 조사 결과 (`ae40ec78201fce132`)
- yutils `components/Sparkline.tsx`
- [Lightweight Charts v5](https://tradingview.github.io/lightweight-charts/)
