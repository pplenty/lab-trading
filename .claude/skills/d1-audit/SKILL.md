---
name: d1-audit
description: lab-trading 의 D1 데이터베이스 schema·마이그레이션·backfill 정합성 점검. 80 종목 × 107,677 candles + 26 indicator + news_articles 의 무결성 + Drizzle UPSERT 패턴 + SQL dialect 회피 (ADR R) + KV 캐시 정합. "D1 점검", "schema audit", "마이그레이션 안전성", "backfill 정합", "indicator NULL 검사" 등 트리거.
---

# d1-audit — D1 schema / 마이그레이션 / backfill 정합 점검

## 트리거

- "D1 점검", "schema audit", "마이그레이션 안전성"
- "backfill 누락 종목", "indicator NULL 검사"
- "Drizzle UPSERT 검증", "SQL dialect 점검"
- 새 indicator 추가 (drizzle/0003+ 마이그레이션)
- cron-backfill 또는 cron-news 실패 후
- "Turso / Postgres 마이그레이션 가능성 점검" (CLAUDE.md 컨벤션 R)

## 모드

### Quick (PR마다, 1-2분)

변경된 schema / 마이그레이션 만:
- Drizzle migration up/down idempotent
- 새 컬럼 default 정합 (NULL allowance)
- UPSERT EXCLUDED 패턴 검증

### Standard (주 1회, 5-10분)

전체 정합성:
- 80 종목 × candles 누락 카운트
- 26 indicator NULL 비율 (warmup 부족 vs 진짜 결손)
- news_articles UPSERT 중복 가드
- KV / D1 일관성 (latest quote)

### Comprehensive (분기 1회, 30-60분)

마이그레이션 비용 시뮬레이션:
- D1 → Turso dump + import 시간 측정
- D1 → Postgres dump + import 시간 측정
- 비표준 SQL (`json_extract`, `strftime` 등) grep
- Drizzle 의 sql template 사용처 audit

## 점검 영역

### 1. Schema 정합 (drizzle/schema)

```ts
// lib/db/d1/schema.ts
export const candles = sqliteTable("candles", {
  symbol: text("symbol").notNull(),
  t: integer("t").notNull(),               // unix sec (UTC)
  o: real("o").notNull(),
  h: real("h").notNull(),
  l: real("l").notNull(),
  c: real("c").notNull(),
  v: real("v").notNull(),
}, (t) => [
  primaryKey({ columns: [t.symbol, t.t] }),
  index("idx_candles_symbol_t").on(t.symbol, t.t),  // covering 인덱스
]);
```

검증:
- `t INTEGER` unix sec (string 회피, 검색 시 인덱스 활용)
- 모든 시간 컬럼 UTC (timezone 정보 X)
- 가격 컬럼 `real`, 정수 카운트 컬럼 `integer`
- partial index / expression index 사용 시 SQLite/Postgres 호환 검증

### 2. 마이그레이션 안전성 (drizzle/00XX)

```sql
-- drizzle/0002_add_indicator_phase2.sql
ALTER TABLE indicators ADD COLUMN stoch_k REAL;
ALTER TABLE indicators ADD COLUMN stoch_d REAL;
ALTER TABLE indicators ADD COLUMN cci_20 REAL;
-- ... 9 컬럼 추가
```

검증:
- NULL allowance (기존 row 호환)
- default 가 NULL 또는 합리적 sentinel (e.g. 0 X)
- 인덱스 추가는 별 마이그레이션 (큰 테이블에서 lock 회피)
- DROP COLUMN 회피 (SQLite 의 alter table 한계)
- migration up 후 down rollback 가능성 검증

### 3. UPSERT 패턴 (Drizzle EXCLUDED)

```ts
// 정답
await db.insert(indicators).values(newRows).onConflictDoUpdate({
  target: [indicators.symbol, indicators.t],
  set: {
    sma_5: sql`excluded.sma_5`,            // EXCLUDED 참조
    rsi_14: sql`excluded.rsi_14`,
    // ...
  },
});

// 안티패턴 (Drizzle UPSERT self-ref bug, 2026-05-17 회귀)
set: {
  sma_5: sql`${indicators.sma_5}`,          // self ref → 변경 안 됨
}
```

검증:
- 모든 UPSERT 의 set 절이 `sql\`excluded.<col>\`` 패턴
- `${table.col}` self-ref 패턴 0건

### 4. SQL dialect 회피 (CLAUDE.md 컨벤션 R)

grep 으로 비표준 패턴 검출:

```bash
# SQLite-specific (회피 대상)
grep -rn "INSERT OR REPLACE" src/   # → ON CONFLICT 권장
grep -rn "json_extract" src/        # → application parse
grep -rn "strftime" src/            # → application Date
grep -rn "fts5" src/                # → 별 검색 인덱스 ADR

# Drizzle sql template 사용처 audit
grep -rn "sql\`" src/lib/db/        # raw SQL 노출 (격리 필요)
```

