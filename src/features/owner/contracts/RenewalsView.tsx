import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { RenewalOfferRow } from "./RenewalOfferRow";
import { renewalReminder } from "./reminders";

type Tab = "open" | "decided";

/**
 * Renewal offers (G3, D-294): the open ones waiting for the resident's answer in LINE (withdrawable) and the decided
 * ones — accepted (the renewal lease, signed then; the old lease closes by itself at its end), declined (the lessee's
 * notice and the move-out, D-219), expired or withdrawn. Offers are made from the lease page.
 */
export async function RenewalsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.contracts");
  const { api, locale, me } = context;
  const [offers, leases, settings] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/renewal-offers"))),
    section(
      unwrap(api.GET("/v1/owner/leases", { params: { query: { perPage: 100, sort: "startDate", order: "desc" } } })),
    ),
    // The reminder days are a tenant setting (D-294): the empty state names them only as the API sends them.
    section(unwrap(api.GET("/v1/owner/settings"))),
  ]);
  const reminder = renewalReminder(settings.data);
  const reminderHint =
    reminder.kind === "days"
      ? t("renewals.emptyHint.days", {
          days: new Intl.ListFormat(locale, { type: "conjunction" }).format(reminder.days.map(String)),
        })
      : t(`renewals.emptyHint.${reminder.kind}`);
  const tab: Tab = param(searchParams.view) === "decided" ? "decided" : "open";
  const all = offers.data?.data ?? [];
  const shown = all.filter((offer) => (tab === "open") === (offer.state === "offered"));
  const byLease = new Map((leases.data?.data ?? []).map((lease) => [lease.id, lease]));
  const canManage = !readOnly(me) && ownerCan(me, "lease.manage");
  const base = ownerPath(locale, "/renewals");

  return (
    <OwnerPage testId="renewals">
      <PageHeader title={t("renewals.title")} description={t("renewals.description")} />
      <Callout tone="info">{t("renewals.howTo")}</Callout>
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("renewals.title")}
            current={tab}
            // Needs API: offer counts per state (`meta.total`) — the page does not count its own rows.
            tabs={(["open", "decided"] as const).map((key) => ({
              key,
              href: `${base}?view=${key}`,
              label: t(`renewals.tabs.${key}`),
              testId: `renewals-tab-${key}`,
            }))}
          />
        }
      />
      {!offers.data ? (
        <SectionError error={offers.error} />
      ) : shown.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCalendar}
          title={t(`renewals.empty.${tab}`)}
          description={reminderHint}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/leases?status=ending")}>{t("renewals.emptyAction")}</a>
            </Button>
          }
        />
      ) : (
        <Card padding="none">
          <ul className="divide-border m-0 list-none divide-y p-0" data-testid="renewal-rows">
            {shown.map((offer) => {
              const lease = byLease.get(offer.leaseId);
              return (
                <RenewalOfferRow
                  key={offer.id}
                  offer={offer}
                  locale={locale}
                  label={{ unitNo: lease?.unitNo ?? "—", lesseeName: lease?.lesseeName }}
                  canManage={canManage}
                />
              );
            })}
          </ul>
        </Card>
      )}
    </OwnerPage>
  );
}
