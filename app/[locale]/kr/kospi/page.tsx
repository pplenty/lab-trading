import {Link} from "@/i18n/navigation";

export const metadata = {
  title: "KOSPI — 준비 중",
  robots: {index: false},
};

export const revalidate = 86400;

// stub — KOSPI 전용 인덱스는 Phase 1.5. 1차는 /kr 통합 인덱스에 KOSPI/KOSDAQ 같이.
// AssetSidebar 가 stub 표시로 클릭 비활성이지만 직접 URL 진입 대비 friendly 안내 페이지.

export default function KospiStubPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-wider text-fg-subtle">코스피</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        준비 중
      </h1>
      <p className="mt-3 text-sm text-fg-muted">
        KOSPI 전용 인덱스는 Phase 1.5 에 활성화 예정입니다. 현재는 통합 화면에서
        KOSPI · KOSDAQ 종목을 함께 보실 수 있습니다.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link
          href="/kr"
          className="inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 font-medium text-fg transition-colors hover:bg-surface-hover"
        >
          국내주식 통합 보기 →
        </Link>
        <Link
          href="/kr/volume"
          className="inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 font-medium text-fg-muted transition-colors hover:text-fg"
        >
          거래량 랭킹
        </Link>
      </div>
    </main>
  );
}
