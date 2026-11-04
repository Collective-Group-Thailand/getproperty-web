import { getTranslations } from "next-intl/server";

import { LISTING_STATUS, LISTING_VERIFICATION_STATUS } from "@/domain/status/listing";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { FactGrid } from "@/ui/components/FactGrid";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { RowList } from "@/ui/components/RowList";
import { SplitView } from "@/ui/components/SplitView";
import { Icon } from "@/ui/icons";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconFlag } from "@/ui/icons/glyphs/flag";

import { NotAllowed } from "../shared/NotAllowed";
import { can, section, withQuery, type AdminContext } from "../shared/server";
import { ListingModerationActions, VerificationReview } from "./ModerationActions";

export type ModerationTab = "queue" | "hidden" | "reported" | "verifications";
export const MODERATION_TABS: ModerationTab[] = ["queue", "hidden", "reported", "verifications"];

/**
 * Listings for platform Support (F6.5, D-252): the review queue, hidden and reported listings — each with the reasons
 * the API gave and the actions it allows — and owner verifications, whose evidence opens in a dialog (every link an
 * audited download).
 */
export async function ModerationView({
  context,
  tab,
  selected,
}: {
  context: AdminContext;
  tab: ModerationTab;
  selected?: string;
}) {
  const t = await getTranslations("admin.listings");
  const verify = can(context.me, "admin.listing.verify");
  const moderate = can(context.me, "admin.listing.moderate");
  if (!verify && !moderate) return <NotAllowed context={context} />;
  return (
    <ConsolePage testId="admin-listings">
      <PageHeader title={t("title")} description={t("description")} />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("tabsLabel")}
            current={tab}
            tabs={MODERATION_TABS.filter((one) => (one === "verifications" ? verify : moderate)).map((one) => ({
              key: one,
              href: moderationHref(one),
              label: t(`tab.${one}`),
              testId: `listings-tab-${one}`,
            }))}
          />
        }
      />
      {tab === "verifications" ? (
        <Verifications context={context} />
      ) : (
        <Queue context={context} tab={tab} selected={selected} />
      )}
    </ConsolePage>
  );
}

const moderationHref = (next: ModerationTab, id?: string) =>
  withQuery("/listings", { tab: next === "queue" ? undefined : next, id });

const QUEUE_KIND: Record<Exclude<ModerationTab, "verifications">, Schemas["ModerationQueue"]> = {
  queue: "pending_review",
  hidden: "hidden",
  reported: "reported",
};

