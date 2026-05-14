import {defineConfig, globalIgnores} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare 어댑터 빌드 출력 (ADR-0003)
    ".open-next/**",
    ".wrangler/**",
    // Drizzle 마이그레이션 자동 생성물
    "drizzle/**",
  ]),
]);

export default eslintConfig;
