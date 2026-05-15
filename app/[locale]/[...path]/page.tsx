import {notFound} from "next/navigation";

// Catch-all — locale 안의 매칭 안 되는 모든 경로를 잡아 not-found.tsx 로 위임.
// Next.js 16 + next-intl 조합에서 default 404 가 [locale] 의 not-found.tsx 를
// 자동 잡지 못하는 케이스를 대응한다.
export default function CatchAllNotFound() {
  notFound();
}
