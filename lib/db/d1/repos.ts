import {and, asc, desc, eq, gte, lt, like, or, sql} from "drizzle-orm";
import type {LabTradingDB} from "./client";
import * as schema from "./schema";
import type {Asset, Candle, IndicatorRow} from "@/lib/types";
import type {
  AssetRepo,
  CandleRange,
  CandleRepo,
  IndicatorRepo,
} from "@/lib/db/repos";

// Repository 인터페이스의 D1 구현체 (ADR-0021, 컨벤션 R).
// 모든 쿼리는 Drizzle ORM — raw SQL 회피.
// UPSERT 는 ON CONFLICT DO UPDATE (sqlite + postgres 공통, 컨벤션 R).

// ──────────────────────────────────────────────────────────────────────────
// AssetRepo

export class D1AssetRepo implements AssetRepo {
  constructor(private db: LabTradingDB) {}

  async get(symbol: string): Promise<Asset | null> {
    const rows = await this.db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.symbol, symbol))
      .limit(1);
    if (rows.length === 0) return null;
    return rowToAsset(rows[0]);
  }

  async upsert(asset: Asset): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.db
      .insert(schema.assets)
      .values({
        symbol: asset.symbol,
        class: asset.class,
        ticker: asset.ticker ?? asset.symbol,
        name: asset.name,
        name_ko: asset.nameKo ?? null,
        currency: asset.currency,
        source: "registry", // 추후 어댑터 식별자로 변경
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: schema.assets.symbol,
        set: {
          name: asset.name,
          name_ko: asset.nameKo ?? null,
          currency: asset.currency,
          updated_at: now,
        },
      });
  }

  async list(opts?: {
    class?: Asset["class"];
    limit?: number;
  }): Promise<Asset[]> {
    const limit = opts?.limit ?? 100;
    const rows = opts?.class
      ? await this.db
          .select()
          .from(schema.assets)
          .where(eq(schema.assets.class, opts.class))
          .limit(limit)
      : await this.db.select().from(schema.assets).limit(limit);
    return rows.map(rowToAsset);
  }

  async searchByName(query: string, limit: number = 10): Promise<Asset[]> {
    const q = `%${query}%`;
    const rows = await this.db
      .select()
      .from(schema.assets)
      .where(or(like(schema.assets.name, q), like(schema.assets.name_ko, q)))
      .limit(limit);
    return rows.map(rowToAsset);
  }
}

