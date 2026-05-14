# ADR-0013: 실시간 데이터 전략

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너
- 관련 ADR: ADR-0003 (Workers), ADR-0009 (캐싱)

## 컨텍스트

시세는 변동한다. 사용자가 페이지에 머무는 동안 가격이 갱신되어야 "실시간 정보 사이트" 느낌이 난다. 갱신 방식 선택지:

1. **HTTP 폴링** — 클라이언트가 N초마다 fetch
2. **WebSocket** — 서버↔클라이언트 양방향 지속 연결
3. **Server-Sent Events (SSE)** — 서버→클라이언트 단방향 스트림

Workers 환경 제약:
- 표준 Worker는 짧은 요청-응답 모델. 장기 연결은 Durable Objects 필요.
- 거래소 WS API (Binance, Upbit, Bithumb)는 직접 클라이언트 연결도 가능하나 키 노출·rate limit 위험.

## 검토한 옵션

### A. 클라이언트 폴링 (RSC + Route Handler) — 자산군별 TTL
- 장점: 가장 단순. CF Cache + KV가 흡수. Workers cold start 없음. 모든 데이터 소스 호환.
- 단점: 갱신 텀이 TTL에 묶여서 "실시간" 체감 ↓. 트래픽 ↑.

### B. 거래소 WebSocket 직접 클라이언트 연결 (코인만)
- 장점: 최저 latency. 거래소 부담을 우리 서버가 안 짐.
- 단점: Upbit/Binance WS 한도가 IP 기준이라 클라이언트 다수면 한도 압박. 자산군 일관성 깨짐 (해외/국내는 WS 직결 불가).

### C. SSE — Workers Durable Object가 거래소 WS 받아서 SSE로 fan-out
- 장점: 단방향이라 단순. 모든 자산군 통일 가능.
- 단점: Durable Object 비용 (CF 유료 플랜). Workers Free에서는 제한.

### D. WS — Durable Object로 fan-out
- 장점: 양방향. 사용자 액션도 즉시.
- 단점: 가장 복잡. 1차 출시 과한 인프라.

## 결정

**옵션 A 채택 (1차 출시).**

근거:
1. 1차 출시는 "시세 정보 사이트" 가치 명제. ±15초 갱신 텀이 사용자에게 충분히 "실시간"으로 인지된다.
2. Workers Durable Object는 유료 플랜이라 1차 출시 비용 예산과 충돌.
3. ADR-0009의 Cache/KV TTL이 이미 폴링 주기와 자연스럽게 정렬. 사용자 100명이 동시에 폴링해도 외부 API 호출은 TTL당 1회.
4. 자산군별 polling interval은 클라이언트가 데이터 종류에 맞춰 결정:
   - 시세 (단건): 15-30s
   - 시세 (리스트, 대시보드): 60s
   - 랭킹: 60s
   - 일봉: 폴링 없음 (페이지 로드 시 1회)

**잠금 항목:**

- **클라이언트 폴링 라이브러리:** 자체 hook (`useIntervalQuery`). Tanstack Query는 1차 출시 미도입 (Phase 2 검토).
- **백그라운드 탭 중단:** Page Visibility API로 hidden 탭에서는 폴링 중단.
- **사용자 옵션:** Settings에서 "갱신 텀" 조정 가능 (10s / 30s / 60s / 수동).
- **WS 옵션:** Phase 2에 코인 한정 직결 검토 (조사 추가 필요).

**Phase 2 후보:**
- Binance / Upbit WS 직결 (코인만, 클라이언트에서)
- SSE via Durable Object (유료 플랜 진입 후)

## 결과

### 긍정적
- 1차 출시 인프라 비용 0.
- 모든 자산군 통일 갱신 모델.
- Cache/KV로 외부 API 부담 흡수.

### 부정적
- "초당 변동" 체감 X. 코인 사용자가 가장 아쉬워할 부분. → 완화: Settings에서 폴링 텀 단축 가능 (최소 10s). Phase 2에 WS 옵션.
- 폴링 활성 탭이 많으면 클라이언트 자원 ↑. → 완화: Visibility API + 사용자 옵션.

### 따라오는 작업
- `lib/hooks/useIntervalQuery.ts` — fetch + interval + visibility 통합
- Route Handler `/api/<class>/quotes` (Cache + KV)
- Settings 페이지에 갱신 텀 라디오
- Phase 2: Binance WS 클라이언트 직결 어댑터 (`lib/adapters/binance-ws.ts`)

## 참고

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
