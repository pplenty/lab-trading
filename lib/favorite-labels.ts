"use client";

import {useCallback, useMemo} from "react";
import {useLocalStorageString} from "./storage";
import type {FavoriteId} from "./favorites";

// 즐겨찾기 라벨링 (D3) — favorites.ts 와 분리된 storage.
// 종목당 0+ 라벨. "기술주", "방어주", "코인", "관심" 등 자유 텍스트.
// favorites 자체는 string[] (backward-compat) — 라벨은 별도 Map.

const LABELS_KEY = "lab-trading-favorite-labels";

export type LabelsMap = Record<FavoriteId, string[]>;

// 라벨 정규화 — 양끝 공백 제거 + 16자 이내.
function normalizeLabel(raw: string): string | null {
  const t = raw.trim().slice(0, 16);
  return t.length > 0 ? t : null;
}

export function useFavoriteLabels() {
  const [raw, setRaw] = useLocalStorageString(LABELS_KEY, "{}");

  const labels = useMemo<LabelsMap>(() => {
    try {
      const o = JSON.parse(raw);
      if (!o || typeof o !== "object" || Array.isArray(o)) return {};
      const out: LabelsMap = {};
      for (const [k, v] of Object.entries(o)) {
        if (typeof k !== "string" || !k.includes(":")) continue;
        if (!Array.isArray(v)) continue;
        const arr = v
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter((x) => x.length > 0);
        if (arr.length > 0) out[k as FavoriteId] = arr;
      }
      return out;
    } catch {
      return {};
    }
  }, [raw]);

  // 사용 중인 모든 라벨 (count desc + 알파벳)
  const allLabels = useMemo<{label: string; count: number}[]>(() => {
    const counts = new Map<string, number>();
    for (const arr of Object.values(labels)) {
      for (const l of arr) {
        counts.set(l, (counts.get(l) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({label, count}))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label, "ko");
      });
  }, [labels]);

  const labelsFor = useCallback(
    (id: FavoriteId): string[] => labels[id] ?? [],
    [labels]
  );

  const addLabel = useCallback(
    (id: FavoriteId, rawLabel: string) => {
      const label = normalizeLabel(rawLabel);
      if (!label) return;
      const current = labels[id] ?? [];
      if (current.includes(label)) return;
      const next: LabelsMap = {...labels, [id]: [...current, label]};
      setRaw(JSON.stringify(next));
    },
    [labels, setRaw]
  );

  const removeLabel = useCallback(
    (id: FavoriteId, label: string) => {
      const current = labels[id] ?? [];
      const filtered = current.filter((l) => l !== label);
      const next = {...labels};
      if (filtered.length > 0) next[id] = filtered;
      else delete next[id];
      setRaw(JSON.stringify(next));
    },
    [labels, setRaw]
  );

  /** 전체 종목에서 같은 라벨 일괄 rename. */
  const renameLabel = useCallback(
    (oldLabel: string, rawNewLabel: string) => {
      const newLabel = normalizeLabel(rawNewLabel);
      if (!newLabel || newLabel === oldLabel) return;
      const next: LabelsMap = {};
      for (const [k, arr] of Object.entries(labels)) {
        const replaced = arr.map((l) => (l === oldLabel ? newLabel : l));
        // dedup (newLabel 이 이미 있는 경우)
        const seen = new Set<string>();
        const final = replaced.filter((l) => {
          if (seen.has(l)) return false;
          seen.add(l);
          return true;
        });
        if (final.length > 0) next[k as FavoriteId] = final;
      }
      setRaw(JSON.stringify(next));
    },
    [labels, setRaw]
  );

  /** 전체 종목에서 같은 라벨 일괄 삭제. */
  const deleteLabelEverywhere = useCallback(
    (label: string) => {
      const next: LabelsMap = {};
      for (const [k, arr] of Object.entries(labels)) {
        const filtered = arr.filter((l) => l !== label);
        if (filtered.length > 0) next[k as FavoriteId] = filtered;
      }
      setRaw(JSON.stringify(next));
    },
    [labels, setRaw]
  );

  return {
    labels,
    allLabels,
    labelsFor,
    addLabel,
    removeLabel,
    renameLabel,
    deleteLabelEverywhere,
  };
}
