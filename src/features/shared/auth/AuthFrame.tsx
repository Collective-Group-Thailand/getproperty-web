import { getTranslations } from "next-intl/server";

import { Wordmark } from "@/ui/brand";
import { Badge } from "@/ui/components/Badge";
import { Icon, type IconGlyph } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * The sign-in frame of every zone (G1 redesign, Stitch revision 2026-11-04). A slim top row — the wordmark (a link home
 * where the zone has a public site), a small zone badge where it helps people know which door they are at, the language
 * and the way back on the right — then the form, and the legal links at the foot.
 *
 * Two layouts:
 * - `showcase` set (the owner host's sign-in, sign-up, invitation): a split frame from `lg` — the form column on the
 *   page background on the left, a white panel on the right holding a calm product moment (an illustrative LINE bill
 *   message) so the page has a sense of place without a hero photo or a dashboard of made-up figures. Phones show the
 *   form alone.
 * - otherwise one centred column with one white card. With `icon` the title moves into the card under a small icon
 *   square (the admin door: lock, environment, purpose).
 *
 * A skip link and one `<main>`, like every other page (design-system.md §6). On a phone the card drops its chrome so
 * the form fills the width.
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
  zoneBadge,
  icon,
  cardTop,
  showcase,
}: {
  zone: "owner" | "staff" | "admin";
  title: string;
  /** Replaces the zone's default line under the title. */
  subtitle?: string;
  /** Under the form (e.g. the link between sign-in and sign-up). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Top right: the language switch, the way back home. */
  aside?: React.ReactNode;
  /** The wordmark links here (the public site) when set. */
  homeHref?: string;
  /** Small links at the foot of the page (terms, privacy). */
  legal?: { href: string; label: string }[];
  /** A small neutral badge beside the wordmark ("แอดมิน"). */
  zoneBadge?: string;
  /** Puts the title inside the card under this icon (pale-tint square). */
  icon?: IconGlyph;
  /** Beside the icon square, top right of the card (environment badges). */
  cardTop?: React.ReactNode;
  /** The right-hand panel of the split frame (from `lg`). */
  showcase?: React.ReactNode;
}) {
  const t = await getTranslations();
  // The wordmark is the image named "getproperty"; as a link home it names the link too.
  const mark = <Wordmark size="sm" />;
  const head = (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 text-2xl font-semibold text-balance">{title}</h1>
      <p className="text-muted m-0 text-pretty">{subtitle ?? t(`auth.signIn.subtitle.${zone}`)}</p>
    </div>
  );
  const legalLinks =
    legal && legal.length > 0 ? (
      <ul className="text-muted m-0 flex list-none flex-wrap items-center gap-x-6 gap-y-1 p-0 text-xs">
        {legal.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="hover:text-fg inline-flex min-h-8 items-center">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t("shell.skipToContent")}
      </a>
      <header className="mx-auto flex h-16 w-full max-w-7xl shrink-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {homeHref ? (
            <a href={homeHref} className="rounded-control inline-flex items-center">
              {mark}
            </a>
          ) : (
            mark
          )}
          {zoneBadge ? (
            <Badge tone="neutral" size="sm" className="mt-0.5">
              {zoneBadge}
            </Badge>
          ) : null}
        </div>
        {aside ? <div className="text-muted flex items-center gap-1 text-sm">{aside}</div> : null}
      </header>

      {showcase ? (
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 pt-4 pb-10 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:pb-8"
        >
          <div className="flex flex-col justify-center lg:py-10">
            <div className="mx-auto flex w-full max-w-md flex-col gap-6" data-testid="auth-card">
              {head}
              {children}
              {footer ? <div className="text-muted flex flex-col gap-3 text-sm">{footer}</div> : null}
              {legalLinks ? <div className="pt-2">{legalLinks}</div> : null}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="bg-surface border-border rounded-panel shadow-card hidden items-center justify-center border p-10 lg:flex"
          >
            {showcase}
          </div>
        </main>
      ) : (
        <>
          <main
            id="main"
            tabIndex={-1}
            className="flex flex-1 flex-col items-center px-4 pt-6 pb-12 sm:justify-center sm:px-6 sm:pt-0 sm:pb-16"
          >
            <div className="flex w-full max-w-md flex-col gap-6">
              {icon ? null : <div className="sm:px-1">{head}</div>}
              <div
                className={cn(
                  "sm:bg-surface sm:border-border sm:rounded-panel sm:shadow-card sm:border sm:p-8",
                  "flex flex-col",
                )}
                data-testid="auth-card"
              >
                {icon ? (
                  <div className="mb-6 flex flex-col gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-10 shrink-0 place-items-center text-lg">
                        <Icon icon={icon} />
                      </span>
                      {cardTop ? <div className="flex flex-wrap justify-end gap-1">{cardTop}</div> : null}
                    </div>
                    {head}
                  </div>
                ) : null}
                {children}
              </div>
              {footer ? <div className="text-muted flex flex-col gap-3 text-sm sm:px-1">{footer}</div> : null}
            </div>
          </main>
          {legalLinks ? (
            <footer className="mx-auto flex w-full max-w-7xl justify-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
              {legalLinks}
            </footer>
          ) : null}
        </>
      )}
    </div>
  );
}
