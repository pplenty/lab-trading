import {getTranslations} from "next-intl/server";

// Phase 1 점등 전 자산군·기능 인덱스 페이지의 공용 stub.
// 셸이 동작함을 보여주는 최소 점등 — 실제 데이터 어댑터 + 차트 + 표는 후속 PR.
type Props = {
  /** 페이지 제목 (i18n 처리된 문자열) */
  title: string;
  /** Phase 표기 (예: "Phase 1.5", "Phase 1") */
  phase?: string;
  /** 페이지 설명 (i18n 처리된 문자열) */
  description?: string;
};

export async function StubPage({title, phase, description}: Props) {
  const t = await getTranslations("home");
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-16">
      <div className="flex flex-col gap-4">
        {phase && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
            {phase}
          </span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-base text-fg-muted">{description}</p>
        )}
        <p className="max-w-2xl text-sm text-fg-subtle">{t("kickoffNote")}</p>
      </div>
    </main>
  );
}
