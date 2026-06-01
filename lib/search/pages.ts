import {jamoChoString, isPureChoSet} from "./hangul";
import {convertEngToHangul, hasHangulSyllable} from "./keyboard";

// 기능 페이지 검색 — 종목 외 사이트 기능 (백테스트 / 포트폴리오 / 비교 / 알림 등) 검색.
// SearchEntry (종목) 와 별개 PageEntry. /search 페이지 + SearchBox 에서 함께 노출.
//
// 매칭: title / titleKo / keywords substring + 한글 초성 (titleKo).

export type PageEntry = {
  title: string;
  titleKo: string;
  href: string;
  /** 추가 검색 키워드 (별칭). */
  keywords: string[];
  /** 짧은 설명. */
  descKo: string;
  /** 이모지 아이콘. */
  icon: string;
};

export const pageIndex: PageEntry[] = [
  {
    title: "Backtest",
    titleKo: "백테스트",
    href: "/backtest/new",
    keywords: ["backtest", "백테", "전략", "시뮬레이션", "strategy"],
    descKo: "6 preset 전략을 과거 데이터로 시뮬레이션",
    icon: "⚡",
  },
  {
    title: "Custom Backtest",
    titleKo: "커스텀 백테스트",
    href: "/backtest/custom",
    keywords: ["custom", "커스텀", "조건", "and", "or", "지표 조합", "빌더"],
    descKo: "RSI/SMA/MACD 를 AND/OR 로 묶어 직접 매수·매도 정의",
    icon: "🧪",
  },
  {
    title: "Portfolio Backtest",
    titleKo: "포트폴리오 백테스트",
    href: "/backtest/portfolio",
    keywords: ["portfolio", "포트폴리오", "분산", "rebalance", "리밸런스", "비중"],
    descKo: "여러 종목 비중 배분 + 주기 rebalance 시뮬레이션",
    icon: "💼",
  },
  {
    title: "Strategy Compare (A vs B)",
    titleKo: "전략 비교",
    href: "/backtest/vs",
    keywords: ["vs", "비교", "compare", "전략 비교", "두 전략"],
    descKo: "같은 종목에 두 전략 동시 백테스트 비교",
    icon: "⚔️",
  },
  {
    title: "Saved Strategies",
    titleKo: "저장된 전략",
    href: "/backtest/saved",
    keywords: ["saved", "저장", "내 전략", "strategies"],
    descKo: "저장한 preset · 커스텀 전략 목록",
    icon: "🔖",
  },
  {
    title: "Compare",
    titleKo: "비교 차트",
    href: "/compare",
    keywords: ["compare", "비교", "상관", "correlation", "drawdown", "벤치마크"],
    descKo: "여러 종목 normalized 추세 + 상관행렬 비교",
    icon: "⇆",
  },
  {
    title: "Indices",
    titleKo: "자체 지수",
    href: "/indices",
    keywords: ["index", "지수", "composite", "kospi", "코스피", "s&p", "시장"],
    descKo: "80 종목 equal-weight 합성 지수 시계열",
    icon: "📈",
  },
  {
    title: "Fear & Greed",
    titleKo: "공포·탐욕 지수",
    href: "/market",
    keywords: [
      "market",
      "시장",
      "sentiment",
      "분위기",
      "공포",
      "탐욕",
      "공포탐욕",
      "fear",
      "greed",
      "vix",
      "변동성",
      "심리",
      "상승 하락",
    ],
    descKo: "코인·미국 공포·탐욕 지수 + 80 종목 24h 변동 분포",
    icon: "🌡️",
  },
  {
    title: "News",
    titleKo: "통합 뉴스",
    href: "/news",
    keywords: ["news", "뉴스", "헤드라인", "한경", "매경"],
    descKo: "코인·해외·국내 최신 헤드라인 + 검색",
    icon: "📰",
  },
  {
    title: "Portfolio (Paper Trading)",
    titleKo: "가상 포트폴리오",
    href: "/portfolio",
    keywords: ["paper", "가상", "매매", "보유", "holdings", "pnl", "수익"],
    descKo: "실 매매 없이 보유 종목 PnL 추적",
    icon: "💰",
  },
  {
    title: "Favorites",
    titleKo: "내 즐겨찾기",
    href: "/favorites",
    keywords: ["favorites", "즐겨찾기", "관심", "라벨", "label", "분류"],
    descKo: "관심 종목 라벨링 + 분류",
    icon: "⭐",
  },
  {
    title: "Alerts",
    titleKo: "가격 알림",
    href: "/alerts",
    keywords: ["alert", "알림", "가격", "도달", "조건"],
    descKo: "가격 조건 도달 알림 관리",
    icon: "🔔",
  },
  {
    title: "Notes",
    titleKo: "내 메모",
    href: "/notes",
    keywords: ["note", "메모", "기록", "노트"],
    descKo: "종목별 작성 메모 통합 관리",
    icon: "📝",
  },
  {
    title: "My Activity",
    titleKo: "내 활동",
    href: "/me",
    keywords: ["me", "내 활동", "dashboard", "대시보드", "자산"],
    descKo: "모든 사용자 자산 한 화면 통합",
    icon: "🧭",
  },
  {
    title: "Settings",
    titleKo: "설정",
    href: "/settings",
    keywords: ["settings", "설정", "테마", "백업", "복원", "theme", "backup"],
    descKo: "테마 · 컬러 시맨틱 · 백업/복원",
    icon: "⚙️",
  },
];

const pageChoIndex: string[] = pageIndex.map((p) => jamoChoString(p.titleKo));

/** 기능 페이지 검색 — title/titleKo/keywords substring + 초성. */
export function searchPages(query: string, limit = 5): PageEntry[] {
  const raw = query.trim();
  if (raw.length === 0) return [];
  const q = raw.toLowerCase();
  const qIsCho = isPureChoSet(raw);

  // 한영 전환 누락 대비 — 영문 입력 → 한글 변환 후보
  const hangulCandidate =
    !hasHangulSyllable(raw) && raw.length >= 2 ? convertEngToHangul(raw) : null;

  const scored: Array<{entry: PageEntry; score: number}> = [];
  for (let i = 0; i < pageIndex.length; i++) {
    const p = pageIndex[i];
    let score = 0;

    // 초성 매칭
    if (qIsCho) {
      const cho = pageChoIndex[i];
      if (cho.startsWith(raw)) score = Math.max(score, 80);
      else if (cho.includes(raw)) score = Math.max(score, 55);
    } else {
      const titleKoLower = p.titleKo.toLowerCase();
      const titleLower = p.title.toLowerCase();
      if (titleKoLower === q || titleLower === q) score = Math.max(score, 100);
      else if (titleKoLower.startsWith(q) || titleLower.startsWith(q))
        score = Math.max(score, 90);
      else if (titleKoLower.includes(q) || titleLower.includes(q))
        score = Math.max(score, 70);

      for (const kw of p.keywords) {
        const kwLower = kw.toLowerCase();
        if (kwLower === q) score = Math.max(score, 75);
        else if (kwLower.startsWith(q)) score = Math.max(score, 60);
        else if (kwLower.includes(q)) score = Math.max(score, 45);
      }

      // 두벌식 한글 변환 후보 매칭
      if (hangulCandidate) {
        const hc = hangulCandidate.toLowerCase();
        if (titleKoLower.includes(hc)) score = Math.max(score, 50);
        for (const kw of p.keywords) {
          if (kw.toLowerCase().includes(hc)) score = Math.max(score, 40);
        }
      }
    }

    if (score > 0) scored.push({entry: p, score});
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