각 매치마다:
- 회피 가능? → 권장 패턴으로 변경 PR
- 불가피? → Repository 추상화 (`lib/db/repos.ts`) 안으로 격리 + 주석

### 5. Backfill 정합

```sql
-- 80 종목 × 영업일 candles 카운트
SELECT 
  symbol, 
  count(*) as candle_count,
  min(t) as first_t,
  max(t) as last_t,
  (max(t) - min(t)) / 86400 as days_span,
  count(*) * 1.0 / ((max(t) - min(t)) / 86400) as fill_rate
FROM candles
GROUP BY symbol
HAVING fill_rate < 0.7 OR candle_count < 100;   -- 채움률 70% 미만 또는 100 봉 미만
```

각 누락:
- 휴장일? → 정상
- 어댑터 실패? → cron 로그 + retry
- registry 종목인데 어댑터에 없음? → registry 또는 어댑터 정합

### 6. Indicator NULL 비율

```sql
-- 각 indicator 의 NULL 비율
SELECT 
  symbol,
  sum(CASE WHEN sma_5 IS NULL THEN 1 ELSE 0 END) * 100.0 / count(*) as sma_5_null_pct,
  sum(CASE WHEN sma_200 IS NULL THEN 1 ELSE 0 END) * 100.0 / count(*) as sma_200_null_pct,
  sum(CASE WHEN rsi_14 IS NULL THEN 1 ELSE 0 END) * 100.0 / count(*) as rsi_14_null_pct
FROM indicators
GROUP BY symbol
HAVING sma_200_null_pct > 5;   -- SMA200 5% 이상 NULL → warmup 부족 아닌 진짜 결손
```

해석:
- SMA(N) NULL = 첫 N−1 봉 (warmup 정상)
- 진짜 결손 = warmup 이후 NULL → recompute-indicators route 호출

### 7. KV / D1 일관성

```ts
// KV 의 latest quote vs D1 의 어제 종가
const kvLatest = await env.KV.get(`quote:${symbol}`);
const d1Latest = await d1Repos.latestCandle(symbol);
const lagSeconds = Math.abs(kvLatest.t - d1Latest.t);
if (lagSeconds > 86400 * 2) {
  warn("KV / D1 lag > 2 days", { symbol, kvLatest, d1Latest });
}
```

KV TTL (5-30분) vs D1 (영구) — 일관성은 eventual, 단 lag 임계 모니터링.

## 마이그레이션 비용 시뮬레이션 (CLAUDE.md 컨벤션 R)

ADR-0021 의 "D1 → Turso 반나절, D1 → Postgres 1주" 상한 검증:

```bash
# D1 dump (production)
wrangler d1 export lab-trading-db --output=/tmp/d1-dump.sql

# 비표준 SQL grep
grep -E "json_extract|strftime|INSERT OR REPLACE|fts5" /tmp/d1-dump.sql | wc -l
# → 0 이어야 (전부 application 또는 Repository 격리)

# 크기 확인
ls -lh /tmp/d1-dump.sql
# → 107,677 candles × 80 종목 × ~50 bytes = ~430 MB 예상
```

크기·비표준 SQL 카운트가 상한 안인지 확인.

## 산출물

- `_workspace/d1-audit-<date>.md`:
  - 누락 카운트 표 (종목 × candles)
  - NULL 비율 표 (종목 × indicator)
  - 비표준 SQL grep 결과
  - 마이그레이션 비용 추정 (Turso / Postgres)
- 발견 시 GitHub issue 또는 recompute-indicators route 호출

## 안티패턴

- ❌ Drizzle UPSERT 의 self-ref (`sql`${table.col}`` 패턴)
- ❌ `INSERT OR REPLACE` 사용 (SQLite-only)
- ❌ `json_extract` raw SQL (application parse 회피)
- ❌ NULL allowance 없이 새 컬럼 추가 (기존 row 호환 깸)
- ❌ DROP COLUMN 시도 (SQLite alter 한계)
- ❌ raw SQL 이 페이지 컴포넌트 안 (Repository 격리 위반)

## 관련 ADR / Patterns

- ADR-0009 — 캐싱 & 스토리지 (KV / D1 / R2)
- ADR-0021 — Historical 데이터 + 지표 저장소
- CLAUDE.md 컨벤션 R — SQL dialect 회피 정책
- [[Patterns/D1 Batch API]] (lab-trading 자산)
- [[Patterns/SQL UPSERT EXCLUDED Reference]] (lab-trading 자산, 2026-05-17 회귀 박제)
- [[Patterns/Quote D1 Fallback]] (lab-trading 자산)
