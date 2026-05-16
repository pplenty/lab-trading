import {kisAdapter} from "@/lib/adapters/kis";
import {krRegistry} from "@/lib/symbols/registry";
import {RankingPage} from "@/components/panels/RankingPage";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function KrGainersPage({params}: Props) {
  const {locale} = await params;
  const nameMap = Object.fromEntries(
    krRegistry.map((e) => [e.symbol, {name: e.name, nameKo: e.nameKo}])
  );
  return (
    <RankingPage
      class="kr"
      kind="gainers"
      adapter={kisAdapter}
      locale={locale}
      nameMap={nameMap}
      sourceLabel="KIS (demo)"
      symbols={krRegistry.map((e) => e.symbol)}
    />
  );
}
