import type {ChartRange} from "./range";
import type {Timeframe} from "./timeframe";

// 차트 range / timeframe 토글 링크의 href 빌더.
//
// 왜 별도 헬퍼인가:
//   기존 토글은 `${basePath}?range=${r}` 처럼 무조건 "?range=" 를 append 했다.
//   basePath 가 이미 query 를 가진 경우(예: /compare?symbols=a,b) 두 번째 "?" 가 붙어
//   `/compare?symbols=a,b?range=5y` 같은 깨진 URL 이 되고, 그 값이 symbols 파라미터에
//   섞여 다음 클릭마다 range 가 무한 append 되는 버그가 있었다.
//
// 규칙:
//   - basePath 의 첫 "?" 기준으로 path / 기존 query 분리
//   - 기존 query 에서 range·tf 키는 제거(토글이 소유 → 항상 교체, 누적 방지)
//   - 나머지 param(symbols 등)은 보존
//   - tf 가 없거나 "1d"(기본값)면 tf 생략 → URL 깔끔
export function buildToggleHref(
  basePath: string,
  params: {range?: ChartRange; tf?: Timeframe}
): string {
  const qIdx = basePath.indexOf("?");
  const path = qIdx === -1 ? basePath : basePath.slice(0, qIdx);
  const existing = qIdx === -1 ? "" : basePath.slice(qIdx + 1);

  const preserved = existing
    .split("&")
    .filter(
      (kv) =>
        kv.length > 0 && !kv.startsWith("range=") && !kv.startsWith("tf=")
    );

  const out = [...preserved];
  if (params.range) out.push(`range=${params.range}`);
  if (params.tf && params.tf !== "1d") out.push(`tf=${params.tf}`);

  return out.length > 0 ? `${path}?${out.join("&")}` : path;
}
