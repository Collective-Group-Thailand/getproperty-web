import { getTranslations } from "next-intl/server";

import { LEAD_STATUS, VIEWING_STATUS } from "@/domain/status/lead";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatRelativeTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { Icon } from "@/ui/icons";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconInbox } from "@/ui/icons/glyphs/inbox";
import { IconArchive } from "@/ui/icons/glyphs/archive";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";

type Lead = Schemas["OwnerLeadSummaryDto"];
export type LeadsTab = "awaiting" | "open" | "closed";

const CLOSED = new Set<Lead["state"]>(["won", "lost"]);
const UPCOMING_SHOWN = 4;

/** The tab a request asks for; without one, the inbox opens on what waits for an answer when anything does. */
export function leadsTab(value: string | undefined, leads: Lead[] | null): LeadsTab {
  if (value === "awaiting" || value === "open" || value === "closed") return value;
  return leads?.some((lead) => lead.awaitingReply) ? "awaiting" : "open";
}

/**
 * The enquiries inbox (F6.2 part 2, D-252): who is waiting for an answer first, then the conversations in
 * progress and the closed ones; above them the viewings still to come, so a landlord sees today's visits at a
 * glance. Each row shows the person, the place they asked about, the last word and when — the same facts a chat
 * app shows — and opens the conversation.
 */
export async function LeadsView({ context, view }: { context: OwnerContext; view?: string }) {
  const t = await getTranslations("owner.leads");
  const { api, locale } = context;
  const [leads, viewings] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/leads"))),
    section(unwrap(api.GET("/v1/owner/listing-viewings"))),
  ]);
  const all = leads.data ?? null;
  const tab = leadsTab(view, all);
  const awaiting = all?.filter((lead) => lead.awaitingReply) ?? [];
  const open = all?.filter((lead) => !CLOSED.has(lead.state)) ?? [];
  const closed = all?.filter((lead) => CLOSED.has(lead.state)) ?? [];
  const shown = tab === "awaiting" ? awaiting : tab === "open" ? open : closed;
  const base = ownerPath(locale, "/leads");
  const now = currentTime();
  const upcoming = (viewings.data ?? []).filter(
    (v) => (v.state === "requested" || v.state === "confirmed") && Date.parse(v.endsAt) > now,
  );

  return (
    <OwnerPage testId="leads">
      <PageHeader title={t("title")} description={t("description")} />

      {upcoming.length ? (
        <Card
          as="section"
          aria-labelledby="leads-upcoming"
          className="flex flex-col gap-3"
          data-testid="leads-upcoming"
        >
          <CardHeader title={<span id="leads-upcoming">{t("upcoming.title")}</span>} />
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-4">
            {upcoming.slice(0, UPCOMING_SHOWN).map((v) => (
              <li key={v.id}>
                <a
                  href={ownerPath(locale, `/leads/${v.leadId}`)}
                  className="rounded-card border-border hover:bg-bg-subtle focus-visible:ring-focus flex h-full items-start gap-3 border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  data-testid="upcoming-viewing"
                >
                  <span className="bg-primary-subtle text-primary-subtle-fg grid size-10 shrink-0 place-items-center rounded-full">
                    <Icon icon={IconCalendar} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-semibold">{formatDateTime(v.startsAt, locale)}</span>
                    <span className="text-muted truncate text-sm">
                      {t("upcoming.with", { name: v.prospectName })} · {v.listing.title}
                    </span>
                    <span>
                      <StatusBadgeOf map={VIEWING_STATUS} value={v.state} size="sm" />
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {upcoming.length > UPCOMING_SHOWN ? (
            <p className="text-muted text-sm">{t("upcoming.more", { count: upcoming.length - UPCOMING_SHOWN })}</p>
          ) : null}
        </Card>
      ) : null}

      <LinkTabs
        label={t("title")}
        current={`${base}?view=${tab}`}
        tabs={[
          {
            href: `${base}?view=awaiting`,
            label: t("tabs.awaiting"),
            count: awaiting.length,
            testId: "leads-tab-awaiting",
          },
          { href: `${base}?view=open`, label: t("tabs.open"), count: open.length, testId: "leads-tab-open" },
          { href: `${base}?view=closed`, label: t("tabs.closed"), testId: "leads-tab-closed" },
        ]}
      />

      {!all ? (
        <SectionError error={leads.error} />
      ) : shown.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={tab === "awaiting" ? IconCheckCircle : tab === "closed" ? IconArchive : IconInbox}
            title={t(`empty.${tab}.title`)}
            description={t(`empty.${tab}.description`)}
          />
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-border m-0 list-none divide-y p-0" data-testid="lead-rows">
            {shown.map((lead) => (
              <LeadRow key={lead.id} lead={lead} locale={locale} now={now} />
            ))}
          </ul>
        </Card>
      )}
    </OwnerPage>
  );
}

async function LeadRow({ lead, locale, now }: { lead: Lead; locale: Locale; now: number }) {
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
        href={ownerPath(locale, `/leads/${lead.id}`)}
        className="hover:bg-bg-subtle focus-visible:ring-focus flex items-start gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none md:px-5"
      >
        <span
          aria-hidden="true"
          className="bg-bg-subtle text-fg grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold"
        >
          {initial}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 flex-col">
            <span className={lead.awaitingReply ? "font-semibold" : "font-medium"}>{lead.prospect.name}</span>
            <span className="text-muted truncate text-xs">{lead.listing.title}</span>
          </span>
          <span
            className={`line-clamp-2 text-sm break-words ${lead.awaitingReply ? "text-fg" : "text-muted"}`}
            data-testid="lead-row-last"
          >
            {last}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadgeOf map={LEAD_STATUS} value={lead.state} size="sm" />
            {lead.nextViewing ? (
              <span className="text-muted inline-flex items-center gap-1 text-xs">
                <Icon icon={IconCalendar} />
                {t("viewing", { date: formatDateTime(lead.nextViewing.startsAt, locale) })}
              </span>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <time className="text-muted text-xs" dateTime={when}>
            {formatRelativeTime(when, locale, now)}
          </time>
          {lead.awaitingReply ? (
            <span className="bg-primary size-2.5 rounded-full" role="img" aria-label={t("awaiting")} />
          ) : null}
        </span>
      </a>
    </li>
  );
}