function rowToAsset(r: typeof schema.assets.$inferSelect): Asset {
  return {
    class: r.class as Asset["class"],
    symbol: r.symbol,
    ticker: r.ticker,
    name: r.name,
    nameKo: r.name_ko ?? undefined,
    currency: r.currency,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CandleRepo

export class D1CandleRepo implements CandleRepo {
  constructor(private db: LabTradingDB) {}

  async range(opts: CandleRange): Promise<Candle[]> {
    const rows = await this.db
      .select({
        t: schema.candles.t,
        o: schema.candles.o,
        h: schema.candles.h,
        l: schema.candles.l,
        c: schema.candles.c,
        v: schema.candles.v,
      })
      .from(schema.candles)
      .where(
        and(
          eq(schema.candles.symbol, opts.symbol),
          gte(schema.candles.t, opts.from),
          lt(schema.candles.t, opts.to)
        )
      )
      .orderBy(asc(schema.candles.t));
    return rows;
  }

  async upsertMany(symbol: string, candles: Candle[]): Promise<number> {
    if (candles.length === 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    // D1 의 SQL 변수 한도 100 — candles row 는 8 컬럼 → 10 rows/statement.
    // D1 batch API 로 statement N개를 1 round-trip 에 합쳐 remote D1 지연 흡수.
    const ROW_CHUNK = 10;
    const BATCH_MAX = 50; // batch 당 statement 안전 한도
    const stmts = [] as ReturnType<typeof this.buildCandleUpsert>[];
    for (let i = 0; i < candles.length; i += ROW_CHUNK) {
      stmts.push(this.buildCandleUpsert(symbol, candles.slice(i, i + ROW_CHUNK), now));
    }
    for (let i = 0; i < stmts.length; i += BATCH_MAX) {
      const slice = stmts.slice(i, i + BATCH_MAX);
      if (slice.length === 1) {
        await slice[0];
      } else {
        await this.db.batch(slice as [typeof slice[0], ...typeof slice]);
      }
    }
    return candles.length;
  }

  private buildCandleUpsert(symbol: string, slice: Candle[], now: number) {
    return this.db
      .insert(schema.candles)
      .values(
        slice.map((c) => ({
          symbol,
          t: c.t,
          o: c.o,
          h: c.h,
          l: c.l,
          c: c.c,
          v: c.v,
          ingested_at: now,
        }))
      )
      .onConflictDoUpdate({
        target: [schema.candles.symbol, schema.candles.t],
        // UPDATE 분기 EXCLUDED ref — schema.col 은 self-ref 라 무변경 버그 회피.
        set: {
          o: sql`excluded.o`,
          h: sql`excluded.h`,
          l: sql`excluded.l`,
          c: sql`excluded.c`,
          v: sql`excluded.v`,
          ingested_at: now,
        },
      });
  }

  async latestT(symbol: string): Promise<number | null> {
    const rows = await this.db
      .select({t: schema.candles.t})
      .from(schema.candles)
      .where(eq(schema.candles.symbol, symbol))
      .orderBy(desc(schema.candles.t))
      .limit(1);
    return rows.length > 0 ? rows[0].t : null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// IndicatorRepo

export class D1IndicatorRepo implements IndicatorRepo {
  constructor(private db: LabTradingDB) {}

  async range(opts: CandleRange & {version: number}): Promise<IndicatorRow[]> {
    const rows = await this.db
      .select()
      .from(schema.indicators)
      .where(
        and(
          eq(schema.indicators.symbol, opts.symbol),
          eq(schema.indicators.computed_version, opts.version),
          gte(schema.indicators.t, opts.from),
          lt(schema.indicators.t, opts.to)
        )
      )
      .orderBy(asc(schema.indicators.t));
    return rows.map((r) => ({
      t: r.t,
      computed_version: r.computed_version,
      sma_5: r.sma_5 ?? undefined,
      sma_20: r.sma_20 ?? undefined,
      sma_50: r.sma_50 ?? undefined,
      sma_100: r.sma_100 ?? undefined,
      sma_200: r.sma_200 ?? undefined,
      ema_12: r.ema_12 ?? undefined,
      ema_26: r.ema_26 ?? undefined,
      ema_50: r.ema_50 ?? undefined,
      rsi_14: r.rsi_14 ?? undefined,
      macd: r.macd ?? undefined,
      macd_signal: r.macd_signal ?? undefined,
      macd_hist: r.macd_hist ?? undefined,
      bb_upper: r.bb_upper ?? undefined,
      bb_middle: r.bb_middle ?? undefined,
      bb_lower: r.bb_lower ?? undefined,
      atr_14: r.atr_14 ?? undefined,
      vol_sma_20: r.vol_sma_20 ?? undefined,
      stoch_k_14_3: r.stoch_k_14_3 ?? undefined,
      stoch_d_14_3: r.stoch_d_14_3 ?? undefined,
      cci_20: r.cci_20 ?? undefined,
      williams_r_14: r.williams_r_14 ?? undefined,
      adx_14: r.adx_14 ?? undefined,
      di_plus_14: r.di_plus_14 ?? undefined,
      di_minus_14: r.di_minus_14 ?? undefined,
      obv: r.obv ?? undefined,
      roc_12: r.roc_12 ?? undefined,
    }));
  }

  async upsertMany(
    symbol: string,
    version: number,
    rows: IndicatorRow[]
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    // indicators row 는 26 + 3 메타 = 30 컬럼/row. D1 변수 한도 100 / 30 = 3.3.
    // 3 rows/statement = 90 변수 안전 마진.
    // BATCH_MAX 200 — 1826 candle 의 ~610 statement 를 round-trip 3-4회로 묶어
    // Workers 30s wall time hit 회피 (큰 KR 종목 timeout 우회).
    const ROW_CHUNK = 3;
    const BATCH_MAX = 200;
    const stmts = [] as ReturnType<typeof this.buildIndicatorUpsert>[];
    for (let i = 0; i < rows.length; i += ROW_CHUNK) {
      stmts.push(
        this.buildIndicatorUpsert(symbol, version, rows.slice(i, i + ROW_CHUNK), now)
      );
    }
    for (let i = 0; i < stmts.length; i += BATCH_MAX) {
      const slice = stmts.slice(i, i + BATCH_MAX);
      if (slice.length === 1) {
        await slice[0];
      } else {
        await this.db.batch(slice as [typeof slice[0], ...typeof slice]);
      }
    }
    return rows.length;
  }

  private buildIndicatorUpsert(
    symbol: string,
    version: number,
    slice: IndicatorRow[],
    now: number
  ) {
    return this.db
      .insert(schema.indicators)
      .values(
        slice.map((r) => ({
          symbol,
          t: r.t,
          computed_version: version,
          sma_5: r.sma_5 ?? null,
          sma_20: r.sma_20 ?? null,
          sma_50: r.sma_50 ?? null,
          sma_100: r.sma_100 ?? null,
          sma_200: r.sma_200 ?? null,
          ema_12: r.ema_12 ?? null,
          ema_26: r.ema_26 ?? null,
          ema_50: r.ema_50 ?? null,
          rsi_14: r.rsi_14 ?? null,
          macd: r.macd ?? null,
          macd_signal: r.macd_signal ?? null,
          macd_hist: r.macd_hist ?? null,
          bb_upper: r.bb_upper ?? null,
          bb_middle: r.bb_middle ?? null,
          bb_lower: r.bb_lower ?? null,
          atr_14: r.atr_14 ?? null,
          vol_sma_20: r.vol_sma_20 ?? null,
          stoch_k_14_3: r.stoch_k_14_3 ?? null,
          stoch_d_14_3: r.stoch_d_14_3 ?? null,
          cci_20: r.cci_20 ?? null,
          williams_r_14: r.williams_r_14 ?? null,
          adx_14: r.adx_14 ?? null,
          di_plus_14: r.di_plus_14 ?? null,
          di_minus_14: r.di_minus_14 ?? null,
          obv: r.obv ?? null,
          roc_12: r.roc_12 ?? null,
          computed_at: now,
        }))
      )
      .onConflictDoUpdate({
        target: [schema.indicators.symbol, schema.indicators.t],
        // UPSERT 의 UPDATE 분기 — INSERT 시도된 값으로 모두 덮어씀 (EXCLUDED).
        // `schema.col` reference 는 self-ref (무변경) 라 신규 컬럼이 NULL 로 남던 버그.
        set: {
          computed_version: version,
          sma_5: sql`excluded.sma_5`,
          sma_20: sql`excluded.sma_20`,
          sma_50: sql`excluded.sma_50`,
          sma_100: sql`excluded.sma_100`,
          sma_200: sql`excluded.sma_200`,
          ema_12: sql`excluded.ema_12`,
          ema_26: sql`excluded.ema_26`,
          ema_50: sql`excluded.ema_50`,
          rsi_14: sql`excluded.rsi_14`,
          macd: sql`excluded.macd`,
          macd_signal: sql`excluded.macd_signal`,
          macd_hist: sql`excluded.macd_hist`,
          bb_upper: sql`excluded.bb_upper`,
          bb_middle: sql`excluded.bb_middle`,
          bb_lower: sql`excluded.bb_lower`,
          atr_14: sql`excluded.atr_14`,
          vol_sma_20: sql`excluded.vol_sma_20`,
          stoch_k_14_3: sql`excluded.stoch_k_14_3`,
          stoch_d_14_3: sql`excluded.stoch_d_14_3`,
          cci_20: sql`excluded.cci_20`,
          williams_r_14: sql`excluded.williams_r_14`,
          adx_14: sql`excluded.adx_14`,
          di_plus_14: sql`excluded.di_plus_14`,
          di_minus_14: sql`excluded.di_minus_14`,
          obv: sql`excluded.obv`,
          roc_12: sql`excluded.roc_12`,
          computed_at: now,
        },
      });
  }

  async latestT(symbol: string, version: number): Promise<number | null> {
    const rows = await this.db
      .select({t: schema.indicators.t})
      .from(schema.indicators)
      .where(
        and(
          eq(schema.indicators.symbol, symbol),
          eq(schema.indicators.computed_version, version)
        )
      )
      .orderBy(desc(schema.indicators.t))
      .limit(1);
    return rows.length > 0 ? rows[0].t : null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// NewsRepo (ADR-0008)

export type NewsArticleRow = typeof schema.news_articles.$inferSelect;

export class D1NewsRepo {
  constructor(private db: LabTradingDB) {}

  /**
   * 매체 fetch 결과 일괄 UPSERT.
   * url_hash 기준 중복 — 같은 article 재fetch 시 published_at/title 갱신 (매체가 본문 수정한 경우 추적).
   */
  async upsertMany(
    articles: Array<{
      url: string;
      url_hash: string;
      title: string;
      summary: string | null;
      published_at: number;
      source: string;
      source_key: string;
      asset_classes: string[]; // csv 로 직렬화
      keywords?: string[] | null;
    }>
  ): Promise<number> {
    if (articles.length === 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    // news_articles 10 컬럼 × ROW_CHUNK 10 = 100 변수 = D1 한도 hit.
    // 9 로 줄여 90 변수 — 안전 마진.
    const ROW_CHUNK = 9;
    const BATCH_MAX = 50;
    const stmts = [];
    for (let i = 0; i < articles.length; i += ROW_CHUNK) {
      const slice = articles.slice(i, i + ROW_CHUNK);
      stmts.push(
        this.db
          .insert(schema.news_articles)
          .values(
            slice.map((a) => ({
              url_hash: a.url_hash,
              url: a.url,
              source: a.source,
              source_key: a.source_key,
              title: a.title,
              summary: a.summary,
              published_at: a.published_at,
              fetched_at: now,
              asset_classes: a.asset_classes.join(","),
              keywords: a.keywords?.join(",") ?? null,
            }))
          )
          .onConflictDoUpdate({
            target: schema.news_articles.url_hash,
            set: {
              title: schema.news_articles.title,
              summary: schema.news_articles.summary,
              published_at: schema.news_articles.published_at,
              fetched_at: now,
              asset_classes: schema.news_articles.asset_classes,
            },
          })
      );
    }
    for (let i = 0; i < stmts.length; i += BATCH_MAX) {
      const slice = stmts.slice(i, i + BATCH_MAX);
      if (slice.length === 1) await slice[0];
      else await this.db.batch(slice as [typeof slice[0], ...typeof slice]);
    }
    return articles.length;
  }

  /**
   * 특정 자산군 최근 N article. asset_classes csv 안에 cls 포함된 row 만.
   * SQLite LIKE 라 정확한 토큰 매칭이 아닌 prefix match — `${cls},` / `,${cls}` / `${cls}` 단일 / `,${cls},`.
   * 자산군 식별자가 prefix overlap 없는 단어라 충돌 X (`crypto` ⊄ `us`).
   */
  async listByAsset(asset: string, limit: number = 30): Promise<NewsArticleRow[]> {
    const pattern = `%${asset}%`;
    return await this.db
      .select()
      .from(schema.news_articles)
      .where(like(schema.news_articles.asset_classes, pattern))
      .orderBy(desc(schema.news_articles.published_at))
      .limit(limit);
  }

  async listLatest(limit: number = 50): Promise<NewsArticleRow[]> {
    return await this.db
      .select()
      .from(schema.news_articles)
      .orderBy(desc(schema.news_articles.published_at))
      .limit(limit);
  }

  /**
   * 종목 keyword 기반 검색 — title OR summary LIKE 매칭 (OR 합집합).
   * asset_classes 도 같이 필터해 다른 자산군 노이즈 제거.
   */
  async listBySymbol(opts: {
    asset: string;
    keywords: string[];
    limit?: number;
  }): Promise<NewsArticleRow[]> {
    if (opts.keywords.length === 0) return [];
    const assetPattern = `%${opts.asset}%`;
    // 각 키워드 × (title OR summary) = N*2 OR — 최대 50개 keyword 정도까지 합리적.
    const matchers = opts.keywords.flatMap((k) => {
      const p = `%${k}%`;
      return [
        like(schema.news_articles.title, p),
        like(schema.news_articles.summary, p),
      ];
    });
    return await this.db
      .select()
      .from(schema.news_articles)
      .where(
        and(
          like(schema.news_articles.asset_classes, assetPattern),
          or(...matchers)
        )
      )
      .orderBy(desc(schema.news_articles.published_at))
      .limit(opts.limit ?? 10);
  }

  async count(): Promise<number> {
    const rows = await this.db
      .select({n: schema.news_articles.url_hash})
      .from(schema.news_articles);
    return rows.length;
  }
}
