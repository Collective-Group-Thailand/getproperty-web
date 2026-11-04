import { getTranslations } from "next-intl/server";

import { formatDateTime, formatRelativeTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ViewTabs } from "@/ui/components/ListToolbar";
import { Icon } from "@/ui/icons";
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { cn } from "@/ui/lib/cn";

import { ownerPath } from "../shared/links";

type Lead = Schemas["OwnerLeadSummaryDto"];
export type LeadsTab = "awaiting" | "open" | "closed";

const CLOSED = new Set<Lead["state"]>(["won", "lost"]);

/** The tab a request asks for; without one, the inbox opens on what waits for an answer when anything does. */
export function leadsTab(value: string | undefined, leads: Lead[] | null): LeadsTab {
  if (value === "awaiting" || value === "open" || value === "closed") return value;
  return leads?.some((lead) => lead.awaitingReply) ? "awaiting" : "open";
}

/** The tab an open conversation belongs to, so the list beside it shows it selected. */
export function tabOf(lead: Pick<Lead, "awaitingReply" | "state">): LeadsTab {
  if (CLOSED.has(lead.state)) return "closed";
  return lead.awaitingReply ? "awaiting" : "open";
}

/**
 * The inbox's first pane (F6.2 part 2, G5): the three views — waiting for my answer, in progress, closed — and one row
 * per enquiry the way a chat app shows it: the person's initial, name, the listing, the last word and how long ago,
 * a dot while it waits for me. The open conversation is marked as the current one. Counts are of the API's full list
 * (the endpoint is not paged).
 */
export async function LeadsListPane({
  leads,
  tab,
  locale,
  now,
  selectedId,
  className,
}: {
  leads: Lead[];
  tab: LeadsTab;
  locale: Locale;
  now: number;
  selectedId?: string;
  className?: string;
}) {
  const t = await getTranslations("owner.leads");
  const awaiting = leads.filter((lead) => lead.awaitingReply);
  const open = leads.filter((lead) => !CLOSED.has(lead.state));
  const closed = leads.filter((lead) => CLOSED.has(lead.state));
  const shown = tab === "awaiting" ? awaiting : tab === "open" ? open : closed;
  const base = ownerPath(locale, "/leads");
  const href = (key: LeadsTab) => `${base}?view=${key}`;

  return (
    <section
      aria-label={t("list.label")}
      className={cn("rounded-card border-border bg-surface shadow-card flex min-w-0 flex-col border", className)}
    >
      <div className="border-border border-b p-2">
        <ViewTabs
          label={t("title")}
          current={tab}
          tabs={[
            {
              key: "awaiting",
              href: href("awaiting"),
              label: t("tabs.awaiting"),
              count: awaiting.length,
              testId: "leads-tab-awaiting",
            },
            { key: "open", href: href("open"), label: t("tabs.open"), count: open.length, testId: "leads-tab-open" },
            { key: "closed", href: href("closed"), label: t("tabs.closed"), testId: "leads-tab-closed" },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon={tab === "awaiting" ? IconCheckCircle : tab === "closed" ? IconArchive : IconInbox}
          title={t(`empty.${tab}.title`)}
          description={t(`empty.${tab}.description`)}
          action={
            tab === "open" ? (
              <Button asChild variant="secondary" size="sm">
                <a href={ownerPath(locale, "/listings")}>{t("empty.toListings")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <a href={href("open")}>{t("empty.toOpen")}</a>
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-border m-0 list-none divide-y p-0" data-testid="lead-rows">
          {shown.map((lead) => (
            <LeadRow key={lead.id} lead={lead} locale={locale} now={now} selected={lead.id === selectedId} tab={tab} />
          ))}
        </ul>
      )}
    </section>
  );
}

async function LeadRow({
  lead,
  locale,
  now,
  selected,
  tab,
}: {
  lead: Lead;
  locale: Locale;
  now: number;
  selected: boolean;
  tab: LeadsTab;
}) {
  const t = await getTranslations("owner.leads.row");
  const initial = lead.prospect.name.trim().charAt(0) || "?";
  const last = lead.lastMessage
    ? lead.lastMessageBy === "owner"
      ? t("you", { text: lead.lastMessage })
      : lead.lastMessage
    : t("noMessage");
  const when = lead.lastOwnerAt && lead.lastOwnerAt > lead.lastProspectAt ? lead.lastOwnerAt : lead.lastProspectAt;
  return (
    <li data-testid="lead-row" data-state={lead.state} data-awaiting={lead.awaitingReply || undefined}>
      <a
        href={`${ownerPath(locale, `/leads/${lead.id}`)}?view=${tab}`}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "focus-visible:ring-focus flex items-start gap-3 px-4 py-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
          selected ? "bg-primary-subtle" : "hover:bg-bg-subtle",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold",
            selected ? "bg-surface text-primary-subtle-fg" : "bg-bg-subtle text-fg",
          )}
        >
          {initial}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <span className={cn("truncate", lead.awaitingReply ? "font-semibold" : "font-medium")}>
                {lead.prospect.name}
              </span>
              {lead.prospect.identityVerified ? (
                <Icon
                  icon={IconShield}
                  className="text-primary shrink-0"
                  label={t("identityVerified")}
                  data-testid="lead-row-identity"
                />
              ) : null}
            </span>
            <time className="text-muted shrink-0 text-xs tabular-nums" dateTime={when}>
              {formatRelativeTime(when, locale, now)}
            </time>
          </span>
          <span className="text-muted truncate text-xs">{lead.listing.title}</span>
          <span className="flex items-start gap-2">
            <span
              className={cn(
                "line-clamp-2 min-w-0 flex-1 text-sm break-words",
                lead.awaitingReply ? "text-fg" : "text-muted",
              )}
              data-testid="lead-row-last"
            >
              {last}
            </span>
            {lead.awaitingReply ? (
              <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" role="img" aria-label={t("awaiting")} />
            ) : null}
          </span>
          {lead.nextViewing ? (
            <span className="text-muted mt-0.5 inline-flex items-center gap-1 text-xs">
              <Icon icon={IconCalendar} />
              {t("viewing", { date: formatDateTime(lead.nextViewing.startsAt, locale) })}
            </span>
          ) : null}
        </span>
      </a>
    </li>
  );
}
