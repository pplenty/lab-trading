// 한글 초성 추출 — 검색 부분 매칭 보강 (예: "ㅂㅌㅋ" → "비트코인").
//
// 유니코드 한글 음절 영역 [U+AC00..U+D7A3]
//   syllable - 0xAC00 = (cho_idx * 588) + (jung_idx * 28) + jong_idx
//   cho 19 + jung 21 + jong 28 (포함 0=종성 없음)
//
// 초성 추출만 — 중성/종성 추출은 fuzzy 검색 확장 시 추가.

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const CHO_TABLE = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".split("");

/** 한글 음절 1자 → 초성 1자. 한글 아니면 그대로 반환. */
export function jamoCho(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return ch;
  const choIdx = Math.floor((code - HANGUL_START) / 588);
  return CHO_TABLE[choIdx] ?? ch;
}

/** 문자열 전체 → 초성 시퀀스 (한글이 아닌 문자는 그대로). */
export function jamoChoString(s: string): string {
  let out = "";
  for (const ch of s) out += jamoCho(ch);
  return out;
}

/** 입력 문자열이 *순수 초성만* 으로 구성됐는지 (검색 query 가 초성 매칭 의도인지 판정). */
export function isPureChoSet(s: string): boolean {
  if (s.length === 0) return false;
  for (const ch of s) {
    if (!CHO_TABLE.includes(ch)) return false;
  }
  return true;
}
