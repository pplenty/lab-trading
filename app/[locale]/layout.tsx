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

  // canonical 은 layout 에 박지 않는다 — Next.js metadata 의 alternates 는 자식이
  // 재정의하지 않으면 부모 값을 그대로 상속해서, 모든 공개 페이지가 홈(/ko) canonical 을
  // 물려받아 "홈 중복"으로 색인 드롭되는 사고가 난다 (SEO P0). 페이지별로 박거나,
  // 미정의 시 self-canonical (URL 자체) 로 두는 게 안전.
  // hreflang(languages) 도 ADR-0004 (ko 단독, en 잠금) 정합 위해 ko 만.
  return {
    title: {
      default: t("siteTitle"),
      template: `%s — ${t("siteName")}`,
    },
    description: t("siteDescription"),
    alternates: {
      languages: {ko: absoluteUrl("/ko")},
    },
    // 기본 OG (홈 + openGraph 미정의 페이지 fallback). 자식이 openGraph 를
    // 정의하면 그쪽 images 가 우선. 정적 PNG (scripts/gen-og.ts → /og/*.png).
    openGraph: {
      siteName: t("siteName"),
      locale,
      type: "website",
      images: [
        {
          url: absoluteUrl("/og/home.png"),
          width: 1200,
          height: 630,
          alt: t("siteTitle"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [absoluteUrl("/og/home.png")],
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
