import {kisAdapter} from "@/lib/adapters/kis";

export const revalidate = 300;
import {krRegistry} from "@/lib/symbols/registry";
import {RankingPage} from "@/components/panels/RankingPage";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function KrVolumePage({params}: Props) {
  const {locale} = await params;
  const nameMap = Object.fromEntries(
    krRegistry.map((e) => [e.symbol, {name: e.name, nameKo: e.nameKo}])
  );
  return (
    <RankingPage
      class="kr"
      kind="volume"
      adapter={kisAdapter}
      locale={locale}
      nameMap={nameMap}
      sourceLabel="KIS (demo)"
      symbols={krRegistry.map((e) => e.symbol)}
    />
  );
}
