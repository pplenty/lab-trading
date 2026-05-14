import type {
  AssetClass,
  Candle,
  CandleOpts,
  ListOpts,
  Quote,
  RankingKind,
} from "@/lib/types";

// DataAdapter — 자산군별 데이터 소스 어댑터 공통 인터페이스 (ADR-0010).
// 어댑터는 외부 API raw 응답을 받아 `Quote` / `Candle` 로 normalize 해 반환한다.
// 페이지 / 백테스트 코드는 어댑터 구현 무지 — 이 인터페이스만 의존.
//
// 1차 출시 구현체:
//   - lib/adapters/coingecko.ts  (crypto, 글로벌 랭킹 + 메타)
//   - lib/adapters/upbit.ts      (crypto, KRW 페어 시세)
//   - lib/adapters/binance.ts    (crypto, 글로벌 페어 + 일봉 historical)
//   - lib/adapters/twelve-data.ts (us, 시세 + 랭킹 + 일봉 historical)
// Phase 1.5 구현체:
//   - lib/adapters/kis.ts, krx.ts, data-go-kr.ts, opendart.ts (kr)
//
// 모든 어댑터는 Cloudflare Workers `fetch()` 호환이어야 한다 (Node 전용 SDK 금지).
export interface DataAdapter {
  /** 어댑터가 다루는 자산군. 어댑터 1개는 정확히 1개 자산군에만 속한다. */
  readonly class: AssetClass;
  /** 어댑터 식별자 — 캐시 키 prefix · 데이터 출처 라벨에 사용 */
  readonly source: string;

  /** 자산군 ticker 리스트 (랭킹 / 시세 인덱스). */
  listQuotes(opts?: ListOpts): Promise<Quote[]>;
  /** 단일 종목 현재 시세. */
  getQuote(symbol: string): Promise<Quote>;
  /** 일봉 historical — 백테스트와 차트가 의존. */
  getCandles(symbol: string, opts: CandleOpts): Promise<Candle[]>;
  /** 랭킹 (gainers / losers / volume). 어댑터에 따라 단일 API 또는 listQuotes sort. */
  rankings(kind: RankingKind, opts?: ListOpts): Promise<Quote[]>;
}
