import {describe, expect, it, beforeEach} from "vitest";
import {applyBackup, BACKUP_KEYS, type BackupPayload} from "./user-data-backup";

// jsdom 환경 없음 — vitest 기본 node 라 window/localStorage 미지원.
// 그래서 가벼운 polyfill — global 에 minimal storage 박기.

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

beforeEach(() => {
  const store = new MemStorage();
  (globalThis as unknown as {window: object}).window = {
    localStorage: store,
  } as unknown as typeof window;
});

function setRaw(k: string, v: unknown) {
  (globalThis as unknown as {window: typeof window}).window.localStorage.setItem(
    k,
    typeof v === "string" ? v : JSON.stringify(v)
  );
}
function getRaw(k: string) {
  return (globalThis as unknown as {window: typeof window}).window.localStorage.getItem(k);
}

describe("applyBackup — replace mode", () => {
  it("기존 → 새 값으로 덮어쓰기", () => {
    setRaw("lab-trading-favorites", ["us:msft"]);
    const payload: BackupPayload = {
      version: 1,
      exportedAt: "2026-05-27T00:00:00Z",
      data: {
        "lab-trading-favorites": JSON.stringify(["us:aapl", "us:nvda"]),
      },
    };
    const r = applyBackup(payload, "replace");
    expect(r.applied).toContain("lab-trading-favorites");
    expect(JSON.parse(getRaw("lab-trading-favorites")!)).toEqual([
      "us:aapl",
      "us:nvda",
    ]);
  });

  it("알 수 없는 key 는 skip", () => {
    const payload: BackupPayload = {
      version: 1,
      exportedAt: "2026-05-27T00:00:00Z",
      data: {
        "lab-trading-favorites": JSON.stringify(["us:aapl"]),
        "evil-key-injection": JSON.stringify(["malicious"]),
      },
    };
    const r = applyBackup(payload, "replace");
    expect(r.applied).toContain("lab-trading-favorites");
    expect(r.skipped).toContain("evil-key-injection");
    expect(getRaw("evil-key-injection")).toBeNull();
  });
});

describe("applyBackup — merge mode", () => {
  it("array dedup union (favorites)", () => {
    setRaw("lab-trading-favorites", ["us:msft", "us:aapl"]);
    const payload: BackupPayload = {
      version: 1,
      exportedAt: "2026-05-27T00:00:00Z",
      data: {
        "lab-trading-favorites": JSON.stringify(["us:aapl", "us:nvda"]),
      },
    };
    applyBackup(payload, "merge");
    const merged = JSON.parse(getRaw("lab-trading-favorites")!);
    // msft, aapl, nvda — aapl 중복 dedup
    expect(merged).toEqual(["us:msft", "us:aapl", "us:nvda"]);
  });

  it("object shallow merge (labels)", () => {
    setRaw("lab-trading-favorite-labels", {
      "us:msft": ["기술"],
    });
    const payload: BackupPayload = {
      version: 1,
      exportedAt: "2026-05-27T00:00:00Z",
      data: {
        "lab-trading-favorite-labels": JSON.stringify({
          "us:aapl": ["관심"],
        }),
      },
    };
    applyBackup(payload, "merge");
    const merged = JSON.parse(getRaw("lab-trading-favorite-labels")!);
    expect(merged["us:msft"]).toEqual(["기술"]);
    expect(merged["us:aapl"]).toEqual(["관심"]);
  });

  it("id 기반 dedup (paper trades)", () => {
    setRaw("lab-trading-paper-trades", [
      {id: "t1", side: "buy", symbol: "btc", price: 100},
      {id: "t2", side: "buy", symbol: "btc", price: 110},
    ]);
    const payload: BackupPayload = {
      version: 1,
      exportedAt: "2026-05-27T00:00:00Z",
      data: {
        "lab-trading-paper-trades": JSON.stringify([
          {id: "t2", side: "buy", symbol: "btc", price: 110}, // dup
          {id: "t3", side: "sell", symbol: "btc", price: 130},
        ]),
      },
    };
    applyBackup(payload, "merge");
    const merged = JSON.parse(getRaw("lab-trading-paper-trades")!);
    expect(merged.length).toBe(3);
    expect(merged.map((t: {id: string}) => t.id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("applyBackup — invalid", () => {
  it("null payload → invalid", () => {
    const r = applyBackup(null, "replace");
    expect(r.invalid).toBe(true);
  });
  it("no data field → invalid", () => {
    const r = applyBackup({version: 1, exportedAt: "x"}, "replace");
    expect(r.invalid).toBe(true);
  });
});

describe("BACKUP_KEYS", () => {
  it("known set 포함", () => {
    expect(BACKUP_KEYS).toContain("lab-trading-favorites");
    expect(BACKUP_KEYS).toContain("lab-trading-paper-trades");
    expect(BACKUP_KEYS).toContain("lab-trading-saved-strategies");
  });
});
