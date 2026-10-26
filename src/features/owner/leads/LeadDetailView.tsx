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
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";
import { LeadNotes, LeadStateActions, LeadViewings } from "./LeadActions";
import { LeadThread } from "./LeadThread";

/**
 * One enquiry (F6.2 part 2, D-252). The conversation is the page — it takes the wide column, the reply box under
 * it — and beside it what a landlord needs to decide: what the prospect asked for (move-in, length, people), the
 * viewings with their buttons, private notes, and where the enquiry stands. On a phone the same blocks stack in
 * that order.
 */
export async function LeadDetailView({ context, leadId }: { context: OwnerContext; leadId: string }) {
  const t = await getTranslations("owner.leads");
  const { api, locale } = context;
  const result = await section(unwrap(api.GET("/v1/owner/leads/{leadId}", { params: { path: { leadId } } })));
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
        actions={
          <Button asChild variant="secondary" iconStart={IconMegaphone}>
            <a href={ownerPath(locale, `/listings/${lead.listing.id}`)}>{t("detail.openListing")}</a>
          </Button>
        }
        crumbs={[{ label: lead.prospect.name }]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card as="section" aria-labelledby="lead-thread" className="flex flex-col gap-4">
          <CardHeader title={<span id="lead-thread">{t("thread.title")}</span>} />
          <LeadThread leadId={lead.id} prospectName={lead.prospect.name} messages={lead.messages} closed={closed} />
        </Card>

        <div className="flex flex-col gap-6">
          <Card as="section" aria-labelledby="lead-prospect" className="flex flex-col gap-4">
            <CardHeader title={<span id="lead-prospect">{t("prospect.title")}</span>} />
            <DescriptionList
              columns={1}
              items={[
                {
                  id: "moveIn",
                  term: t("prospect.moveIn"),
                  description: lead.moveInDate ? formatDate(lead.moveInDate, locale) : notGiven,
                },
                {
                  id: "term",
                  term: t("prospect.term"),
                  description: lead.termMonths ? t("prospect.termValue", { count: lead.termMonths }) : notGiven,
                },
                {
                  id: "occupants",
                  term: t("prospect.occupants"),
                  description: lead.occupants ? t("prospect.occupantsValue", { count: lead.occupants }) : notGiven,
                },
                { id: "nationality", term: t("prospect.nationality"), description: lead.nationality ?? notGiven },
                {
                  id: "channel",
                  term: t("prospect.channel"),
                  description: lead.channel ? t(`prospect.channels.${lead.channel}`) : t("prospect.channelDirect"),
                },
                ...(lead.prospect.phone
                  ? [{ id: "phone", term: t("prospect.phone"), description: lead.prospect.phone }]
                  : []),
                {
                  id: "line",
                  term: t("prospect.line"),
                  description: lead.prospect.lineLinked ? t("prospect.lineYes") : t("prospect.lineNo"),
                },
              ]}
            />
          </Card>

          <Card as="section" aria-labelledby="lead-viewings" className="flex flex-col gap-4">
            <CardHeader title={<span id="lead-viewings">{t("viewings.title")}</span>} />
            <LeadViewings viewings={lead.viewings} now={now} />
          </Card>

          <Card as="section" aria-labelledby="lead-state" className="flex flex-col gap-4">
            <CardHeader
              title={<span id="lead-state">{t("state.title")}</span>}
              description={closed ? undefined : t("state.hint")}
            />
            {closed ? (
              <p className="text-sm" data-testid="lead-outcome">
                {lead.state === "won"
                  ? t("state.closedWon")
                  : t("state.closedLost", { reason: lead.lostReason ? t(`state.reasons.${lead.lostReason}`) : "" })}
              </p>
            ) : (
              <LeadStateActions lead={lead} />
            )}
          </Card>

          <Card as="section" aria-label={t("notes.title")}>
            <LeadNotes leadId={lead.id} notes={lead.notes} />
          </Card>
        </div>
      </div>
    </OwnerPage>
  );
}
