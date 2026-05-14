# ADR-0021: Historical 데이터 + 지표 저장소

- 상태: Accepted
- 날짜: 2026-05-13
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0009 (캐시), ADR-0019 (백테스트 엔진), ADR-0010 (데이터 모델), ADR-0016 (사용자 데이터)

## 컨텍스트

ADR-0009(KV/Cache)는 짧은 TTL 캐시만 다뤘고, ADR-0019(백테스트 엔진)는 클라이언트 즉석 계산만 다뤘다. 그러나 다음 두 요구가 빠져 있다:

1. **일봉 historical OHLCV의 영구 저장** — 백테스트는 5-10년 historical을 반복 fetch해야 하는데 외부 API 한도(CoinGecko 10K/mo, Twelve Data 800/day)로는 불가능하다. 한 번 받아온 봉은 영구 보존이 합리적.
2. **지표 사전계산 + 검증** — 백테스트 결과의 결정론성·정확성을 위해 SMA/EMA/RSI/MACD/BB/ATR 같은 핵심 지표를 미리 계산해 저장. TradingView/Investing 같은 외부 도구와 cross-check 가능.

추가로 사용자 우려: **다른 DB로 마이그레이션이 수월한가?** lock-in 위험은 클라우드 DB 선택에서 핵심 변수.

### 사이즈 추정

| 시나리오 | candles rows | candles raw | indicators raw | 합 raw | 합 압축 |
|---|---|---|---|---|---|
| **Phase 1 (인기 종목 sparse)** — 코인 300 + 미국 300 + 한국 300, 평균 5년 | 1.0M | ~50 MB | ~135 MB | 185 MB | **~80 MB** |
| **Phase 2 (전체 추적)** — 코인 2000 + 미국 5000 + 한국 3000, 평균 10년 | 24M | ~1.2 GB | ~3.2 GB | 4.4 GB | **~1.8 GB** |
| **Phase 3 (15년+ 누적)** | 36M | ~1.7 GB | ~4.8 GB | 6.5 GB | **~2.5 GB** |

증분: ~10K rows/day, candles ~500 KB + indicators ~1.4 MB → **~2 MB/day raw**.

지표 17개 wide table 기준 (row당 약 135 bytes — SMA 5종 + EMA 3종 + RSI + MACD 3 + BB 3 + ATR + VolSMA).

### 후보 DB

| 후보 | 무료 한도 | 쿼리 모델 | Workers 통합 | Phase 2 (~2 GB)? | Phase 3 (~2.5 GB)? |
|---|---|---|---|---|---|
| **Cloudflare D1** (SQLite) | **5 GB**, 100K writes/day, 5M reads/day | SQL | 네이티브 binding | ✅ 무료 | ✅ 무료 |
| **Cloudflare R2** (오브젝트) | 10 GB, egress 무료 | 파일 (csv/parquet) | 네이티브 | ✅ (백업 용도) | ✅ |
| **Cloudflare KV** | 1 GB, value max 25 MB | 키-값 | 네이티브 | ❌ (range query 불가) | ❌ |
| **Cloudflare DO + SQLite** | Workers 포함, DO 유료 | SQL | 네이티브 | ✅ (유료 플랜 후) | ✅ |
| **Turso (libSQL)** | 9 GB, 1B row reads/mo | SQL (SQLite 호환) | HTTP API | ✅ 무료 | ✅ 무료 |
| **Neon (Postgres)** | 0.5 GB | SQL (Postgres) | HTTP | ❌ | ❌ |
| **Supabase (Postgres)** | 500 MB | SQL + Auth + Storage | HTTP | ❌ | ❌ |
| **PlanetScale (MySQL)** | 무료 hobby 폐지 | MySQL Vitess | HTTP | 유료 시작 $39/mo | 유료 |
| **MongoDB Atlas** | 512 MB | NoSQL | HTTP | ❌ | ❌ |
| **InfluxDB Cloud** | 30일 retention | 시계열 | HTTP | ❌ | ❌ |

## 검토한 옵션

### A. Cloudflare D1 + Repository 추상화 + Drizzle ORM + 주간 R2 백업
- 장점: Workers 네이티브 binding으로 latency 최저. SQLite 표준이라 lock-in 매우 낮음. 5 GB 무료 한도가 Phase 3까지 커버. Drizzle ORM이 dialect 추상화 + 마이그레이션 도구 제공.
- 단점: D1은 single-region writes(현재) — 한국에서 매우 먼 PoP에서 write latency 발생 가능. 1차 출시 트래픽엔 무관.

### B. Turso 단독
- 장점: 9 GB 무료, edge-distributed replicas, SQLite 호환.
- 단점: Workers 네이티브 binding 없음(HTTP). 토큰 관리 추가. CF 생태계 통합 약함.

