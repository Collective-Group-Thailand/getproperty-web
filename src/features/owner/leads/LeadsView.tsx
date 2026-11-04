import { getTranslations } from "next-intl/server";

import { VIEWING_STATUS } from "@/domain/status/lead";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconResident } from "@/ui/icons/glyphs/resident";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";
import { attention } from "../viewings/selfViewing";
import { LeadsListPane, leadsTab } from "./LeadsInbox";

export { leadsTab, type LeadsTab } from "./LeadsInbox";

const UPCOMING_SHOWN = 5;

/**
 * The enquiries inbox (F6.2 part 2, D-252; G5): the conversations on the left — who waits for an answer first, then
 * those in progress and the closed ones — and beside them, until one is opened, the viewings still to come so a
 * landlord sees the next visits at a glance. Opening a row opens the conversation in the same frame
 * (`/leads/[leadId]`). Self viewings that need the owner now come first, as the API also sends them urgently.
 */
export async function LeadsView({ context, view }: { context: OwnerContext; view?: string }) {
  const t = await getTranslations("owner.leads");
  const v = await getTranslations("owner.viewings");
  const { api, locale } = context;
  const [leads, viewings] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/leads"))),
    section(unwrap(api.GET("/v1/owner/listing-viewings"))),
  ]);
  const all = leads.data ?? null;
  const tab = leadsTab(view, all);
  const now = currentTime();
  const upcoming = (viewings.data ?? []).filter(
    (one) => (one.state === "requested" || one.state === "confirmed") && Date.parse(one.endsAt) > now,
  );
  // G7 (D-295): self viewings that need the owner now — the API also sends them as urgent notifications.
  const urgent = (viewings.data ?? []).filter((one) => attention(one.access, now) !== null);
  const calendar = ownerPath(locale, "/leads/viewings");

  return (
    <OwnerPage testId="leads">
      <PageHeader title={t("title")} description={t("description")} />

      {urgent.length ? (
        <Callout
          tone="danger"
          title={v("calendar.urgentTitle", { count: urgent.length })}
          action={
            <Button asChild size="sm" variant="secondary">
              <a href={calendar}>{v("calendar.open")}</a>
            </Button>
          }
        >
          <span data-testid="leads-urgent">{v("calendar.urgentBody")}</span>
        </Callout>
      ) : null}

      {!all ? (
        <SectionError error={leads.error} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <LeadsListPane leads={all} tab={tab} locale={locale} now={now} />
          <div className="flex min-w-0 flex-col gap-4">
            <section
              aria-labelledby="leads-upcoming"
              className="rounded-card border-border bg-surface shadow-card flex flex-col border"
              data-testid="leads-upcoming"
            >
              <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
                <h2 id="leads-upcoming" className="text-base font-semibold">
                  {t("upcoming.title")}
                </h2>
                <a
                  href={calendar}
                  className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  data-testid="leads-open-calendar"
                >
                  {t("upcoming.calendar")}
                </a>
              </header>
              {upcoming.length === 0 ? (
                <p className="text-muted m-0 px-5 py-4 text-sm">{t("upcoming.empty")}</p>
              ) : (
                <ul className="divide-border m-0 list-none divide-y p-0">
                  {upcoming.slice(0, UPCOMING_SHOWN).map((one) => (
                    <li key={one.id}>
                      <a
                        href={ownerPath(locale, `/leads/${one.leadId}`)}
                        className="hover:bg-bg-subtle focus-visible:ring-focus flex items-center gap-4 px-5 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                        data-testid="upcoming-viewing"
                      >
                        <span className="flex w-24 shrink-0 flex-col">
                          <span className="text-sm font-semibold">
                            {formatDate(one.startsAt, locale, { style: "dayMonth" })}
                          </span>
                          <span className="text-muted text-sm tabular-nums">
                            {formatTime(one.startsAt, locale)}–{formatTime(one.endsAt, locale)}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                            <Icon
                              icon={one.mode === "self" ? IconKey : IconResident}
                              className="text-muted"
                              label={v(`mode.${one.mode}`)}
                            />
                            {one.prospectName}
                          </span>
                          <span className="text-muted truncate text-sm">{one.listing.title}</span>
                        </span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1">
                          {one.mode === "self" ? (
                            <Badge tone="neutral" size="sm" icon={IconKey}>
                              {v("mode.self")}
                            </Badge>
                          ) : null}
                          <StatusBadgeOf map={VIEWING_STATUS} value={one.state} size="sm" />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {upcoming.length > UPCOMING_SHOWN ? (
                <p className="border-border text-muted m-0 border-t px-5 py-3 text-sm">
                  {t("upcoming.more", { count: upcoming.length - UPCOMING_SHOWN })}
                </p>
              ) : null}
            </section>
            <EmptyState
              variant="card"
              icon={IconChat}
              className="max-lg:hidden"
              title={t("pick.title")}
              description={t("pick.body")}
              action={
                <Button asChild variant="secondary" iconStart={IconCalendar}>
                  <a href={calendar}>{t("upcoming.calendar")}</a>
                </Button>
              }
            />
          </div>
        </div>
      )}
    </OwnerPage>
  );
}
