import type {Config} from "drizzle-kit";

// Drizzle Kit 설정 — 마이그레이션 SQL 생성 (`drizzle/0000_*.sql` 등).
// 실행: `bun run db:generate`
// D1 적용: `bun run db:migrate` (wrangler 가 .open-next/migration_status 추적).
export default {
  schema: "./lib/db/d1/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
} satisfies Config;