### C. R2에 parquet 파일 단독
- 장점: 비용 최저, 대용량 데이터 적합.
- 단점: 행 단위 query 어려움. 종목·기간별 fetch에 비효율. 인덱스 직접 관리.

### D. DO + SQLite
- 장점: DO마다 자체 SQLite, 강한 일관성.
- 단점: DO 유료 플랜. 1차 출시 과한 인프라. 종목당 DO인지 자산군당 DO인지 설계 부담.

### E. 외부 Postgres (Neon/Supabase)
- 장점: 풍부한 기능, SQL 표준.
- 단점: 무료 한도 작음 (0.5 GB). Workers↔외부 호스트 latency.

## 결정

**옵션 A 채택 권장 (Cloudflare D1 + Drizzle ORM + Repository 추상화 + 주간 R2 백업).**

근거:
1. Phase 3까지 무료 한도(5 GB) 안에 들어옴.
2. Workers 네이티브 binding으로 어댑터·페이지 코드 단순.
3. SQLite 표준 → lock-in 매우 낮음 (`wrangler d1 export` 한 줄로 표준 SQL dump).
4. Drizzle ORM이 dialect 추상화 + migration 도구 제공 → 추후 Turso/Postgres 이주 시 1주 내 가능.
5. R2 주간 백업으로 D1 자체 장애 대비 + 마이그레이션 시 기준 dump.

### 잠금 항목

#### 스키마 (D1)

원본 OHLCV(불변)과 derived 지표(재계산 가능)를 별도 테이블로 분리:

```sql
-- 원본 (불변, 데이터 소스가 진실)
CREATE TABLE candles (
  class TEXT NOT NULL,                -- 'crypto' | 'us' | 'kr'
  symbol TEXT NOT NULL,               -- 'btc' | 'aapl' | '005930'
  tf TEXT NOT NULL DEFAULT '1d',      -- '1d' | '1w' | '1mo'
  t INTEGER NOT NULL,                 -- unix epoch sec (UTC 자정)
  o REAL NOT NULL,
  h REAL NOT NULL,
  l REAL NOT NULL,
  c REAL NOT NULL,
  v REAL NOT NULL,
  source TEXT NOT NULL,               -- 어댑터 식별자
  ingested_at INTEGER NOT NULL,
  PRIMARY KEY (class, symbol, tf, t)
);
CREATE INDEX idx_candles_recent ON candles(class, symbol, tf, t DESC);

-- 지표 (derived, wide format) — 1:1 with candles
CREATE TABLE indicators (
  class TEXT NOT NULL,
  symbol TEXT NOT NULL,
  tf TEXT NOT NULL DEFAULT '1d',
  t INTEGER NOT NULL,
  sma_5 REAL, sma_20 REAL, sma_50 REAL, sma_100 REAL, sma_200 REAL,
  ema_12 REAL, ema_26 REAL, ema_50 REAL,
  rsi_14 REAL,
  macd_line REAL, macd_signal REAL, macd_hist REAL,
  bb_upper REAL, bb_mid REAL, bb_lower REAL,    -- n=20, k=2
  atr_14 REAL,
  vol_sma_20 REAL,
  computed_at INTEGER NOT NULL,
  computed_version INTEGER NOT NULL,           -- 지표 계산 로직 버전
  PRIMARY KEY (class, symbol, tf, t)
);

-- 자산 마스터
CREATE TABLE assets (
  class TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ko TEXT,
  ticker TEXT,
  market TEXT,
  currency TEXT NOT NULL,
  logo_url TEXT,
  meta_json TEXT,                              -- 자산군별 확장 필드 (보수적으로만)
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (class, symbol)
);
CREATE INDEX idx_assets_name ON assets(name);
CREATE INDEX idx_assets_name_ko ON assets(name_ko);

-- 백필 상태 추적 (lazy backfill 진행)
CREATE TABLE backfill_log (
  class TEXT NOT NULL,
  symbol TEXT NOT NULL,
  tf TEXT NOT NULL,
  source TEXT NOT NULL,
  earliest_t INTEGER,
  latest_t INTEGER,
  last_attempt_at INTEGER NOT NULL,
  last_success_at INTEGER,
  PRIMARY KEY (class, symbol, tf, source)
);
```

**Wide format을 고른 이유**: long format(`(symbol, t, name, value)`)은 row 수가 17배 폭발(24M → 408M). D1 inserts 100K/day 한도 압박. Wide는 candles와 1:1이라 조인 쉬움. 지표 추가 시 `ALTER TABLE ... ADD COLUMN`은 SQLite 표준이라 마이그레이션 안전.

#### Repository 추상화

```
lib/db/
├── repos.ts                # 인터페이스 정의
├── d1/
│   ├── client.ts           # Drizzle D1 client
│   ├── schema.ts           # Drizzle schema 정의
│   ├── candle-repo.ts
│   ├── indicator-repo.ts
│   └── asset-repo.ts
└── migrations/             # drizzle-kit이 관리
    ├── 0000_init.sql
    └── ...
```

