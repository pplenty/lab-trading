// 두벌식 한↔영 키보드 layout 변환. 한글 IME OFF 상태에서 영문으로 친 input 을 한글로 해석.
//
// 예: "qlxmzhdls" → "비트코인"
//     "tkdtjdwjswk" → "삼성전자"
//     "dkdvmf" → "애플"
//
// 매핑:
//   ㅂ(q) ㅈ(w) ㄷ(e) ㄱ(r) ㅅ(t) ㅛ(y) ㅕ(u) ㅑ(i) ㅐ(o) ㅔ(p)
//   ㅁ(a) ㄴ(s) ㅇ(d) ㄹ(f) ㅎ(g) ㅗ(h) ㅓ(j) ㅏ(k) ㅣ(l)
//   ㅋ(z) ㅌ(x) ㅊ(c) ㅍ(v) ㅠ(b) ㅜ(n) ㅡ(m)
// 쌍자음/이중모음 (Shift+key) 는 본 검색 입력에선 거의 쓰일 일 X — 미지원.
//
// 정확한 음절 조합 (cho + jung + jong → syllable) 까지 안 해도 검색 매칭만 가능 —
// 자모 시퀀스 그대로 두고 *한글 자모 substring* 으로 종목명 매칭. 단, "비트" 같은
// 일반 한글 query 와 매칭하려면 syllable 조합이 필요 — full 변환 구현.

const EN_TO_HANGUL_JAMO: Record<string, string> = {
  // 자음 (cho/jong 공통)
  q: "ㅂ", w: "ㅈ", e: "ㄷ", r: "ㄱ", t: "ㅅ",
  a: "ㅁ", s: "ㄴ", d: "ㅇ", f: "ㄹ", g: "ㅎ",
  z: "ㅋ", x: "ㅌ", c: "ㅊ", v: "ㅍ",
  // 모음 (jung)
  y: "ㅛ", u: "ㅕ", i: "ㅑ", o: "ㅐ", p: "ㅔ",
  h: "ㅗ", j: "ㅓ", k: "ㅏ", l: "ㅣ",
  b: "ㅠ", n: "ㅜ", m: "ㅡ",
};

const CHO_LIST = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".split("");
const JUNG_LIST = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".split("");
const JONG_LIST = [
  "",
  "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
  "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ",
  "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

function isJamoVowel(j: string): boolean {
  return JUNG_LIST.indexOf(j) >= 0;
}
function isJamoConsonant(j: string): boolean {
  return CHO_LIST.indexOf(j) >= 0 || JONG_LIST.indexOf(j) > 0;
}

/** 영문 두벌식 시퀀스를 한글 자모 시퀀스로 변환 (음절 조합 X). */
function enToJamo(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) {
    const mapped = EN_TO_HANGUL_JAMO[ch];
    out += mapped ?? ch;
  }
  return out;
}

/**
 * 한글 자모 시퀀스 → 한글 음절 조합.
 *   "ㅂㅣㅌㅡㅋㅗㅇㅣㄴ" → "비트코인" 같이.
 * greedy: cho + jung + (optional jong, 다음 자음 + 다음 모음이면 jong X) 패턴.
 */
function jamoToSyllables(jamo: string): string {
  let out = "";
  let i = 0;
  while (i < jamo.length) {
    const c = jamo[i];
    // 자음(cho 후보) 시작
    if (isJamoConsonant(c) && i + 1 < jamo.length && isJamoVowel(jamo[i + 1])) {
      const choIdx = CHO_LIST.indexOf(c);
      const jung = jamo[i + 1];
      const jungIdx = JUNG_LIST.indexOf(jung);
      if (choIdx < 0 || jungIdx < 0) {
        out += c;
        i++;
        continue;
      }
      // jong 후보: 다음 자음이 있고 그 다음이 모음 아니면 jong, 아니면 다음 음절 cho
      let jongIdx = 0;
      let consumed = 2;
      if (i + 2 < jamo.length) {
        const next = jamo[i + 2];
        const nextIsCons = isJamoConsonant(next);
        const afterNextIsVowel =
          i + 3 < jamo.length && isJamoVowel(jamo[i + 3]);
        if (nextIsCons && !afterNextIsVowel) {
          // jong 으로 흡수
          const candidateJong = JONG_LIST.indexOf(next);
          if (candidateJong > 0) {
            jongIdx = candidateJong;
            consumed = 3;
          }
        }
      }
      const syllable = String.fromCharCode(
        0xac00 + choIdx * 588 + jungIdx * 28 + jongIdx
      );
      out += syllable;
      i += consumed;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * 영문 두벌식 input → 한글 음절. 변환 실패 (영문만 들어옴) 시 원본 반환.
 * 본 변환의 안정성을 위해 input 전체가 영문 알파벳일 때만 적용.
 */
export function convertEngToHangul(input: string): string {
  if (!input) return input;
  // 영문 (a-z) + 매핑 가능한 글자만 있는지 검사 — 한글이 섞여있으면 변환 안 함.
  const allEng = /^[a-zA-Z]+$/.test(input);
  if (!allEng) return input;
  return jamoToSyllables(enToJamo(input));
}

/** 변환 결과가 *유효한 한글 음절* 을 하나 이상 포함하는지 (검색 시도 가치 판단). */
export function hasHangulSyllable(s: string): boolean {
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return true;
  }
  return false;
}
