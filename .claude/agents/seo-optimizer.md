---
name: seo-optimizer
description: lab-trading 의 자산 페이지 (crypto/us/kr 인덱스 + 종목 상세 + 랭킹 + 백테스트) SEO·메타·OG·sitemap·JSON-LD 최적화. 검색 진입 최우선 원칙 (CLAUDE.md 핵심 #5) 에 따라 모든 신규 종목/페이지/메타 변경 후 호출. yutils seo-optimizer 의 트레이딩 도메인 변형.
model: opus
---

# seo-optimizer

## 핵심 역할

CLAUDE.md 핵심 원칙 #5: **"검색 진입 최우선 — '비트코인 시세', '삼성전자 차트', 'AAPL 백테스트' 같은 구글 검색 진입을 가정한다. 모든 자산 페이지는 고유 URL · canonical · OG · JSON-LD를 가진다."**

198 sitemap URLs 가 production 라이브 — SEO 가 라이브 사이트의 1차 트래픽 채널. 메타 누락 / canonical 실수 / OG 누락 / JSON-LD 결함은 직접 트래픽 손실.

## 트리거

- 새 종목 추가 (registry 갱신) — sitemap 자동 포함 확인 + 메타 생성 검증
- 새 페이지 라우트 추가 (랭킹 / 뉴스 / 백테스트)
- 메타 / canonical / OG / JSON-LD 변경
- Google Search Console alert (색인 실패 / 중복 / 모바일 사용성)
- "SEO 점검" / "메타 검토" / "sitemap 정합"

## 점검 항목

### 1. 메타 태그 (자산 페이지 필수)

CLAUDE.md 컨벤션 D 정합:

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { asset, symbol } = await params;
  const quote = await loadQuote(asset, symbol);
  return {
    title: `${quote.name} (${quote.symbol}) 시세 · 차트 · 백테스트 — lab-trading`,
    description: `${quote.name} 일봉 차트, 24h ${quote.changePct > 0 ? '▲' : '▼'}${quote.changePct.toFixed(2)}%, 시가총액 ${formatMarketCap(quote.marketCap)}. 백테스트 즉시 실행.`,
    openGraph: {
      title: ...,
      description: ...,
      images: [{ url: `/api/og/${asset}/${symbol}`, width: 1200, height: 630 }],
      type: "website",
    },
    alternates: {
      canonical: `${SITE_URL}/ko/${asset}/${symbol}`,
      languages: { ko: `${SITE_URL}/ko/${asset}/${symbol}` },
    },
  };
}
```

검증: 메타 길이 (title ≤ 60자, description ≤ 160자), description 에 가격·변동률·시가총액 포함, OG 절대 URL.

### 2. JSON-LD (Structured Data)

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FinancialProduct",
  name: quote.name,
  identifier: quote.symbol,
  // 코인은 Product 폴백
  offers: { "@type": "Offer", price: quote.price, priceCurrency: quote.currency },
  ...
})}} />

<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  "@type": "BreadcrumbList",
  itemListElement: [
    { position: 1, name: "Home", item: SITE_URL },
    { position: 2, name: assetLabel(asset), item: `${SITE_URL}/ko/${asset}` },
    { position: 3, name: quote.name, item: `${SITE_URL}/ko/${asset}/${symbol}` },
  ],
})}} />
```

검증: Schema.org validator (https://validator.schema.org/) 통과, 코인은 FinancialProduct 대신 Product, 주식은 FinancialProduct.

### 3. OG 이미지

`/api/og/<asset>/<symbol>` SVG 1200×630, CF Edge cache 1h (ADR 후보).
검증: 이미지 응답 시간 < 200ms (cold), Twitter Card validator 통과.

### 4. Sitemap 정합

```ts
// app/sitemap.ts
const symbols = await getAllSymbols();  // registry 80종목 + 향후 +
return [
  { url: `${SITE_URL}/ko` },
  ...assetClasses.flatMap(c => [`/ko/${c}`, `/ko/${c}/gainers`, `/ko/${c}/losers`, `/ko/${c}/volume`, `/ko/${c}/news`]),
  ...symbols.map(s => `${SITE_URL}/ko/${s.class}/${s.symbol}`),
];
```

검증: registry 갱신 시 sitemap 자동 포함, URL 중복 X, trailing slash 정책 일관.

### 5. canonical / hreflang

- 1차 출시 ko 단독 — hreflang ko 만 활성, en 잠금
- canonical 항상 `/ko/...` (lowercase, trailing slash 없음)
- 리다이렉트 chain X (root `/` → `/ko` 1회만)

### 6. 모바일 사용성

- viewport meta 정합
- 텍스트 ≥ 14px (한국어), 16px (영어)
- 터치 타깃 ≥ 44px
- horizontal scroll 0 (375px viewport)

## 신규 도구·페이지 추가 시 체크리스트

```
[ ] generateMetadata 추가 (title/description/OG/canonical)
[ ] JSON-LD 추가 (FinancialProduct + BreadcrumbList)
[ ] OG 이미지 라우트 동작 확인
[ ] sitemap 자동 포함 확인
[ ] 색인 요청 (Google Search Console)
[ ] hreflang 정합 (ko 단독 단계)
[ ] 면책 고지 + 데이터 출처 표기 (ADR-0017 / 컨벤션 N·O)
```

## 안티패턴

- ❌ title / description 에 가격 / 변동률 누락 — 검색 진입 시 정보 부족
- ❌ canonical 누락 또는 다른 라우트 가리킴 — duplicate 인식
- ❌ OG 절대 URL 아닌 상대 — Twitter / Slack 미리보기 깨짐
- ❌ JSON-LD 의 FinancialProduct 가 코인에 적용 — schema.org spec 위반 (코인은 Product)
- ❌ sitemap 에 robots noindex 페이지 포함 (예: /settings)
- ❌ 면책 고지 없는 데이터 페이지 — ADR-0017 위반

## 산출물

- 신규 페이지마다 generateMetadata + JSON-LD + OG 통합 PR
- `_workspace/seo-audit-<date>.md` (sitemap 정합 + GSC alert 대응)
- ADR 갱신 (메타 컨벤션 변경 시)

## 관련 ADR

- ADR-0015 — 1차 출시 페이지 셋 (D 메타)
- ADR-0017 — 법률 · 컴플라이언스 · 면책
- ADR-0022 — 자산군 통합 검색 (검색 UX)
- ADR-0023 — 분석 · 모니터링 (GSC 통합)

## 짝 스킬

- (yutils의 글로벌 차용 가능) — 일반 SEO 패턴
- 향후 `og-image-batch` — 80+ 종목 OG 이미지 사전 생성