`lib/db/repos.ts`:
```ts
import type {Candle, Asset, AssetClass} from "@/lib/types";

export interface CandleRepo {
  getRange(class: AssetClass, symbol: string, from: number, to: number, tf?: string): Promise<Candle[]>;
  upsertMany(rows: Array<Candle & {class: AssetClass; symbol: string; source: string}>): Promise<void>;
  latestT(class: AssetClass, symbol: string, tf?: string): Promise<number | null>;
}

export interface IndicatorRepo {
  getRange(class: AssetClass, symbol: string, from: number, to: number, fields?: IndicatorField[]): Promise<IndicatorRow[]>;
  upsertMany(rows: IndicatorRow[]): Promise<void>;
}

export interface AssetRepo {
  search(query: string, classes?: AssetClass[], limit?: number): Promise<Asset[]>;
  get(class: AssetClass, symbol: string): Promise<Asset | null>;
  upsert(asset: Asset): Promise<void>;
}
```

페이지·백테스트 코드는 인터페이스만 사용 → `lib/db/d1/*` 교체로 다른 DB 이주 가능.

#### Drizzle ORM 도입

- `drizzle-orm` + `drizzle-kit` (devDependency)
- 스키마: `lib/db/d1/schema.ts`
- 마이그레이션: `drizzle-kit generate` → SQL 파일 생성 → `wrangler d1 migrations apply`
- Dialect 추상화: 동일 schema/query를 D1·Turso·Postgres에 재사용 가능

```ts
// 예시
import {drizzle} from "drizzle-orm/d1";
import {candles} from "./schema";
import {and, eq, gte, lte, desc} from "drizzle-orm";

const db = drizzle(env.DB);
const rows = await db
  .select()
  .from(candles)
  .where(and(eq(candles.class, "crypto"), eq(candles.symbol, "btc"),
             gte(candles.t, from), lte(candles.t, to)))
  .orderBy(desc(candles.t));
```

#### Write 패턴 (D1 100K writes/day 한도 고려)

| 작업 | 빈도 | writes/day |
|---|---|---|
| **Lazy backfill** (사용자 조회 시) | 사용자 트래픽 비례 | 추정 ~5K |
| **인기 종목 daily increment** (cron) | top 200 × 3 자산군, 1봉/day | 600 |
| **지표 재계산** (computed_version 변경 시) | 드물게 | 단기간 spike, 백필 시 lazy |
| **자산 마스터 갱신** (주간 cron) | 종목 ~10K | 주 1회 일괄 |

100K/day 한도 안에 여유 있음.

**INSERT 패턴**: 표준 SQL `INSERT INTO ... ON CONFLICT(...) DO UPDATE SET ...` (PostgreSQL 호환 — `INSERT OR REPLACE`보다 마이그레이션 친화).

**Batch**: D1 `db.batch([stmt1, stmt2, ...])`는 어댑터에서 사용. Drizzle은 자체 transaction API로 추상화.

#### 검증 전략

**3단계 cross-check:**

1. **알고리즘 unit test** — Vitest fixtures. 표준 reference dataset(yfinance/pandas-ta 일부 종목·기간 값을 JSON으로 박음). SMA/EMA/RSI/MACD/BB/ATR 각 지표마다 fixture 1-2개.
2. **외부 출처 sampling** — 인기 종목(BTC, AAPL, 삼성전자) 10개 × 최근 100봉을 TradingView UI 값과 비교. 운영 직전 1회 + 분기마다.
3. **결정론 보장** — `computed_version` 컬럼. 로직 변경 시 버전 증가 + lazy 백필 트리거. 같은 입력 + 같은 버전 = 같은 결과.

#### 주간 R2 백업

```
cron schedule: 0 18 * * 0  (매주 일요일 18:00 UTC = 한국 월요일 03:00)
worker: scripts/backup-worker.ts
  1. wrangler d1 export equivalent: SELECT * FROM candles/indicators/assets/backfill_log
  2. SQL dump string 생성
  3. R2에 put: lab-trading-backup/YYYY-MM-DD/dump.sql
  4. 최근 12주만 유지 (LIST + DELETE)
```

R2 무료 10 GB 안에 충분 (Phase 3 dump 2.5 GB × 12주 = 30 GB는 초과하지만, 압축 후 절반, 그리고 retention 4-8주로 조정 가능).

장점:
- D1 자체 장애 대비
- 마이그레이션 시 "최신 dump" 기준
- 외부 분석(노트북 등)에서 raw 데이터 활용

#### Lock-in 평가 (마이그레이션 시 비용)

