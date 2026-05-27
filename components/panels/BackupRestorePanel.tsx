"use client";

import {useRef, useState} from "react";
import {Download, Upload, AlertCircle, Check} from "lucide-react";
import {
  applyBackup,
  buildBackup,
  downloadBackup,
  type ImportMode,
  type ImportResult,
} from "@/lib/user-data-backup";

// 사용자 자산 백업/복원 — 모든 lab-trading-* localStorage 키 → JSON.
// "내보내기" 즉시 다운로드 + "가져오기" 파일 선택 → merge / replace 선택.

export function BackupRestorePanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{
    payload: unknown;
    fileName: string;
  } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onExport() {
    const payload = buildBackup();
    const totalKeys = Object.keys(payload.data).length;
    if (totalKeys === 0) {
      setError("저장된 자산이 없습니다. 즐겨찾기/메모/거래 후 다시 시도해보세요.");
      return;
    }
    setError(null);
    downloadBackup(payload);
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("data" in parsed) ||
        typeof (parsed as {data: unknown}).data !== "object"
      ) {
        setError("백업 파일 형식이 올바르지 않습니다.");
        return;
      }
      setPending({payload: parsed, fileName: file.name});
    } catch (err) {
      setError(`JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // 같은 파일 재선택 가능하도록 reset
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function apply(mode: ImportMode) {
    if (!pending) return;
    const r = applyBackup(pending.payload, mode);
    setResult(r);
    setPending(null);
    if (r.applied.length > 0) {
      // localStorage 변경은 same-tab event 안 fire — 반영 위해 reload 권장
      setTimeout(() => {
        if (window.confirm("복원이 적용되었습니다. 페이지를 새로고침할까요?")) {
          window.location.reload();
        }
      }, 100);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-bg px-3 text-xs font-medium text-fg transition-colors hover:border-fg-subtle"
        >
          <Download size={12} aria-hidden="true" />
          내보내기 (JSON)
        </button>
        <label
          htmlFor="backup-file-input"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-bg px-3 text-xs font-medium text-fg transition-colors hover:border-fg-subtle"
        >
          <Upload size={12} aria-hidden="true" />
          가져오기
        </label>
        <input
          ref={fileRef}
          id="backup-file-input"
          type="file"
          accept="application/json,.json"
          onChange={onFileSelected}
          className="sr-only"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-down)]/40 bg-[var(--color-down)]/5 p-3 text-xs text-[var(--color-down)]">
          <AlertCircle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {pending && (
        <div className="rounded-md border border-line bg-surface/40 p-3 text-xs">
          <p className="font-medium text-fg">
            "{pending.fileName}" 파일 적용 방식 선택
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[11px] text-fg-muted">
            <li>
              <span className="font-medium text-fg-muted">병합</span> — 기존 데이터에
              추가 (즐겨찾기/메모/거래 중복은 자동 dedup, 라벨은 union).
            </li>
            <li>
              <span className="font-medium text-fg-muted">덮어쓰기</span> — 기존
              데이터를 백업 파일로 교체. 백업 외 key 는 유지.
            </li>
          </ul>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border border-line bg-bg px-3 py-1 text-xs text-fg-subtle hover:text-fg"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => apply("merge")}
              className="rounded-md border border-line bg-bg px-3 py-1 text-xs font-medium text-fg hover:border-fg-subtle"
            >
              병합
            </button>
            <button
              type="button"
              onClick={() => apply("replace")}
              className="rounded-md bg-fg px-3 py-1 text-xs font-medium text-bg hover:opacity-90"
            >
              덮어쓰기
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-up)]/40 bg-[var(--color-up)]/5 p-3 text-xs text-[var(--color-up)]">
          <Check size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            적용 완료 · {result.applied.length}개 키 갱신
            {result.skipped.length > 0 && (
              <>
                {" · 알 수 없는 key "}
                {result.skipped.length}개 무시
              </>
            )}
          </span>
        </div>
      )}

      <p className="text-[10px] text-fg-subtle">
        JSON 안에는 즐겨찾기 · 라벨 · 메모 · 알림 · 거래 · 전략 · 차트 overlay 선택
        · portfolio snapshot 등이 포함됩니다. 다른 디바이스에 가져가서 복원하면 동일
        상태로 시작할 수 있습니다.
      </p>
    </div>
  );
}
