import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// ADR-0021 historical 저장소 첫 스키마.
// 컨벤션 R 엄수: SQLite-specific SQL 회피. `INSERT OR REPLACE` 대신 `ON CONFLICT DO UPDATE`,
// `json_extract` / `strftime` / FTS5 미사용, partial / expression index 만 사용.
// 표준 SQL 만 사용해 마이그레이션 비용 상한 1주 (Postgres 기준) 보장.
//
// 시간은 모두 unix epoch seconds INTEGER. 표시 시점에 Intl 변환 (컨벤션 M).

/** 자산 메타데이터 — 자산군별 종목 마스터 테이블. */
export const assets = sqliteTable(
  "assets",
  {
    /** normalize 된 사이트 슬러그. PK. `crypto:btc`, `us:aapl`, `kr:005930` */
    symbol: text("symbol").primaryKey(),
    /** AssetClass — `crypto` | `us` | `kr` */
    class: text("class").notNull(),
    /** 거래소 공식 티커 (원본) */
    ticker: text("ticker").notNull(),
    /** 종목 정식명 (원본 표기 그대로) */
    name: text("name").notNull(),
    /** 한글 alias (검색용 — ADR-0022). nullable. */
    name_ko: text("name_ko"),
    /** 현지 통화 코드 (`USD`, `KRW`, etc) */
    currency: text("currency").notNull(),
    /** 데이터 출처 어댑터 식별자 (`coingecko`, `twelve-data`, etc) */
    source: text("source").notNull(),
    /** 메타 갱신 시점 — unix epoch seconds */
    updated_at: integer("updated_at").notNull(),
  },
  (t) => ({
    classIdx: index("assets_class_idx").on(t.class),
    tickerIdx: index("assets_ticker_idx").on(t.ticker),
  })
);

/** 일봉 OHLCV — wide format. (symbol, t) PK. */
export const candles = sqliteTable(
  "candles",
  {
    symbol: text("symbol").notNull(),
    /** 봉 시작 시각 (unix epoch seconds, UTC). 일봉이면 거래일 00:00 KST 또는 거래소 표준. */
    t: integer("t").notNull(),
    o: real("o").notNull(),
    h: real("h").notNull(),
    l: real("l").notNull(),
    c: real("c").notNull(),
    v: real("v").notNull(),
    /** 적재 시각 (unix epoch seconds) — 백필 / 정합성 추적용 */
    ingested_at: integer("ingested_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({columns: [t.symbol, t.t]}),
    tIdx: index("candles_t_idx").on(t.t),
  })
);

/** 사전계산 지표 17종 — wide format. candles 1:1, (symbol, t) PK. ADR-0021. */
export const indicators = sqliteTable(
  "indicators",
  {
    symbol: text("symbol").notNull(),
    t: integer("t").notNull(),
    /** 결정론 보장 — 지표 계산 로직 버전. 같은 t/symbol 이라도 다른 version 은 재계산 필요. */
    computed_version: integer("computed_version").notNull(),
    sma_5: real("sma_5"),
    sma_20: real("sma_20"),
    sma_50: real("sma_50"),
    sma_100: real("sma_100"),
    sma_200: real("sma_200"),
    ema_12: real("ema_12"),
    ema_26: real("ema_26"),
    ema_50: real("ema_50"),
    rsi_14: real("rsi_14"),
    macd: real("macd"),
    macd_signal: real("macd_signal"),
    macd_hist: real("macd_hist"),
    bb_upper: real("bb_upper"),
    bb_middle: real("bb_middle"),
    bb_lower: real("bb_lower"),
    atr_14: real("atr_14"),
    vol_sma_20: real("vol_sma_20"),
    computed_at: integer("computed_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({columns: [t.symbol, t.t]}),
  })
);

/** 백필 이력 로그 — 어댑터별 어떤 범위를 언제 채웠는지 추적. */
export const backfill_log = sqliteTable(
  "backfill_log",
  {
    id: integer("id").primaryKey({autoIncrement: true}),
    symbol: text("symbol").notNull(),
    /** 채운 범위 시작 (unix epoch seconds) */
    from_t: integer("from_t").notNull(),
    to_t: integer("to_t").notNull(),
    rows_inserted: integer("rows_inserted").notNull(),
    /** `candles` | `indicators` */
    target: text("target").notNull(),
    source: text("source").notNull(),
    started_at: integer("started_at").notNull(),
    completed_at: integer("completed_at"),
    /** 실패 시 메시지. 성공이면 null. */
    error: text("error"),
  },
  (t) => ({
    symbolIdx: index("backfill_symbol_idx").on(t.symbol),
    startedIdx: index("backfill_started_idx").on(t.started_at),
  })
);

/**
 * 뉴스 article — RSS 어댑터가 fetch 한 뒤 정규화해 누적 (ADR-0008).
 * PK = url_hash (URL 의 sha256 앞 16자 등). source + url 조합 대신 url 단독 — 같은 article 이 매체 cross-post 시 분리.
 * asset_classes: "kr" / "us" / "crypto" / 또는 csv ("kr,crypto") — 매체 디폴트 + 키워드 분석.
 */
export const news_articles = sqliteTable(
  "news_articles",
  {
    url_hash: text("url_hash").primaryKey(),
    url: text("url").notNull(),
    source: text("source").notNull(),       // 사람 친화 — "한국경제" / "매일경제"
    source_key: text("source_key").notNull(), // slug — "hankyung-stock" / "mk-stock"
    title: text("title").notNull(),
    summary: text("summary"),
    published_at: integer("published_at").notNull(), // unix sec
    fetched_at: integer("fetched_at").notNull(),
    asset_classes: text("asset_classes").notNull(),  // csv: "kr", "us,crypto"
    keywords: text("keywords"),                       // csv (제목 분석 추출, 선택)
  },
  (t) => ({
    publishedIdx: index("news_published_idx").on(t.published_at),
    sourceIdx: index("news_source_idx").on(t.source_key),
  })
);
