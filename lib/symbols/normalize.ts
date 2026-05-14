import type {AssetClass, Symbol} from "@/lib/types";

// raw 입력 → 정규화 사이트 심볼 (ADR-0010).
//   crypto / us: lowercase ticker (앞뒤 공백 trim, 숫자/문자만)
//   kr:          6자리 코드 그대로 (왼쪽 0 padding)
// 정상화 후 빈 문자열이면 throw.

const CRYPTO_US_RE = /^[a-z0-9]+$/;
const KR_RE = /^\d{6}$/;

export function toSymbol(raw: string, klass: AssetClass): Symbol {
  if (!raw) throw new Error("toSymbol: empty input");
  const trimmed = raw.trim();

  if (klass === "kr") {
    // KR: 6자리 숫자만. 4자리 입력이면 왼쪽에 0 padding.
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 0) throw new Error(`toSymbol(kr): no digits in ${raw}`);
    const padded = digits.padStart(6, "0").slice(-6);
    if (!KR_RE.test(padded)) throw new Error(`toSymbol(kr): invalid ${raw}`);
    return padded;
  }

  // crypto / us: lowercase, alphanumeric only
  const lower = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!CRYPTO_US_RE.test(lower)) throw new Error(`toSymbol(${klass}): invalid ${raw}`);
  return lower;
}
