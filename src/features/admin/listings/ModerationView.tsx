import { getTranslations } from "next-intl/server";

import { LISTING_STATUS, LISTING_VERIFICATION_STATUS } from "@/domain/status/listing";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconFlag } from "@/ui/icons/glyphs/flag";

import { can, section, type AdminContext } from "../shared/server";
import { ListingModerationActions, VerificationReview } from "./ModerationActions";

export type ModerationTab = "queue" | "hidden" | "reported" | "verifications";
export const MODERATION_TABS: ModerationTab[] = ["queue", "hidden", "reported", "verifications"];

/**
 * Listings for platform Support (F6.5, D-252): the review queue, hidden and reported listings — each with the reasons
 * the API gave and the actions it allows — and owner verifications, whose evidence opens in a dialog (every link an
 * audited download).
 */
export async function ModerationView({ context, tab }: { context: AdminContext; tab: ModerationTab }) {
  const t = await getTranslations("admin.listings");
  const href = (next: ModerationTab) => (next === "queue" ? "/listings" : `/listings?tab=${next}`);
  return (
    <ConsolePage testId="admin-listings">
      <PageHeader title={t("title")} description={t("description")} />
      <LinkTabs
        label={t("tabsLabel")}
        current={href(tab)}
        tabs={MODERATION_TABS.filter((one) =>
          one === "verifications" ? can(context.me, "admin.listing.verify") : can(context.me, "admin.listing.moderate"),
        ).map((one) => ({ href: href(one), label: t(`tab.${one}`), testId: `listings-tab-${one}` }))}
      />
      {tab === "verifications" ? <Verifications context={context} /> : <Queue context={context} tab={tab} />}
    </ConsolePage>
  );
}

const QUEUE_KIND: Record<Exclude<ModerationTab, "verifications">, Schemas["ModerationQueue"]> = {
  queue: "pending_review",
  hidden: "hidden",
  reported: "reported",
};

async function Queue({ context, tab }: { context: AdminContext; tab: Exclude<ModerationTab, "verifications"> }) {
  const t = await getTranslations("admin.listings");
  const { api, locale } = context;
  const rows = await section(
    unwrap(api.GET("/v1/admin/listings/queue", { params: { query: { kind: QUEUE_KIND[tab] } } })),
  );
  if (!rows.data) return <SectionError error={rows.error} />;
  if (rows.data.length === 0)
    return (
      <Card>
        <EmptyState icon={IconFlag} title={t(`empty.${tab}`)} description={t("emptyHint")} />
      </Card>
    );
  return (
    <SimpleTable
      caption={t(`tab.${tab}`)}
      testId="moderation-queue"
      minWidth="60rem"
      columns={[
        { key: "listing", header: t("col.listing") },
        { key: "owner", header: t("col.owner") },
        { key: "why", header: t("col.why") },
        { key: "rent", header: t("col.rent"), align: "end" },
        { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
      ]}
      rows={rows.data.map((listing) => ({
        key: listing.id,
        testId: "moderation-row",
        data: { slug: listing.slug },
        cells: {
          listing: (
            <span className="flex max-w-md flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{listing.titleTh}</span>
                <StatusBadgeOf map={LISTING_STATUS} value={listing.state} size="sm" />
              </span>
              <span className="text-muted line-clamp-2 text-sm">{listing.descriptionTh}</span>
              <span className="text-muted text-xs">
                {[listing.district, listing.province].filter(Boolean).join(", ")}
              </span>
            </span>
          ),
          owner: listing.tenantName,
          why: (
            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap gap-1">
                {listing.reviewReasons.map((reason) => (
                  <Badge key={reason} tone="info" size="sm">
                    {t(`reasons.${reason}`)}
                  </Badge>
                ))}
                {listing.reports.length ? (
                  <Badge tone="warning" size="sm">
                    {t("reports", { count: listing.reports.length })}
                  </Badge>
                ) : null}
              </span>
              {listing.reports.length ? (
                <ul className="text-muted m-0 list-disc ps-4 text-xs">
                  {listing.reports.slice(0, 5).map((report) => (
                    <li key={report.id}>
                      {t(`reportReasons.${report.reason}`)}
                      {report.details ? ` — ${report.details}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {listing.hiddenAt ? (
                <span className="text-muted text-xs">
                  {t("hiddenSince", { date: formatDateTime(listing.hiddenAt, locale) })} ·{" "}
                  {t("hiddenReason", {
                    reason: listing.hiddenReason === "reports" ? t("hiddenByReports") : (listing.hiddenReason ?? ""),
                  })}
                </span>
              ) : null}
            </span>
          ),
          rent: <span className="tabular-nums">{formatTHB(listing.rent, locale, { decimals: 0 })}</span>,
          actions: <ListingModerationActions listing={listing} />,
        },
      }))}
    />
  );
}

async function Verifications({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.listings");
  const { api, locale } = context;
  const rows = await section(
    unwrap(api.GET("/v1/admin/listing-verifications", { params: { query: { state: "pending" } } })),
  );
  if (!rows.data) return <SectionError error={rows.error} />;
  if (rows.data.length === 0)
    return (
      <Card>
        <EmptyState icon={IconFlag} title={t("empty.verifications")} description={t("emptyHint")} />
      </Card>
    );
  return (
    <SimpleTable
      caption={t("tab.verifications")}
      testId="verification-queue"
      minWidth="52rem"
      columns={[
        { key: "owner", header: t("col.owner") },
        { key: "unit", header: t("col.unit") },
        { key: "evidence", header: t("col.evidence") },
        { key: "submitted", header: t("col.submitted") },
        { key: "state", header: t("col.state") },
        { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
      ]}
      rows={rows.data.map((v) => ({
        key: v.id,
        testId: "verification-row",
        cells: {
          owner: v.tenantName,
          unit: `${v.buildingName} · ${v.unitNo}`,
          evidence: t(`verification.kinds.${v.evidenceKind}`),
          submitted: formatDateTime(v.submittedAt, locale),
          state: (
            <span className="flex flex-col gap-1">
              <StatusBadgeOf map={LISTING_VERIFICATION_STATUS} value={v.state} size="sm" />
              {v.reviewedBy ? <span className="text-muted text-xs">{t("verification.makerDone")}</span> : null}
            </span>
          ),
          actions: <VerificationReview verification={v} />,
        },
      }))}
    />
  );
}
