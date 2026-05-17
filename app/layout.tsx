import "./globals.css";
import {Geist, Geist_Mono} from "next/font/google";
import {
  themes,
  STORAGE_KEY,
  MODE_KEY,
  COLOR_SEMANTICS_KEY,
  DEFAULT_THEME_ID,
  DEFAULT_MODE,
  DEFAULT_COLOR_SEMANTICS,
} from "@/lib/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 첫 페인트 전 localStorage 에서 사용자 테마·모드·컬러 시맨틱을 읽어 :root 토큰을 적용 → FOUC 방지.
// yutils 차용 + 컬러 시맨틱 axis (ADR-0012) 추가.
const themeInitScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var m=localStorage.getItem(${JSON.stringify(MODE_KEY)})||${JSON.stringify(DEFAULT_MODE)};var c=localStorage.getItem(${JSON.stringify(COLOR_SEMANTICS_KEY)})||${JSON.stringify(DEFAULT_COLOR_SEMANTICS)};var T=${JSON.stringify(themes)};var d=${JSON.stringify(DEFAULT_THEME_ID)};var t=T.find(function(x){return x.id===s})||T.find(function(x){return x.id===d})||T[0];if(!t)return;var e=m==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):(m==='dark'?'dark':'light');var r=document.documentElement;r.dataset.mode=e;r.dataset.colorSemantics=c;var L=['bg','surface','surface-hover','fg','fg-muted','fg-subtle','line'];if(e==='light'){L.forEach(function(k){if(t.tokens[k])r.style.setProperty('--'+k,t.tokens[k])})}if(t.tokens.accent)r.style.setProperty('--accent',t.tokens.accent);if(t.tokens['accent-fg'])r.style.setProperty('--accent-fg',t.tokens['accent-fg']);}catch(e){}})();`;

// theme init script 를 React 트리 외부에 두기 위한 패턴 (yutils 동일):
// div + dangerouslySetInnerHTML 로 raw <script> wrap → React 가 컴포넌트로 검사 X, 경고 X.
// SSR HTML 에 즉시 박혀 body parse 시점에 실행 (paint 전).
const themeInitHtml = `<script>${themeInitScript}</script>`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg text-fg font-sans">
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{__html: themeInitHtml}}
        />
        {children}
      </body>
    </html>
  );
}
