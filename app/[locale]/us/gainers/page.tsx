import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {usRegistry} from "@/lib/symbols/registry";
import {RankingPage} from "@/components/panels/RankingPage";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function UsGainersPage({params}: Props) {
  const {locale} = await params;
  const nameMap = Object.fromEntries(
    usRegistry.map((e) => [e.symbol, {name: e.name, nameKo: e.nameKo}])
  );
  return (
    <RankingPage
      class="us"
      kind="gainers"
      adapter={twelveDataAdapter}
      locale={locale}
      nameMap={nameMap}
      sourceLabel="Twelve Data"
    />
  );
}
