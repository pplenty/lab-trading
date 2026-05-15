import {and, asc, eq, gte, lt, like, or} from "drizzle-orm";
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
    // D1 (SQLite) 의 SQLITE_MAX_VARIABLE_NUMBER 가 100 인 환경 있음 — 50 봉씩 청크.
    const CHUNK = 50;
    let inserted = 0;
    for (let i = 0; i < candles.length; i += CHUNK) {
      const slice = candles.slice(i, i + CHUNK);
      await this.db
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
      inserted += slice.length;
    }
    return inserted;
  }

  async latestT(symbol: string): Promise<number | null> {
    const rows = await this.db
      .select({t: schema.candles.t})
      .from(schema.candles)
      .where(eq(schema.candles.symbol, symbol))
      .orderBy(asc(schema.candles.t))
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
    const CHUNK = 30;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      await this.db
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
      inserted += slice.length;
    }
    return inserted;
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
      .orderBy(asc(schema.indicators.t))
      .limit(1);
    return rows.length > 0 ? rows[0].t : null;
  }
}
