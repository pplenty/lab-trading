import {upbitAdapter} from "@/lib/adapters/upbit";
import {cryptoRegistry} from "@/lib/symbols/registry";
import {RankingPage} from "@/components/panels/RankingPage";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CryptoGainersPage({params}: Props) {
  const {locale} = await params;
  const nameMap = Object.fromEntries(
    cryptoRegistry.map((e) => [e.symbol, {name: e.name, nameKo: e.nameKo}])
  );
  return (
    <RankingPage
      class="crypto"
      kind="gainers"
      adapter={upbitAdapter}
      locale={locale}
      nameMap={nameMap}
      sourceLabel="Upbit"
    />
  );
}