async function Queue({
  context,
  tab,
  selected,
}: {
  context: AdminContext;
  tab: Exclude<ModerationTab, "verifications">;
  selected?: string;
}) {
  const t = await getTranslations("admin.listings");
  const { api, locale } = context;
  const rows = await section(
    unwrap(api.GET("/v1/admin/listings/queue", { params: { query: { kind: QUEUE_KIND[tab] } } })),
  );
  if (!rows.data) return <SectionError error={rows.error} />;
  if (rows.data.length === 0)
    return (
      <EmptyState
        variant="card"
        icon={IconFlag}
        title={t(`empty.${tab}`)}
        description={t("emptyHint")}
        action={
          <Button asChild variant="secondary">
            <a href={tab === "queue" ? moderationHref("reported") : moderationHref("queue")}>
              {tab === "queue" ? t("emptyOpenReported") : t("emptyOpenQueue")}
            </a>
          </Button>
        }
      />
    );
  const chosen = rows.data.find((listing) => listing.id === selected) ?? rows.data[0]!;
  const place = (listing: Schemas["AdminListingDto"]) =>
    [listing.district, listing.province].filter(Boolean).join(", ");
  return (
    <SplitView
      detailOnPhones={Boolean(selected)}
      list={
        <RowList
          stacked
          label={t(`tab.${tab}`)}
          testId="moderation-queue"
          items={rows.data.map((listing) => ({
            key: listing.id,
            href: moderationHref(tab, listing.id),
            current: listing.id === chosen.id,
            testId: "moderation-row",
            title: listing.titleTh,
            meta: [place(listing), listing.tenantName].filter(Boolean).join(" · "),
            status: (
              <span className="flex flex-wrap gap-1" data-slug={listing.slug}>
                {listing.reports.length ? (
                  <Badge tone="warning" size="sm">
                    {t("reports", { count: listing.reports.length })}
                  </Badge>
                ) : listing.reviewReasons[0] ? (
                  <Badge tone="info" size="sm">
                    {t(`reasons.${listing.reviewReasons[0]}`)}
                  </Badge>
                ) : null}
              </span>
            ),
            figure: formatTHB(listing.rent, locale, { decimals: 0 }),
          }))}
        />
      }
      detail={
        <article
          className="border-border bg-surface rounded-card shadow-card flex flex-col border"
          aria-labelledby="listing-preview-title"
          data-testid="moderation-preview"
          data-slug={chosen.slug}
        >
          <div className="flex flex-col gap-5 p-5 md:p-6">
            <a
              href={moderationHref(tab)}
              className="text-muted hover:text-fg inline-flex w-fit items-center gap-1 text-sm font-medium lg:hidden"
            >
              <Icon icon={IconChevronLeft} className="rtl:rotate-180" />
              {t(`tab.${tab}`)}
            </a>
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="listing-preview-title" className="text-xl font-semibold text-balance">
                  {chosen.titleTh}
                </h2>
                <StatusBadgeOf map={LISTING_STATUS} value={chosen.state} size="sm" />
              </div>
              <p className="text-muted text-sm">
                {[place(chosen), chosen.tenantName, t("updatedAt", { date: formatDateTime(chosen.updatedAt, locale) })]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </header>
            <FactGrid
              columns={3}
              label={t("factsLabel")}
              facts={[
                { key: "rent", label: t("col.rent"), value: formatTHB(chosen.rent, locale, { decimals: 0 }) },
                { key: "owner", label: t("col.owner"), value: chosen.tenantName },
                { key: "place", label: t("place"), value: place(chosen) || "—" },
              ]}
            />
            <section aria-label={t("descriptionLabel")} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">{t("descriptionLabel")}</h3>
              <p className="max-w-prose text-base whitespace-pre-line">{chosen.descriptionTh}</p>
            </section>
            {chosen.reviewReasons.length || chosen.reports.length || chosen.hiddenAt ? (
              <Callout tone={chosen.reports.length ? "warning" : "info"} title={t("whyTitle")}>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {chosen.reviewReasons.map((reason) => (
                    <li key={reason}>{t(`reasons.${reason}`)}</li>
                  ))}
                  {chosen.reports.slice(0, 5).map((report) => (
                    <li key={report.id}>
                      {t(`reportReasons.${report.reason}`)}
                      {report.details ? ` — ${report.details}` : ""}
                    </li>
                  ))}
                  {chosen.hiddenAt ? (
                    <li>
                      {t("hiddenSince", { date: formatDateTime(chosen.hiddenAt, locale) })} ·{" "}
                      {t("hiddenReason", {
                        reason: chosen.hiddenReason === "reports" ? t("hiddenByReports") : (chosen.hiddenReason ?? ""),
                      })}
                    </li>
                  ) : null}
                </ul>
              </Callout>
            ) : null}
          </div>
          <footer className="border-border bg-bg-subtle/60 rounded-b-card border-t px-5 py-4 md:px-6">
            <ListingModerationActions listing={chosen} />
          </footer>
        </article>
      }
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
      <EmptyState
        variant="card"
        icon={IconFlag}
        title={t("empty.verifications")}
        description={t("emptyHint")}
        action={
          <Button asChild variant="secondary">
            <a href={moderationHref("queue")}>{t("emptyOpenQueue")}</a>
          </Button>
        }
      />
    );
  return (
    <SimpleTable
      caption={t("tab.verifications")}
      testId="verification-queue"
      stackOnPhones
      minWidth="52rem"
      columns={[
        { key: "owner", header: t("col.owner"), phone: "title" },
        { key: "unit", header: t("col.unit"), phone: "meta" },
        { key: "evidence", header: t("col.evidence"), phone: "meta" },
        { key: "submitted", header: t("col.submitted"), phone: "hidden" },
        { key: "state", header: t("col.state"), phone: "status" },
        { key: "actions", header: <span className="sr-only">{t("col.actions")}</span>, phone: "meta", align: "end" },
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
