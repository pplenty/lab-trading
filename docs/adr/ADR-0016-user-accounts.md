# ADR-0016: 사용자 계정 · 개인화

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0019 (백테스트 — 사용자 저장 데이터)

## 컨텍스트

사용자 데이터 종류:
1. 테마 · 다크 모드 · 컬러 시맨틱 (Settings)
2. 즐겨찾기 자산 (FavoriteButton)
3. 최근 본 종목 (Recent LRU)
4. 백테스트 저장 전략 (`/backtest/saved`)
5. 사용자 정의 폴링 텀, 통화 등

이를 (a) `localStorage` 익명 / (b) 계정 + 클라우드 동기화 / (c) 둘 다 — 어떻게 다룰지 결정.

## 검토한 옵션

### A. localStorage 단독 (계정 없음)
- 장점: 가장 단순. 백엔드 0. 개인정보 0. yutils와 동일 패턴.
- 단점: 디바이스 간 동기화 X. 사용자가 캐시 비우면 손실.

### B. 익명 + 옵션 가입 (계정은 동기화·공유 기능에만)
- 장점: 익명 사용자 진입장벽 0. 가입자만 cross-device.
- 단점: 백엔드(D1 + auth) 운영 비용. 1차 출시 작업량 ↑.

### C. 계정 필수
- 장점: 사용자 ID로 분석 정확.
- 단점: 진입장벽 최대. yutils 정체성과 충돌.

## 결정

**옵션 A 채택 권장 (1차 출시).**

근거:
1. lab-trading은 정보 사이트. 매매·주문 기능 없음. 계정의 가치는 cross-device 동기화 정도.
2. localStorage 단독으로 1차 출시 사용자 데이터의 90% 커버.
3. Phase 3+에 가입 추가 가능 (D1 + Cloudflare Access 또는 Clerk 같은 서드파티 auth).

**1차 출시 localStorage 키 컨벤션:**

| 키 | 용도 | 형식 |
|---|---|---|
| `lab-trading-theme` | 사용자 라이트 프리셋 ID | `string` (예: "white-iris") |
| `lab-trading-mode` | system / light / dark | `"system" \| "light" \| "dark"` |
| `lab-trading-color-semantics` | kr / global | `"kr" \| "global"` |
| `lab-trading-currency` | 표시 통화 (KRW / USD) | `"KRW" \| "USD"` |
| `lab-trading-favorites` | 즐겨찾기 자산 | `Array<{class, symbol}>` (JSON) |
| `lab-trading-recents` | 최근 본 종목 LRU 8 | `Array<{class, symbol, t}>` |
| `lab-trading-poll-interval` | 폴링 텀 (s) | `number` |
| `lab-trading-sidebar-open` | 사이드바 펼침 여부 | `"true" \| "false"` |
| `lab-trading-sidebar-width` | 사이드바 너비 (px) | `number` |
| `lab-trading-backtest-strategies` | 저장된 백테스트 전략 | `Array<Strategy>` (JSON) |
| `lab-trading-backtest-last` | 마지막 실행 결과 (편의 복원) | `Result` (JSON) |

**API 설계:**
- yutils의 `lib/storage.ts` 차용 (`useLocalStorageString`)
- 백테스트 전략은 JSON. 100개 이상 저장 시 경고 (브라우저 5-10MB 제한).
- 내보내기/가져오기: `Settings`에서 JSON 다운/업로드 (수동 백업)

**Phase 3 후보 (가입 도입):**
- Cloudflare D1 + Clerk 또는 NextAuth (Workers 호환 확인 필요)
- 동기화: 전략 + 즐겨찾기 + 테마 (테마는 디바이스 의존이라 옵션)
- 공유: `/backtest/share/[id]` — 익명 사용자도 공유 가능 (저장 시 익명 토큰 발급)

## 결과

### 긍정적
- 1차 출시 백엔드 0.
- 개인정보 처리 0 (GDPR / 개인정보보호법 부담 없음).
- 운영 비용 0.

### 부정적
- Cross-device 동기화 X. → 완화: JSON 내보내기/가져오기.
- 캐시 클리어 시 손실. → 완화: Settings에 "내보내기" 권장 안내.

### 따라오는 작업
- `lib/storage.ts` 차용 (yutils)
- `Settings`에 "내보내기/가져오기" 버튼
- Phase 3: D1 schema + auth provider 결정 ADR

## 참고

- yutils ADR-0008·0009·0016·0017 (localStorage 패턴)
