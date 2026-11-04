import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LEAD_STATUS } from "@/domain/status/lead";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { cn } from "@/ui/lib/cn";

import { RentRecordSummary } from "../rentRecord/RentRecordSummary";
import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";
import { LeadNotes, LeadStateActions, LeadViewings } from "./LeadActions";
import { LeadsListPane, leadsTab, tabOf } from "./LeadsInbox";
import { LeadThread } from "./LeadThread";

/** One titled block of the inbox's panes (a white card with its heading). */
function Pane({
  id,
  title,
  aside,
  children,
  className,
  testId,
}: {
  id: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-card border-border bg-surface shadow-card flex min-w-0 flex-col border", className)}
      data-testid={testId}
    >
      <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id={id} className="min-w-0 text-base font-semibold">
          {title}
        </h2>
        {aside}
      </header>
      <div className="flex flex-col gap-4 px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * One enquiry (F6.2 part 2, D-252) inside the inbox frame (G5): on a wide screen the conversations on the left, the
 * thread in the middle (the safety line on its band, the messages, the reply box) and on the right what a landlord
 * needs to decide — the viewing with its buttons first, who the prospect is, their rent record, where the enquiry
 * stands and private notes. On a phone the list gives way to the conversation: the viewing first (the one thing to
 * act on), then the thread and its composer, then the facts.
 */
export async function LeadDetailView({
  context,
  leadId,
  view,
}: {
  context: OwnerContext;
  leadId: string;
  view?: string;
}) {
  const [t, rr] = await Promise.all([getTranslations("owner.leads"), getTranslations("owner.rentRecord")]);
  const { api, locale } = context;
  const [result, list] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/leads/{leadId}", { params: { path: { leadId } } }))),
    section(unwrap(api.GET("/v1/owner/leads"))),
  ]);
  if (!result.data) {
    if (isApiError(result.error) && result.error.status === 404) notFound();
    return (
      <OwnerPage>
        <SectionError error={result.error} />
      </OwnerPage>
    );
  }
  const lead = result.data;
  const closed = lead.state === "won" || lead.state === "lost";
  const notGiven = t("prospect.notGiven");
  const now = currentTime();
  const summary = list.data?.find((one) => one.id === lead.id);
  const tab = view
    ? leadsTab(view, list.data ?? null)
    : summary
      ? tabOf(summary)
      : tabOf({ awaitingReply: false, state: lead.state });
  const facts: { id: string; term: string; value: React.ReactNode }[] = [
    {
      id: "moveIn",
      term: t("prospect.moveIn"),
      value: lead.moveInDate ? formatDate(lead.moveInDate, locale) : notGiven,
    },
    {
      id: "term",
      term: t("prospect.term"),
      value: lead.termMonths ? t("prospect.termValue", { count: lead.termMonths }) : notGiven,
    },
    {
      id: "occupants",
      term: t("prospect.occupants"),
      value: lead.occupants ? t("prospect.occupantsValue", { count: lead.occupants }) : notGiven,
    },
    { id: "nationality", term: t("prospect.nationality"), value: lead.nationality ?? notGiven },
    {
      id: "channel",
      term: t("prospect.channel"),
      value: lead.channel ? t(`prospect.channels.${lead.channel}`) : t("prospect.channelDirect"),
    },
    ...(lead.prospect.phone ? [{ id: "phone", term: t("prospect.phone"), value: lead.prospect.phone }] : []),
    {
      id: "identity",
      term: t("prospect.identity"),
      value: lead.prospect.identityVerified ? (
        <span data-testid="lead-identity-verified">
          <Badge tone="success" icon={IconShield} size="sm">
            {t("prospect.identityYes")}
          </Badge>
        </span>
      ) : (
        t("prospect.identityNo")
      ),
    },
    {
      id: "line",
      term: t("prospect.line"),
      value: lead.prospect.lineLinked ? t("prospect.lineYes") : t("prospect.lineNo"),
    },
  ];

  return (
    <OwnerPage testId="lead-detail">
      <PageHeader
        title={lead.prospect.name}
        description={
          <>
            {t("detail.about", { listing: lead.listing.title })} ·{" "}
            {t("detail.since", { date: formatDateTime(lead.createdAt, locale) })}
          </>
        }
        status={<StatusBadgeOf map={LEAD_STATUS} value={lead.state} />}
        back={{ label: t("detail.back"), href: `${ownerPath(locale, "/leads")}?view=${tab}` }}
      />

      <div
        className={cn(
          "grid items-start gap-4",
          "lg:grid-cols-[20rem_minmax(0,1fr)] lg:[grid-template-areas:'list_viewing''list_thread''list_details']",
          "xl:grid-cols-[19rem_minmax(0,1fr)_19rem] xl:[grid-template-areas:'list_thread_viewing''list_thread_details']",
        )}
      >
        {list.data ? (
          <LeadsListPane
            leads={list.data}
            tab={tab}
            locale={locale}
            now={now}
            selectedId={lead.id}
            className="max-lg:hidden lg:row-span-3 lg:[grid-area:list] xl:row-span-2"
          />
        ) : (
          <div className="max-lg:hidden lg:[grid-area:list]">
            <SectionError error={list.error} />
          </div>
        )}

        <Pane id="lead-viewings" title={t("viewings.title")} className="lg:[grid-area:viewing]">
          <LeadViewings viewings={lead.viewings} now={now} />
        </Pane>

        <Pane
          id="lead-thread"
          title={
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{lead.listing.title}</span>
              <span className="text-muted text-sm font-normal">{t("thread.title")}</span>
            </span>
          }
          aside={
            <Button asChild variant="secondary" size="sm" iconStart={IconExternal}>
              <a href={ownerPath(locale, `/listings/${lead.listing.id}`)}>{t("detail.openListing")}</a>
            </Button>
          }
          className="lg:[grid-area:thread]"
        >
          <LeadThread leadId={lead.id} prospectName={lead.prospect.name} messages={lead.messages} closed={closed} />
        </Pane>

        <div className="flex min-w-0 flex-col gap-4 lg:[grid-area:details]">
          <Pane id="lead-state" title={t("state.title")}>
            {closed ? (
              <p className="m-0 text-sm" data-testid="lead-outcome">
                {lead.state === "won"
                  ? t("state.closedWon")
                  : t("state.closedLost", { reason: lead.lostReason ? t(`state.reasons.${lead.lostReason}`) : "" })}
              </p>
            ) : (
              <>
                <p className="text-muted m-0 text-sm">{t("state.hint")}</p>
                <LeadStateActions lead={lead} />
              </>
            )}
          </Pane>

          <Pane id="lead-prospect" title={t("prospect.title")}>
            <dl className="m-0 flex flex-col gap-2.5 text-sm">
              {facts.map((fact) => (
                <div key={fact.id} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted shrink-0">{fact.term}</dt>
                  <dd className="m-0 text-end font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Pane>

          <Pane id="lead-rent-record" title={rr("lead.title")}>
            {lead.rentRecord ? (
              <>
                <p className="text-muted m-0 text-sm">
                  {rr("lead.shared", { date: formatDateTime(lead.rentRecord.sharedAt, locale) })}
                </p>
                <RentRecordSummary record={lead.rentRecord} locale={locale} compact />
              </>
            ) : (
              <p className="text-muted m-0 text-sm" data-testid="lead-rent-record-none">
                {rr("lead.none")}
              </p>
            )}
          </Pane>

          <section
            aria-label={t("notes.title")}
            className="rounded-card border-border bg-surface shadow-card border px-5 py-4"
          >
            <LeadNotes leadId={lead.id} notes={lead.notes} />
          </section>
        </div>
      </div>
    </OwnerPage>
  );
}
