import type {Metadata} from "next";
import {NextIntlClientProvider, hasLocale} from "next-intl";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import {absoluteUrl} from "@/lib/site";
import {AppShell} from "@/components/AppShell";
import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {KeyboardShortcutsDialog} from "@/components/KeyboardShortcutsDialog";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "meta"});

  return {
    title: {
      default: t("siteTitle"),
      template: `%s — ${t("siteName")}`,
    },
    description: t("siteDescription"),
    alternates: {
      canonical: absoluteUrl(`/${locale}`),
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, absoluteUrl(`/${l}`)])
      ),
    },
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

// <html>/<body>/<head>/Geist/init script 는 모두 root layout (app/layout.tsx).
// 이 nested layout 은 NextIntlClientProvider + Header / AppShell / Footer / Shortcuts 만.
export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const tA11y = await getTranslations({locale, namespace: "a11y"});

  return (
    <NextIntlClientProvider>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-accent"
      >
        {tA11y("skipToContent")}
      </a>
      <Header />
      <AppShell>{children}</AppShell>
      <Footer />
      <KeyboardShortcutsDialog />
    </NextIntlClientProvider>
  );
}
