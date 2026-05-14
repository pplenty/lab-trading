import type {Asset, Candle, IndicatorRow} from "@/lib/types";

// Repository 추상화 (컨벤션 R, ADR-0021).
// 페이지 / 백테스트 / 어댑터는 이 인터페이스만 import 한다.
// `lib/db/d1/*` 구현체는 DI 또는 `lib/db/index.ts` 의 factory 로 주입 — 직접 import 금지.
// 다른 SQL DB 로 이주 시 이 인터페이스 구현체만 갈아끼면 됨.
//
// 1차 출시 구현체:
//   - lib/db/d1/asset-repo.ts
//   - lib/db/d1/candle-repo.ts
//   - lib/db/d1/indicator-repo.ts

export interface AssetRepo {
  get(symbol: string): Promise<Asset | null>;
  upsert(asset: Asset): Promise<void>;
  list(opts?: {class?: Asset["class"]; limit?: number}): Promise<Asset[]>;
  searchByName(query: string, limit?: number): Promise<Asset[]>;
}

export type CandleRange = {
  symbol: string;
  /** unix epoch seconds — 시작 (inclusive). */
  from: number;
  /** unix epoch seconds — 끝 (exclusive). */
  to: number;
};

export interface CandleRepo {
  range(opts: CandleRange): Promise<Candle[]>;
  /** UPSERT batch — 중복 (symbol,t) 는 무시 또는 갱신. 컨벤션 R: ON CONFLICT DO UPDATE. */
  upsertMany(symbol: string, rows: Candle[]): Promise<number>;
  /** 마지막 봉 시각 — 백필 진행 추적용 */
  latestT(symbol: string): Promise<number | null>;
}

export interface IndicatorRepo {
  range(opts: CandleRange & {version: number}): Promise<IndicatorRow[]>;
  upsertMany(
    symbol: string,
    version: number,
    rows: IndicatorRow[]
  ): Promise<number>;
  /** 특정 (symbol, version) 의 마지막 t — 재계산 범위 결정에 사용 */
  latestT(symbol: string, version: number): Promise<number | null>;
}
