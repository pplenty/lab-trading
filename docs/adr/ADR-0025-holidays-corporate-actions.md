# ADR-0025: 휴장일 · 분할 · 배당 처리

- 상태: Accepted
- 날짜: 2026-05-13
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 약함)
- 관련 ADR: ADR-0010 (Candle), ADR-0019 (백테스트), ADR-0021 (데이터 저장)

## 컨텍스트

일봉 historical 데이터에는 자산군별 데이터 갭(휴장)·구조적 변경(분할·배당) 처리가 필요하다. 이를 어떻게 다루느냐가 백테스트 결과의 정확성을 결정한다.

### 1. 휴장일 (no-trade days)
- **코인**: 휴장 없음 (24/7).
- **미장**: NYSE 휴장 일정 (신정·MLK Day·President's Day·Good Friday·Memorial Day·Juneteenth·Independence Day·Labor Day·Thanksgiving·Christmas + 조기 폐장). 연 ~9-10일.
- **국내**: KRX 휴장 일정 (설·추석 3일·신정·삼일절·근로자의 날·어린이날·석가탄신일·현충일·광복절·개천절·한글날·성탄절·1월 첫 영업일·12월 마지막 영업일).

### 2. 주식 분할 (split)
- 미장: AAPL 4-for-1 (2020-08), TSLA 5-for-1 (2020-08), 3-for-1 (2022-08) 등 잦음.
- 국내: 액면분할 (삼성전자 50:1, 2018-05) 등.
- 백테스트에 영향 큼 — 분할 미반영 시 "어제 200달러던 주식이 오늘 50달러"라는 거짓 신호.

### 3. 배당
- 미장: 분기 배당 (AAPL ~0.5%/q), ETF 분배.
- 국내: 연 배당 (KOSPI 대형주 평균 ~1.8-2.5%/yr).
- 코인: 스테이킹 보상 (DeFi/PoS), 1차 출시 무시.
- Total return vs Price return — 백테스트 결과의 의미가 다름.

## 검토한 옵션

### A. 어댑터 책임 (split-adjusted 데이터를 외부 API에서 받음) + 배당 무시
- 장점: 단순. Twelve Data·Yahoo·CoinGecko 모두 split-adjusted 가격을 기본 제공.
- 단점: 배당 무시 → 장기 백테스트에서 미장 ETF 등의 실제 수익률보다 낮게 표시 (연 1-2% 차이).

### B. 어댑터 책임 + 배당 별도 fetch + total return 옵션
- 장점: 정확. Total return / Price return 둘 다 표시 가능.
- 단점: 배당 데이터 어댑터 추가. 미국 배당 일정·금액은 Twelve Data·FMP에서 제공, 국내는 OpenDART 공시.

### C. Split-adjusted X (raw OHLCV) + 자체 split 이벤트 테이블
- 장점: 사용자에게 split 시점 명시 가능.
- 단점: split 데이터 별도 수집·관리. 백테스트 시 자체 보정 로직.

### D. 휴장일 무시 (없는 봉은 그냥 없음, 캘린더 추론 X)
- 장점: 단순.
- 단점: "어제 봉 없음 → 데이터 누락?" 사용자 혼란.

### E. 휴장 캘린더 별도 테이블 + 갭 표시
- 장점: 휴장임을 사용자에게 명시. 차트에 "Trading Holiday" 배지.
- 단점: 캘린더 데이터 유지 비용.

## 결정

**옵션 A + D (1차) → 옵션 B 일부 (Phase 2 total return) → 옵션 E (Phase 2.5 휴장 캘린더).**

근거:
1. 1차 출시 단순화 — 어댑터의 split-adjusted 가격을 그대로 사용, 배당은 명시적 미반영 (백테스트 결과 라벨에 "Price return only" 표기).
2. 휴장은 자연스러운 갭으로 표시 (캔들 차트는 timestamp gap을 자동 처리), 사용자 혼란 최소화 위해 종목 상세 페이지에 작은 안내 ("최근 N일 데이터, 휴장일 제외").
3. Phase 2에 미장 ETF/배당 종목의 total return 옵션 추가 (백테스트 폼 체크박스).
4. Phase 2.5에 휴장 캘린더 테이블 + 차트 "휴장" 마커.

**잠금 항목:**

### 1차 출시 정책

**Split:**
- Twelve Data·CoinGecko·Binance 모두 split-adjusted 가격 반환 — 그대로 사용.
- KIS는 수정주가 옵션 (`fid_org_adj_prc=1`) — split-adjusted 사용.
- 사용자에게 명시: 종목 상세 페이지 footer에 "수정주가 기준 (분할·배당 반영 가격)".

**배당:**
- 1차 출시는 무시 (Price return only).
- 백테스트 결과 박스에 "💡 배당·분배는 반영하지 않습니다 (Price return)" 작은 라벨.
- 영향: 미장 배당주 ETF (예: SCHD) 백테스트는 실제 total return보다 연 ~3% 낮게 표시.

**휴장:**
- 데이터 갭은 timestamp 간격으로 자연 표현 (캔들 차트의 dateScale이 자동 처리).
- 1차 출시는 캘린더 테이블 X.
- 백테스트는 "있는 봉만 처리" — 휴장일은 skip.

### Phase 2 추가

**Total return 옵션 (배당 반영):**
- D1에 `dividends` 테이블 추가:
  ```sql
  CREATE TABLE dividends (
    class TEXT, symbol TEXT,
    ex_date INTEGER,            -- 배당락일
    pay_date INTEGER,           -- 지급일
    amount REAL,                -- 1주당
    currency TEXT,
    source TEXT,
    PRIMARY KEY (class, symbol, ex_date)
  );
  ```
- 어댑터: Twelve Data `/dividends`, FMP `/dividends_calendar`, OpenDART 배당 공시
- 백테스트 폼: "배당 재투자 포함" 체크박스
- 결과 라벨: "Total return (배당 재투자)" vs "Price return"

### Phase 2.5 추가

**휴장 캘린더 (`market_holidays`):**
- D1에 테이블:
  ```sql
  CREATE TABLE market_holidays (
    market TEXT,                -- 'NYSE' | 'KRX'
    date INTEGER,               -- unix sec, UTC 자정
    name TEXT,
    name_ko TEXT,
    is_full_close INTEGER       -- 1=전일 휴장, 0=조기 폐장
  );
  ```
- 데이터 출처: NYSE 공식 캘린더 + KRX 공시 (수동 갱신, 연 1회 매니저 작업)
- 차트에 "Holiday: Christmas" 마커
- 백테스트 결과 페이지에 "이 기간 휴장 N일 포함" 안내

### Phase 3+ 후보

- Spin-off 처리 (예: 3M → Solventum 분사)
- M&A delisting (예: Twitter → X 비공개)
- 주식 명변 (KOSPI 코드 유지하지만 회사명 바뀐 케이스)
- 코인 fork (BTC → BCH 같은 분기)

이들은 매우 드물고 사용자 임팩트가 적어 명시적으로 Phase 3 후순위.

## 결과

### 긍정적
- 1차 출시 작업량 최소.
- Split은 어댑터가 알아서 처리 → 데이터 정확.
- Phase 2에 배당 추가하기 쉬운 구조 (D1 별도 테이블).

### 부정적
- 1차 출시는 배당 무시 → 미장 배당주·국내 우선주 백테스트의 정확도 한계. → 완화: "Price return only" 라벨 명시. Phase 2에 total return 옵션.
- 휴장일 명시 표기 부재 → 차트에 갭이 보이지만 이유 불분명. → 완화: 종목 상세 footer 안내. Phase 2.5에 캘린더 마커.

### 따라오는 작업
- 어댑터(`lib/adapters/*.ts`) 구현 시 split-adjusted flag 명시
- 종목 상세 페이지 footer: "수정주가 기준" + "Price return only"
- 백테스트 결과 라벨: "Price return only"
- Phase 2: dividends 테이블 + 어댑터 + UI 토글
- Phase 2.5: market_holidays 테이블 + 차트 마커

## 참고

- [NYSE Holidays 2026](https://www.nyse.com/markets/hours-calendars)
- [KRX 휴장일](http://open.krx.co.kr/)
- [Twelve Data Splits/Dividends](https://twelvedata.com/docs#splits)
- [CoinGecko historical (자동 split-adjusted)](https://www.coingecko.com/en/api)
