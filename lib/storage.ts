"use client";

import {useCallback, useSyncExternalStore} from "react";

// localStorage 동기화 훅 (yutils 차용).
// SSR 안전 (getServerSnapshot=defaultValue) + same-tab 동기 (module-level subscribers)
// + cross-tab 동기 (storage event). value 는 raw string — caller 가 JSON.parse 를
// useMemo 로 묶어 객체 referential 안정 유지.

const subscribers = new Map<string, Set<() => void>>();

function subscribe(key: string, cb: () => void): () => void {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(cb);

  function storageListener(e: StorageEvent) {
    if (e.key === key) cb();
  }
  window.addEventListener("storage", storageListener);

  return () => {
    set!.delete(cb);
    window.removeEventListener("storage", storageListener);
  };
}

function notify(key: string) {
  subscribers.get(key)?.forEach((cb) => cb());
}

export function useLocalStorageString(
  key: string,
  defaultValue: string
): [string, (next: string) => void] {
  const sub = useCallback((cb: () => void) => subscribe(key, cb), [key]);

  const getSnapshot = useCallback((): string => {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const value = useSyncExternalStore(sub, getSnapshot, () => defaultValue);

  const setValue = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
        notify(key);
      } catch {
        // ignore
      }
    },
    [key]
  );

  return [value, setValue];
}
