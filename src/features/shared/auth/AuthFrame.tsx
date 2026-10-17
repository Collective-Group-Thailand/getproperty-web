import { getTranslations } from "next-intl/server";

import { Wordmark } from "@/ui/brand";
import { Card } from "@/ui/components/Card";

/**
 * The sign-in page frame of every zone: wordmark, the zone's name, one card. A skip link and one
 * `<main>`, like every other page (design-system.md §6).
 */
export async function AuthFrame({
  zone,
  title,
  children,
  aside,
}: {
  zone: "owner" | "staff" | "admin";
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t("shell.skipToContent")}
      </a>
      <header className="flex h-14 items-center justify-between px-4">
        <Wordmark size="sm" />
        {aside}
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <Card className="w-full max-w-md" padding="lg" data-testid="auth-card">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted mt-1 text-sm">{t(`auth.signIn.subtitle.${zone}`)}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </main>
    </div>
  );
}
