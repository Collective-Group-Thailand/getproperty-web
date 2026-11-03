import { getTranslations } from "next-intl/server";

import { Wordmark } from "@/ui/brand";
import { cn } from "@/ui/lib/cn";

/**
 * The sign-in frame of every zone (G1 redesign 2026-11-03): one calm column on the off-white page — the wordmark (a
 * link home where the zone has a public site) and the language at the top, the page's h1 and one line, one white
 * card holding the form, the hand-over links under it, and the legal links at the foot. On a phone the card drops its
 * chrome so the form fills the width. A skip link and one `<main>`, like every other page (design-system.md §6).
 */
export async function AuthFrame({
  zone,
  title,
  subtitle,
  children,
  aside,
  footer,
  homeHref,
  legal,
}: {
  zone: "owner" | "staff" | "admin";
  title: string;
  /** Replaces the zone's default line under the title. */
  subtitle?: string;
  /** Under the card (e.g. the link between sign-in and sign-up). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Top right: the language switch. */
  aside?: React.ReactNode;
  /** The wordmark links here (the public site) when set. */
  homeHref?: string;
  /** Small links at the foot of the page (terms, privacy). */
  legal?: { href: string; label: string }[];
}) {
  const t = await getTranslations();
  // The wordmark is the image named "getproperty"; as a link home it names the link too.
  const mark = <Wordmark size="sm" />;
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t("shell.skipToContent")}
      </a>
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {homeHref ? (
          <a href={homeHref} className="rounded-control inline-flex items-center">
            {mark}
          </a>
        ) : (
          mark
        )}
        {aside ? <div className="text-muted flex items-center text-sm">{aside}</div> : null}
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center px-4 pt-6 pb-12 sm:justify-center sm:px-6 sm:pt-8"
      >
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col gap-2 sm:px-1">
            <h1 className="m-0 text-2xl font-semibold text-balance">{title}</h1>
            <p className="text-muted m-0 text-pretty">{subtitle ?? t(`auth.signIn.subtitle.${zone}`)}</p>
          </div>
          <div
            className={cn(
              "sm:bg-surface sm:border-border sm:rounded-panel sm:shadow-card sm:border sm:p-8",
              "flex flex-col",
            )}
            data-testid="auth-card"
          >
            {children}
          </div>
          {footer ? <div className="text-muted flex flex-col gap-3 text-sm sm:px-1">{footer}</div> : null}
        </div>
      </main>
      {legal && legal.length > 0 ? (
        <footer className="text-muted mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-xs sm:px-6 lg:px-8">
          {legal.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-fg inline-flex min-h-8 items-center">
              {link.label}
            </a>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
