import {describe, it, expect} from "vitest";
import {buildSymbolFaq, faqJsonLd, type SymbolFaqInput} from "./faq";

const base: SymbolFaqInput = {
  cls: "crypto",
  displayName: "비트코인",
  label: "BTC",
  market: null,
  sector: "Layer 1",
  desc: "최초의 암호화폐이자 시가총액 1위 디지털 자산.",
  asOf: Math.floor(Date.UTC(2026, 5, 8) / 1000), // 2026-06-08 00:00 UTC
  current: 150_000_000,
  changePct: 2.34,
  high52: 160_000_000,
  low52: 80_000_000,
  ret1m: 5.1,
  ret3m: -3.2,
  ret1y: 42.0,
};

describe("buildSymbolFaq", () => {
  it("모든 데이터가 있으면 5개 Q&A 생성 (현재가/52주/수익률/소개/백테스트)", () => {
    const items = buildSymbolFaq(base);
    expect(items).toHaveLength(5);
    expect(items[0].q).toContain("비트코인(BTC) 현재 가격");
    expect(items[0].a).toContain("150,000,000원");
    expect(items[0].a).toContain("+2.34%");
    expect(items[0].a).toContain("상승");
    // 거래일은 UTC 컴포넌트 기준 결정적
    expect(items[0].a).toContain("2026년 6월 8일");
  });

  it("52주 카드는 최고가 대비 위치를 포함", () => {
    const items = buildSymbolFaq(base);
    const q52 = items.find((i) => i.q.includes("52주"));
    expect(q52).toBeDefined();
    expect(q52!.a).toContain("160,000,000원");
    expect(q52!.a).toContain("80,000,000원");
    // 150,000,000 / 160,000,000 - 1 = -6.25%
    expect(q52!.a).toContain("-6.25%");
    expect(q52!.a).toContain("낮은");
  });

  it("수익률 Q는 null 기간을 생략", () => {
    const items = buildSymbolFaq({...base, ret3m: null});
    const ret = items.find((i) => i.q.includes("수익률"))!;
    expect(ret.a).toContain("1개월 +5.10%");
    expect(ret.a).not.toContain("3개월");
    expect(ret.a).toContain("1년 +42.00%");
  });

  it("데이터가 전혀 없어도 소개+백테스트 2개는 항상 생성", () => {
    const items = buildSymbolFaq({
      ...base,
      current: null,
      changePct: null,
      high52: null,
      low52: null,
      ret1m: null,
      ret3m: null,
      ret1y: null,
    });
    expect(items).toHaveLength(2);
    expect(items[0].q).toContain("어떤 코인인가요");
    expect(items[1].q).toContain("백테스트가 가능한가요");
  });

  it("한글 조사: 받침 있으면 은, 없으면 는", () => {
    const withBatchim = buildSymbolFaq({...base, displayName: "이더리움클래식"});
    expect(withBatchim.find((i) => i.q.includes("어떤"))!.q).toContain(
      "이더리움클래식은 어떤"
    );
    const noBatchim = buildSymbolFaq({...base, displayName: "비트코인"});
    // "비트코인" 끝 "인" → 받침 ㄴ → 은
    expect(noBatchim.find((i) => i.q.includes("어떤"))!.q).toContain(
      "비트코인은 어떤"
    );
    const vowelEnd = buildSymbolFaq({...base, displayName: "삼성전자", cls: "kr"});
    // "삼성전자" 끝 "자" → 받침 없음 → 는
    expect(vowelEnd.find((i) => i.q.includes("어떤"))!.q).toContain(
      "삼성전자는 어떤"
    );
  });

  it("us 종목은 달러 표기 + 종목 단어 사용", () => {
    const items = buildSymbolFaq({
      ...base,
      cls: "us",
      displayName: "애플",
      label: "AAPL",
      market: "NASDAQ",
      sector: "기술",
      current: 212.34,
      high52: 250,
      low52: 160,
    });
    expect(items[0].a).toContain("$212.34");
    expect(items.find((i) => i.q.includes("어떤"))!.q).toContain("어떤 종목인가요");
    expect(items.find((i) => i.q.includes("어떤"))!.a).toContain("NASDAQ");
    expect(items.find((i) => i.q.includes("어떤"))!.a).toContain("기술 섹터");
  });

  it("초소액 코인은 유효숫자 보존", () => {
    const items = buildSymbolFaq({
      ...base,
      displayName: "시바이누",
      label: "SHIB",
      current: 0.0000234,
      high52: 0.00005,
      low52: 0.00001,
    });
    expect(items[0].a).toContain("0.0000234원");
  });
});

describe("faqJsonLd", () => {
  it("FAQPage 스키마 + Question/Answer 매핑", () => {
    const items = buildSymbolFaq(base);
    const json = JSON.parse(faqJsonLd(items));
    expect(json["@type"]).toBe("FAQPage");
    expect(json.mainEntity).toHaveLength(items.length);
    expect(json.mainEntity[0]["@type"]).toBe("Question");
    expect(json.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    expect(json.mainEntity[0].name).toBe(items[0].q);
    expect(json.mainEntity[0].acceptedAnswer.text).toBe(items[0].a);
  });
});
