import type {D1Database} from "@cloudflare/workers-types";
import {drizzle, type DrizzleD1Database} from "drizzle-orm/d1";
import {getCloudflareContext} from "@opennextjs/cloudflare";
import * as schema from "./schema";

// D1 binding 을 Drizzle 인스턴스로 wrapping (ADR-0021).
// `wrangler.jsonc` 의 `d1_databases[].binding="DB"` 에서 노출.
// CloudflareEnv.DB 를 통해 접근 — opennextjs/cloudflare 가 server-side 에서 주입.

export type Schema = typeof schema;
export type LabTradingDB = DrizzleD1Database<Schema>;

let cached: LabTradingDB | null = null;

/**
 * D1 binding 으로 만든 Drizzle 인스턴스 반환.
 * dev 에선 `wrangler dev` 의 local D1 (sqlite file) · production 은 CF D1.
 * binding 미정의 (D1 namespace 미생성) 시 throw — 호출 측이 try/catch 로 graceful 처리.
 */
export async function getDb(): Promise<LabTradingDB> {
  if (cached) return cached;
  // getCloudflareContext: try sync 먼저, async fallback (cf:preview / production 양쪽 호환).
  let env: unknown;
  try {
    env = getCloudflareContext().env;
  } catch {
    env = (await getCloudflareContext({async: true})).env;
  }
  // binding 이름 유연하게 — `DB` (관용) 또는 `lab_trading_db` (snake_case) 둘 다 지원.
  const cfEnv = env as {
    DB?: D1Database;
    lab_trading_db?: D1Database;
  };
  const d1 = cfEnv.DB ?? cfEnv.lab_trading_db;
  if (!d1) {
    const keys = env ? Object.keys(env as object).join(", ") : "(no env)";
    throw new Error(
      `D1 binding 미설정 — wrangler.jsonc 의 d1_databases binding 이름 확인 필요. 현재 env keys: ${keys}`
    );
  }
  cached = drizzle(d1, {schema});
  return cached;
}

/**
 * D1 binding 이 사용 가능한지만 확인 (throw 없이).
 * 페이지가 D1 미설정 환경에서도 동작하도록 — graceful fallback 분기에 사용.
 */
export async function isDbAvailable(): Promise<boolean> {
  try {
    let env: unknown;
    try {
      env = getCloudflareContext().env;
    } catch {
      env = (await getCloudflareContext({async: true})).env;
    }
    const cfEnv = env as {
      DB?: D1Database;
      lab_trading_db?: D1Database;
    };
    return Boolean(cfEnv.DB ?? cfEnv.lab_trading_db);
  } catch {
    return false;
  }
}
