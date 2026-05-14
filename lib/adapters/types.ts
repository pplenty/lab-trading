import type {
  Asset,
  AssetClass,
  CandleSeries,
  GetCandlesOpts,
  ListAssetsOpts,
  ListQuotesOpts,
  Quote,
  RankingKind,
  Symbol,
} from "@/lib/types";

// DataAdapter — 자산군별 데이터 소스 어댑터 공통 인터페이스 (ADR-0010).
// 어댑터는 외부 API raw 응답을 받아 normalize 해 공통 타입으로 반환한다.
// 페이지·차트·백테스트 코드는 어댑터 구현 무지 — 이 인터페이스만 의존.
//
// 모든 어댑터는 Cloudflare Workers `fetch()` 호환이어야 한다 (Node 전용 SDK 금지).
export interface DataAdapter {
  /** 어댑터 식별자 — 캐시 키 prefix · 출처 라벨 · `Quote.source` 값. */
  readonly id: string;
  /** 어댑터가 다루는 자산군. CoinGecko 처럼 단일, 또는 멀티-asset 확장 시 복수. */
  readonly classes: AssetClass[];

  listAssets(opts?: ListAssetsOpts): Promise<Asset[]>;
  getAsset(symbol: Symbol): Promise<Asset | null>;

  getQuote(symbol: Symbol): Promise<Quote>;
  listQuotes(opts?: ListQuotesOpts): Promise<Quote[]>;

  getCandles(symbol: Symbol, opts: GetCandlesOpts): Promise<CandleSeries>;

  /** 일부 어댑터만 구현 (capability flag). 미구현 시 listQuotes + sort 로 폴백. */
  rankings?(
    kind: RankingKind,
    opts?: ListQuotesOpts
  ): Promise<Quote[]>;
}
