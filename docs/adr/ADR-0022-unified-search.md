# ADR-0022: 자산군 통합 검색

- 상태: Accepted
- 날짜: 2026-05-13
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 약함)
- 관련 ADR: ADR-0010 (Symbol), ADR-0014 (메뉴), ADR-0021 (D1 assets 테이블)

## 컨텍스트

사용자가 "비트코인", "BTC", "삼성전자", "005930", "apple", "AAPL" 어떤 형태로 입력해도 종목을 찾아야 한다. 자산군별 검색을 따로 두면 사용 동선이 늘어나므로 헤더의 한 검색 박스에서 통합 검색.

yutils의 `SearchBox.tsx`(Cmd+K, ARIA combobox)를 차용하되, 데이터 셋이 다르다 — yutils는 50개 도구, lab-trading은 수천 자산.

검색 대상:
- 코인: ~500-2000 종목 (CoinGecko top N)
- 미국 주식: ~5000-8000 종목 (Twelve Data 미장 전체)
- 한국 주식: ~3000 종목 (KOSPI+KOSDAQ, Phase 1.5)

매칭 키: ticker(영문), 정식명(영문), 한글명, 한글 발음 표기(예: "비트코인"·"삼성전자"), 동의어.

## 검토한 옵션

### A. 클라이언트 사이드 substring search (yutils 패턴)
- 장점: 단순. 키스트로크 단위 즉시. SSR 불필요.
- 단점: 자산 인덱스(예: 1만 자산 × 평균 60 bytes = 600 KB) 클라이언트 다운로드. 첫 로드 ↑.

### B. 서버 사이드 검색 (Route Handler + D1 `LIKE`)
- 장점: 클라이언트 다운로드 0. D1 인덱스 활용.
- 단점: 매 키스트로크마다 fetch. debounce 필요. cold start 영향.

### C. 클라이언트 + 압축 인덱스 (sliced 자산만, 인기 종목 우선)
- 장점: 다운로드 ↓ (~100 KB).
- 단점: 검색 누락 가능 (인기 외 종목).

### D. 외부 검색 서비스 (Algolia, Meilisearch Cloud)
- 장점: 풍부한 매칭 (fuzzy, typo).
- 단점: 별도 서비스, 비용, 무료 한도 검토.

### E. SQLite FTS5
- 장점: 풍부한 매칭.
- 단점: 컨벤션 R(ADR-0021)에서 SQLite-specific 회피 권고. 마이그레이션 부담.

## 결정

**옵션 C 채택 권장 (압축 인덱스 — 인기 종목 + 서버 fallback).**

근거:
1. 인덱스 다운로드와 즉시 응답성을 균형 — 자산군별 top 300 종목 + 한글 매칭만 클라이언트에 (3 자산군 × 300 × ~80 bytes ≈ 72 KB gzip).
2. 인덱스 miss 시 서버 fallback — `/api/search?q=...` → D1 `LIKE` 쿼리.
3. Cmd+K 인터랙션은 yutils 패턴 그대로.

**구조:**

```
/static/search-index/
├── crypto.json     # top 500 코인 (slug, name, nameKo, ticker, logoUrl)
├── us.json         # top 500 미장 (S&P500 + 인기 ETF)
└── kr.json         # top 500 KR (KOSPI 대형주 + KOSDAQ 인기, Phase 1.5)

매칭 대상 필드:
- ticker (case-insensitive)
- name (영문)
- nameKo (한글)
- aliases (예: ["비트코인", "비코"])

매칭 로직 (lib/search/match.ts):
1. exact ticker match (점수 100)
2. ticker prefix (90)
3. name/nameKo exact (85)
4. name/nameKo prefix (75)
5. substring (50)
6. alias match (60)
```

**서버 fallback (`/api/search?q=...`):**
- 인덱스에 없는 종목 검색 — D1 `WHERE name LIKE ? OR name_ko LIKE ? OR ticker LIKE ?`
- TTL 5분 KV 캐시 (정확히 같은 쿼리만)

**한글 → 영문 매핑 (정적 lookup 테이블):**

```ts
// lib/search/korean-aliases.ts (자산군별)
export const cryptoKoAliases = {
  btc: ["비트코인", "비트"],
  eth: ["이더리움", "이더", "이더리움"],
  sol: ["솔라나"],
  doge: ["도지", "도지코인"],
  // ... top 100 코인
};

export const usKoAliases = {
  aapl: ["애플"],
  tsla: ["테슬라"],
  nvda: ["엔비디아"],
  // ... S&P500 한글명 매핑
};

// KR은 name_ko 자체가 한글이라 별도 alias 불필요
```

**UI (yutils SearchBox 차용):**
- Header 가운데 검색 박스 (`Ctrl/⌘+K`)
- dropdown 결과: 자산군 아이콘 + 종목명 + ticker + 24h 변동률 (소형 chip)
- ↓↑ Enter Escape Home/End, ARIA combobox
- 결과 클릭 → `/[class]/[symbol]` 페이지
- 첫 결과는 즐겨찾기 → 최근 본 종목 → 인기 종목 순

**인덱스 빌드:**
- 빌드 타임에 D1 query → static JSON 생성 (`scripts/build-search-index.ts`)
- 또는 cron worker로 매일 1회 R2에 갱신 후 SSG 빌드 시 fetch
- 1차 출시는 빌드 타임 정적 생성

## 결과

### 긍정적
- 키스트로크 즉시 응답 (인덱스 hit).
- 인덱스 miss 시 서버 fallback으로 niche 종목 발견 가능.
- 한글·영문·티커 모두 매칭.
- yutils SearchBox 인터랙션 그대로 차용 — 학습 비용 0.

### 부정적
- 인덱스 ~70 KB 추가 다운로드. → 완화: 자산군 진입 후 lazy load. 첫 페이지에는 코인만.
- 한글 alias 매핑 유지 비용. → 완화: top 100 종목만 수동 매핑, 나머지는 ticker 또는 name 매칭으로.

### 따라오는 작업
- `scripts/build-search-index.ts`
- `lib/search/match.ts` + `lib/search/korean-aliases.ts`
- `components/SearchBox.tsx` (yutils 차용 + 자산 카드 변형)
- `/api/search` route handler + KV 캐시
- D1 `assets` 테이블에 인덱스 (ADR-0021)

## 참고

- yutils `components/SearchBox.tsx`
- yutils `lib/search.ts` (substring 매칭 기본 패턴)
