import {Link} from "@/i18n/navigation";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
      <h1 className="mb-4 text-3xl font-semibold tracking-tight text-fg">
        404
      </h1>
      <p className="mb-6 text-base text-fg-muted">
        존재하지 않는 페이지입니다 / Page not found.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-accent transition-colors hover:underline"
      >
        ← Home
      </Link>
    </main>
  );
}