| 목적지 | 데이터 마이그레이션 | 코드 변경 | 총 비용 |
|---|---|---|---|
| 로컬 SQLite (better-sqlite3) | .sql import (즉시) | 드라이버 1개 | 수 시간 |
| Turso (libSQL) | .sql import 또는 dump replication | 드라이버 1개 | 반나절 |
| CF DO + SQLite | .sql import | DO 환경 적응 | 1-2일 |
| Neon / Supabase (Postgres) | 변환 스크립트 (Drizzle dialect 변경) | 드라이버 + 일부 SQL | 1주 |
| PlanetScale (MySQL) | 변환 스크립트 | dialect 차이 ↑ | 1-2주 |

코인+해외+국내 일봉이라는 단순 데이터 모델 + Drizzle dialect 추상화 + 표준 SQL 사용 정책으로 **Postgres 이주까지 1주가 현실적 상한**.

#### SQLite-specific SQL 회피 정책

CLAUDE.md 컨벤션 R로 추가 (별도 작업). 핵심:

- ❌ `INSERT OR REPLACE` → ✅ `INSERT ... ON CONFLICT(...) DO UPDATE SET ...`
- ❌ `json_extract(meta_json, '$.foo')` → 가능하면 application 레벨 parse, 불가피하면 raw SQL 격리
- ❌ `strftime('%Y', t, 'unixepoch')` → application 레벨 Date 처리, `t INTEGER` 자체로 인덱싱
- ❌ `WITHOUT ROWID` → 사용 가능하나 마이그레이션 시 무시되거나 무해 (OK)
- ❌ SQLite full-text search (FTS5) → 검색은 application 레벨 substring (`LIKE`) 또는 향후 별도 검색 인덱스 ADR
- ✅ Drizzle ORM 쿼리만 사용 (raw SQL 최소화)

## 결과

### 긍정적
- Phase 3까지 무료 한도 안.
- Workers 네이티브 binding으로 latency 최저.
- 백테스트가 사전계산된 지표를 사용 → 일관된 결과 + 검증 가능.
- R2 백업으로 마이그레이션·장애 대비.
- Repository 추상화 + Drizzle ORM으로 lock-in 위험 최소화 — 다른 DB 이주 시 1주 내.

### 부정적
- 1차 출시 시점에 Drizzle ORM 학습 곡선. → 완화: 단순 CRUD 위주라 학습 비용 작음. Drizzle 문서 친절.
- 지표 계산 로직 버그 → 모든 historical 재계산. → 완화: `computed_version`으로 lazy 백필. 외부 cross-check sampling이 사전 방지.
- D1 single-region writes — 한국 사용자의 write latency 가끔 100-200ms. → 완화: writes는 백필·cron이라 사용자 경로 아님. read는 PoP-local cache (ADR-0009 KV 캐시 활용).
- Drizzle ORM 자체의 dialect 추상화 한계 — 일부 advanced SQL은 raw로 작성해야. → 완화: 1차 출시는 단순 CRUD라 raw 필요 없음.

### 따라오는 작업

1. **CLAUDE.md 컨벤션 R 추가** — SQLite-specific SQL 회피 정책
2. **D1 namespace 생성** + `wrangler.jsonc` binding (`DB`)
3. **R2 bucket 생성** + binding (`BACKUP`)
4. **`bun add drizzle-orm` + `bun add -D drizzle-kit`**
5. **`lib/db/d1/schema.ts`** — Drizzle schema 정의
6. **`drizzle.config.ts`** — migration 설정
7. **`lib/db/repos.ts`** — repository 인터페이스
8. **`lib/db/d1/*-repo.ts`** — D1 구현체
9. **`lib/backtest/indicators.ts`** — SMA/EMA/RSI/MACD/BB/ATR 직접 구현 (0 dep)
10. **Vitest fixtures** — 표준 reference dataset (yfinance/pandas-ta 값)
11. **`scripts/backup-worker.ts`** — 주간 R2 백업 cron
12. **백테스트 엔진(ADR-0019) 갱신** — D1 indicators 테이블에서 사전계산 값 사용 (cache miss 시만 즉석 계산)

### 의존성

- ADR-0019 (백테스트 엔진) — D1 indicators를 우선 사용하도록 갱신 필요
- ADR-0009 (캐시) — KV는 short-TTL 시세 캐시만, D1은 영구 historical로 역할 명확화

## 참고

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Drizzle ORM](https://orm.drizzle.team/docs/quick-sqlite/d1)
- [drizzle-kit](https://orm.drizzle.team/docs/kit-overview)
- [wrangler d1 export](https://developers.cloudflare.com/d1/wrangler-commands/#d1-export)
- [Turso (libSQL)](https://turso.tech/) — 대체 옵션
- 사용자 대화 로그: 데이터 사이즈·DB 추천·마이그레이션 가능성 논의 (2026-05-13)
