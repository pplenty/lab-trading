---
name: new-adapter
description: lab-trading 에 새 데이터 어댑터를 추가한다. lib/adapters/<provider>.ts contract 구현, callXxx helper, rate-limit 처리, status:"error" 분기, KV 토큰 캐시, lib/data/*.ts fallback 통합, backfill route + cron 통합, ADR 작성까지 5-Phase 순차. "어댑터 추가", "CCXT 통합", "Polygon/Tiingo/Naver 어댑터", "<provider> 데이터 연동" 등 트리거. data-adapter-engineer 위임.
---

# new-adapter — lab-trading 어댑터 추가 5-Phase 파이프라인

## 트리거

- "새 어댑터 추가" / "<provider> 통합"
- 구체 제공자명 + "추가": "CCXT", "Polygon", "Tiingo", "Naver 금융", "FRED"
- 사용자 자율 진행 시 ADR-0005/0006/0007 변경 또는 부수적 데이터 소스 도입

## Phase 0 — 컨텍스트 확인 + ADR

`data-adapter-engineer` 에이전트가 다음 결정:
- 무료 한도 / 유료 단계
- 한국 법적 위험 (특히 주식 호가창 / 실시간 단가)
- 기존 어댑터와 중복 (예: Upbit 이미 있는데 Binance KRW 페어 추가 사유)
- 어댑터 ID (`provider` 슬러그) + 자산군 매핑

ADR 작성 (`adr-new` 스킬 호출):
- ADR-XXXX-<provider>-adapter.md
- 사유 / 한도 / 대안 비교 / 결정

## Phase 1 — Contract 구현

`lib/adapters/<provider>.ts`:

```ts
import type { DataAdapter, Quote, Candle } from "@/lib/types";

// 1. callXxx helper — 모든 외부 호출 단일 경유
async function callProvider<T>(endpoint: string, params: Record<string, unknown>): Promise<CallResult<T>> {
  // discriminated union 응답
  // rate-limit (sleep)
  // status:"error" 분기
}

// 2. DataAdapter 구현
export const providerAdapter: DataAdapter = {
  class: "crypto" /* 또는 "us" / "kr" */,
  async listQuotes(opts) { ... },
  async getQuote(symbol) { ... },
  async getCandles(symbol, opts) { ... },
  async rankings(kind) { ... },
};

// 3. (선택) OAuth 토큰 캐시 (KIS 패턴)
async function getProviderToken(env: Env): Promise<string> { ... }
```

**필수 패턴**:
- Discriminated union API Error Response — 모든 함수 `CallResult<T>` 반환 또는 정규화 후 throw
- Rate-limit sleep — 무료 한도 안전 마진 (~80%)
- 정규화: 가격 → number (string 회피), 시간 → unix sec (UTC, ms 회피), 통화 → 명시 currency code

## Phase 2 — Vitest unit test

```ts
// lib/adapters/<provider>.test.ts
import { describe, it, expect, vi } from "vitest";

describe("<provider> adapter", () => {
  it("listQuotes — happy path", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(MOCK_QUOTES_OK)));
    const quotes = await providerAdapter.listQuotes();
    expect(quotes).toHaveLength(...);
    expect(quotes[0]).toMatchObject({ symbol: ..., price: expect.any(Number) });
  });

  it("getCandles — status:'error' 분기", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "error", message: "..." })));
    await expect(providerAdapter.getCandles("BTC", { tf: "1d" })).rejects.toThrow(/status:error/);
    // 또는 빈 배열 반환 (정책에 따라)
  });

  it("rate-limit — sleep 적용", async () => {
    // sleep 호출 검증
  });
});
```

**최소 5 케이스**: listQuotes happy / getQuote happy / getCandles happy / status:"error" / rate-limit. Vitest 98 → 103 (5 추가).

## Phase 3 — D1 / KV 통합

`lib/data/{quotes,candles,indicators}.ts` 의 fallback 분기 추가:

```ts
export async function loadQuote(asset: AssetClass, symbol: string): Promise<Quote> {
  if (asset === "crypto" && /* new provider 도메인 */) {
    // 1순위: 새 어댑터 live
    try { return await providerAdapter.getQuote(symbol); }
    catch (e) {
      // 2순위: D1 archive (어제 종가)
      const cached = await d1Repos.latestQuote(symbol);
      if (cached) return { ...cached, isFallback: true };
      throw e;
    }
  }
  // ... 기존 분기
}
```

D1FallbackBadge UI 가 자동 표시 (isFallback flag).

## Phase 4 — Backfill + cron

`app/api/backfill/route.ts` + `lib/backfill/run.ts` 의 어댑터 분기 추가:

```ts
const adapter = ADAPTERS[asset];  // 등록
const candles = await adapter.getCandles(symbol, { tf: "1d", from, to });
await d1Repos.upsertCandles(symbol, candles);

// indicator 사전계산
const indicators = computeIndicators(candles);
await d1Repos.upsertIndicators(symbol, indicators);
```

`symbols/registry.ts` 갱신 (새 종목이라면).

cron-backfill.yml 점검 — 새 어댑터의 종목이 매일 06:00 UTC backfill 에 포함되는지.

## Phase 5 — Health + RUN_PLAYBOOK

`/api/health` 응답에 어댑터 freshness 노출:

```json
{
  "adapters": {
    "<provider>": {
      "lastSuccess": "2026-05-22T06:01:34Z",
      "lastFailure": null,
      "errorRate24h": 0.0
    }
  }
}
```

`docs/RUN_PLAYBOOK.md` 갱신:
- 어댑터 추가 절차 (이번 PR 박제)
- 어댑터 별 무료 한도 표
- 어댑터 별 키 발급 절차 (env var 명)
- 어댑터 실패 시 fallback 정책

## 산출물

- `lib/adapters/<provider>.ts` + `.test.ts`
- `lib/data/{quotes,candles,indicators}.ts` 의 fallback 분기
- `lib/symbols/registry.ts` (새 종목 추가 시)
- `app/api/backfill/route.ts` 분기
- `app/api/health/route.ts` 어댑터 noted
- ADR-XXXX-<provider>-adapter.md
- `docs/RUN_PLAYBOOK.md` 어댑터 섹션
- env var `.env.example` 추가

## 안티패턴 (data-adapter-engineer 와 짝)

- ❌ 어댑터 함수 내부에서 throw (discriminated union 의무)
- ❌ rate-limit 무시 → 429 폭주
- ❌ OAuth 매 요청 발급 (KV 캐시 필수)
- ❌ raw fetch 직접 호출 (callXxx helper 의무)
- ❌ test 5 케이스 미만 (status:"error" 분기 누락 회귀 위험)

## 관련 자산

- 에이전트: `data-adapter-engineer`
- ADR-0005 / 0006 / 0007 / 0009 / 0010
- [[Patterns/Discriminated Union API Error Response]] (lab-trading 자산)
- [[Patterns/KV-Backed OAuth Token Cache]] (lab-trading 자산)
- [[Patterns/Partial-Success Backfill]] (lab-trading 자산)
