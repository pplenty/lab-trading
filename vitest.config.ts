import {defineConfig} from "vitest/config";
import path from "node:path";

// Vitest 설정 — Node 환경 (백테스트 / 어댑터 / 지표 등 server-side 로직 검증).
// React 컴포넌트 테스트는 1차 출시 후 도입 (jsdom + @testing-library/react).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "lib/db/d1/schema.ts"],
    },
  },
});
