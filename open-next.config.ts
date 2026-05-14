import {defineCloudflareConfig} from "@opennextjs/cloudflare";

// ADR-0003: Cloudflare 어댑터 설정.
// 1차 출시는 SSG + 짧은 TTL ISR 위주(ADR-0009). 별도 옵션 없이 default.
// ISR 캐시 store (R2/KV) 도입 시점에 본 옵션 갱신 → ADR.
export default defineCloudflareConfig({});
