# scripts/fonts

`scripts/gen-og.ts` (정적 OG PNG 생성) 가 한글 글리프 렌더에 쓰는 Pretendard TTF.
용량(각 ~2.6MB) 때문에 **커밋하지 않는다** — 아래로 받아 두면 `bun run gen:og` 가 동작.

```bash
# Pretendard v1.3.9 release zip 에서 TTF 2개 추출
curl -sL -o /tmp/pretendard.zip \
  https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-1.3.9.zip
unzip -o -j /tmp/pretendard.zip \
  "public/static/alternative/Pretendard-Bold.ttf" \
  "public/static/alternative/Pretendard-Regular.ttf" \
  -d scripts/fonts/
```

생성된 `public/og/<asset>/<symbol>.png` 는 서빙 산출물이라 커밋된다.
registry(종목 목록) 변경 시에만 `bun run gen:og` 재실행 → 변경된 PNG 커밋.
