// 사용자 자산 백업/복원 — localStorage 의 모든 lab-trading-* key 를
// JSON 한 파일로 export / import.
//
// 호환성:
//   - version 1 — 본 형식
//   - schema 가 바뀌어도 backup 의 version 으로 식별
//   - keys 만 합쳐 import — 알 수 없는 key 는 무시 (보안)

export const BACKUP_VERSION = 1;

/** 백업에 포함될 모든 localStorage key — 한 곳에서 관리. */
export const BACKUP_KEYS = [
  "lab-trading-favorites",
  "lab-trading-favorite-labels",
  "lab-trading-recents",
  "lab-trading-price-alerts",
  "lab-trading-symbol-notes",
  "lab-trading-paper-trades",
  "lab-trading-portfolio-snapshots",
  "lab-trading-saved-strategies",
  "lab-trading-chart-overlays",
  // 테마/컬러 시맨틱 등 가벼운 환경 설정
  "lab-trading-color-semantics",
  "lab-trading-light-preset",
  "lab-trading-mode",
  "lab-trading-replay-pref",
] as const;

export type BackupKey = (typeof BACKUP_KEYS)[number];

export type BackupPayload = {
  version: number;
  exportedAt: string; // ISO
  data: Record<string, string>; // raw localStorage 값
};

export function buildBackup(): BackupPayload {
  const data: Record<string, string> = {};
  if (typeof window === "undefined") {
    return {version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data};
  }
  for (const k of BACKUP_KEYS) {
    const v = window.localStorage.getItem(k);
    if (v !== null) data[k] = v;
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export type ImportMode = "merge" | "replace";

/**
 * import 결과 요약 — 변경된 key + skipped (알 수 없는 key) + 잘못된 JSON.
 */
export type ImportResult = {
  applied: string[];
  skipped: string[]; // unknown keys
  invalid: boolean; // payload 자체 invalid
};

/**
 * payload 검증 + 적용.
 * - mode "replace": 알 수 있는 key 만 덮어쓰기 (다른 lab-trading-* key 는 건드림 X)
 * - mode "merge": 단순 array/object 만 merge (배열은 dedup union, object 는 shallow merge).
 *   복잡한 nested merge 는 안 — 충돌 위험. merge 가 어려운 key 는 replace 로 fallback.
 */
export function applyBackup(payload: unknown, mode: ImportMode): ImportResult {
  if (typeof window === "undefined") {
    return {applied: [], skipped: [], invalid: true};
  }
  const result: ImportResult = {applied: [], skipped: [], invalid: false};
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    typeof (payload as BackupPayload).data !== "object"
  ) {
    result.invalid = true;
    return result;
  }
  const data = (payload as BackupPayload).data;
  const allowed = new Set<string>(BACKUP_KEYS);
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.has(k)) {
      result.skipped.push(k);
      continue;
    }
    if (typeof v !== "string") continue;
    if (mode === "replace") {
      window.localStorage.setItem(k, v);
      result.applied.push(k);
      continue;
    }
    // merge — 단순 array/object dedup
    try {
      const incoming = JSON.parse(v);
      const existingRaw = window.localStorage.getItem(k);
      const existing = existingRaw ? JSON.parse(existingRaw) : null;
      const merged = mergeJson(existing, incoming);
      window.localStorage.setItem(k, JSON.stringify(merged));
      result.applied.push(k);
    } catch {
      // JSON 아니면 replace fallback
      window.localStorage.setItem(k, v);
      result.applied.push(k);
    }
  }
  // localStorage 변경 알림 (useSyncExternalStore 패턴 — storage event 는 same-tab 안 fire,
  // 같은 탭에서 변경 즉시 반영을 위해 강제 reload 권장 — settings UI 가 안내)
  return result;
}

function mergeJson(existing: unknown, incoming: unknown): unknown {
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    // dedup by id (object) or value (primitive)
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const v of [...existing, ...incoming]) {
      const key =
        v !== null && typeof v === "object" && "id" in v
          ? `id:${(v as {id: unknown}).id}`
          : typeof v === "string" || typeof v === "number"
          ? `v:${v}`
          : JSON.stringify(v);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }
  if (
    existing &&
    typeof existing === "object" &&
    incoming &&
    typeof incoming === "object"
  ) {
    return {...(existing as object), ...(incoming as object)};
  }
  return incoming; // primitive 또는 type 다름 → 덮어쓰기
}

/** download trigger — backup payload 를 JSON 파일로 저장. */
export function downloadBackup(payload: BackupPayload, filename?: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `lab-trading-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
