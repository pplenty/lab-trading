// 라이트 테마 프리셋 (yutils 차용) + 모드 axis + 컬러 시맨틱 axis (ADR-0012).
// 라이트 토큰은 applyTheme 이 inline :root style 로 적용 — 사용자가 ThemeSwitcher 로 선택.
// 다크 토큰은 globals.css 의 [data-mode="dark"] 룰에 정의 — applyTheme 이 라이트 inline cleanup 시 적용.
// accent / accent-fg 는 라이트/다크 둘 다 사용자 라이트 프리셋 값 inline (사용자 정체성 유지).
// 컬러 시맨틱 (한국식 vs 글로벌식) 은 globals.css 의 [data-color-semantics] 룰로 --color-up/--color-down 결정.

export type ThemeGroup = "white-base" | "warm" | "earthy";

export type Theme = {
  id: string;
  label: string;
  group: ThemeGroup;
  tokens: Record<string, string>;
};

// White base 그룹 공통 토큰. 각 옵션은 accent 만 다르게 비교.
const W = {
  bg: "#ffffff",
  surface: "#f8f8fc",
  "surface-hover": "#eeeef8",
  fg: "#0f172a",
  "fg-muted": "#475569",
  // WCAG AA — #94a3b8(2.6:1) → #67768a(4.6:1). globals.css :root 와 동일.
  "fg-subtle": "#67768a",
  line: "#e2e8f0",
  "accent-fg": "#ffffff",
};

const w = (id: string, label: string, accent: string): Theme => ({
  id,
  label,
  group: "white-base",
  tokens: {...W, accent},
});

export const themes: Theme[] = [
  w("white-iris", "Iris", "#5b21b6"),
  w("white-indigo", "Indigo", "#4f46e5"),
  w("white-teal", "Teal", "#0d9488"),
  w("white-emerald", "Emerald", "#059669"),
  w("white-coral", "Coral", "#ea580c"),
  w("white-rose", "Rose", "#e11d48"),
  w("white-mustard", "Mustard", "#a16207"),
  w("white-slate", "Slate", "#475569"),
  {
    id: "warm-olive",
    label: "Warm Oat + Olive",
    group: "warm",
    tokens: {
      bg: "#fdfcf8",
      surface: "#f6f3ec",
      "surface-hover": "#efebde",
      fg: "#1a1a19",
      "fg-muted": "#5e5b54",
      "fg-subtle": "#76736b",
      line: "#e5e1d8",
      accent: "#2d5a3d",
      "accent-fg": "#fdfcf8",
    },
  },
  {
    id: "cream-burgundy",
    label: "Cream + Burgundy",
    group: "warm",
    tokens: {
      bg: "#fdfaf3",
      surface: "#f6f0e3",
      "surface-hover": "#ede5d2",
      fg: "#1f1815",
      "fg-muted": "#5e5046",
      "fg-subtle": "#7d6f63",
      line: "#ddd1bd",
      accent: "#7f1d1d",
      "accent-fg": "#fdfaf3",
    },
  },
  {
    id: "mint-forest",
    label: "Mint + Forest",
    group: "earthy",
    tokens: {
      bg: "#f7fbf8",
      surface: "#ecf3ee",
      "surface-hover": "#dde9e0",
      fg: "#0f1f15",
      "fg-muted": "#4a5d50",
      "fg-subtle": "#637669",
      line: "#d6e1d9",
      accent: "#15803d",
      "accent-fg": "#f7fbf8",
    },
  },
  {
    id: "sky-navy",
    label: "Sky + Navy",
    group: "earthy",
    tokens: {
      bg: "#f7fafc",
      surface: "#eaf1f6",
      "surface-hover": "#d9e5ed",
      fg: "#0a1929",
      "fg-muted": "#3a526a",
      "fg-subtle": "#5d738d",
      line: "#c8d8e3",
      accent: "#1e3a8a",
      "accent-fg": "#f7fafc",
    },
  },
];

export const groupOrder: ThemeGroup[] = ["white-base", "warm", "earthy"];

export const STORAGE_KEY = "lab-trading-theme";
export const DEFAULT_THEME_ID = "white-slate";

// 모드 axis
export type Mode = "system" | "light" | "dark";
export const MODE_KEY = "lab-trading-mode";
export const DEFAULT_MODE: Mode = "system";

// 컬러 시맨틱 axis (ADR-0012): 상승/하락 컬러
//   - korean: 빨강 ▲ / 파랑 ▼ (1차 출시 디폴트 — 한국어 사용자 익숙함)
//   - global: 초록 ▲ / 빨강 ▼ (TradingView / 미장 사용자 기대치)
export type ColorSemantics = "korean" | "global";
export const COLOR_SEMANTICS_KEY = "lab-trading-color-semantics";
export const DEFAULT_COLOR_SEMANTICS: ColorSemantics = "korean";

// 다크 모드 시 inline 에서 제거하는 라이트 전용 토큰. accent / accent-fg 는 항상 inline.
const LIGHT_ONLY_KEYS = [
  "bg",
  "surface",
  "surface-hover",
  "fg",
  "fg-muted",
  "fg-subtle",
  "line",
];

export function effectiveMode(mode: Mode): "light" | "dark" {
  if (mode === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme, mode: Mode = DEFAULT_MODE): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const effective = effectiveMode(mode);
  root.dataset.mode = effective;

  for (const k of LIGHT_ONLY_KEYS) {
    root.style.removeProperty(`--${k}`);
  }

  if (effective === "light") {
    for (const k of LIGHT_ONLY_KEYS) {
      const v = theme.tokens[k];
      if (v) root.style.setProperty(`--${k}`, v);
    }
  }

  if (theme.tokens.accent) {
    root.style.setProperty("--accent", theme.tokens.accent);
  }
  if (theme.tokens["accent-fg"]) {
    root.style.setProperty("--accent-fg", theme.tokens["accent-fg"]);
  }
}

export function applyColorSemantics(semantics: ColorSemantics): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.colorSemantics = semantics;
}

export function getTheme(id: string | null | undefined): Theme {
  const match = id ? themes.find((t) => t.id === id) : undefined;
  if (match) return match;
  return themes.find((t) => t.id === DEFAULT_THEME_ID) ?? themes[0];
}
