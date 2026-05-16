import {and, asc, desc, eq, gte, lt, like, or} from "drizzle-orm";
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
        set: {
          o: schema.candles.o,
          h: schema.candles.h,
          l: schema.candles.l,
          c: schema.candles.c,
          v: schema.candles.v,
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
    }));
  }

  async upsertMany(
    symbol: string,
    version: number,
    rows: IndicatorRow[]
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    // indicators row 는 21 컬럼 → 4 rows/statement. batch 로 round-trip 합침.
    const ROW_CHUNK = 4;
    const BATCH_MAX = 50;
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
          computed_at: now,
        }))
      )
      .onConflictDoUpdate({
        target: [schema.indicators.symbol, schema.indicators.t],
        set: {
          computed_version: version,
          sma_5: schema.indicators.sma_5,
          sma_20: schema.indicators.sma_20,
          sma_50: schema.indicators.sma_50,
          sma_100: schema.indicators.sma_100,
          sma_200: schema.indicators.sma_200,
          ema_12: schema.indicators.ema_12,
          ema_26: schema.indicators.ema_26,
          ema_50: schema.indicators.ema_50,
          rsi_14: schema.indicators.rsi_14,
          macd: schema.indicators.macd,
          macd_signal: schema.indicators.macd_signal,
          macd_hist: schema.indicators.macd_hist,
          bb_upper: schema.indicators.bb_upper,
          bb_middle: schema.indicators.bb_middle,
          bb_lower: schema.indicators.bb_lower,
          atr_14: schema.indicators.atr_14,
          vol_sma_20: schema.indicators.vol_sma_20,
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
    const ROW_CHUNK = 10;
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

  async count(): Promise<number> {
    const rows = await this.db
      .select({n: schema.news_articles.url_hash})
      .from(schema.news_articles);
    return rows.length;
  }
}
