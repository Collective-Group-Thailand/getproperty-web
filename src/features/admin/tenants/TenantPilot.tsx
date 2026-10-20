import { getTranslations } from "next-intl/server";

import { PilotKpiView } from "@/features/shared/console/PilotKpiView";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate, formatPercent } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconFlag } from "@/ui/icons/glyphs/flag";

import { can, enumParam, section, type AdminContext } from "../shared/server";
import { PilotForm } from "./PilotForm";

/**
 * The pilot of a tenant (F5 5.1, D-083): the agreement's terms and, once it exists, the seven KPIs
 * baseline vs current over 30 or 90 days with their targets (`GET …/pilot-kpis?window=`).
 */
export async function TenantPilot({
  context,
  tenant,
  searchParams,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.tenants.pilot");
  const { api, locale, me } = context;
  const window = enumParam(searchParams.window, ["30d", "90d"] as const) ?? "90d";
  const pilot = await section(
    unwrap(api.GET("/v1/admin/tenants/{tenantId}/pilot-agreement", { params: { path: { tenantId: tenant.id } } })),
  );
  const missing = isApiError(pilot.error) && pilot.error.status === 404;
  if (pilot.error && !missing) return <SectionError error={pilot.error} />;
  const manage = can(me, "admin.subscription.manage");
  if (!pilot.data) {
    return (
      <Card>
        <EmptyState
          icon={IconFlag}
          title={t("none")}
          description={t("noneHint")}
          action={manage ? <PilotForm tenantId={tenant.id} pilot={null} /> : undefined}
        />
      </Card>
    );
  }
  const kpis = await section(
    unwrap(
      api.GET("/v1/admin/tenants/{tenantId}/pilot-kpis", {
        params: { path: { tenantId: tenant.id }, query: { window } },
      }),
    ),
  );
  const agreement = pilot.data;
  return (
    <div className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="pilot-terms" data-testid="pilot-terms">
        <CardHeader
          title={<span id="pilot-terms">{t("terms")}</span>}
          description={agreement.notes ?? undefined}
          action={manage ? <PilotForm tenantId={tenant.id} pilot={agreement} /> : undefined}
        />
        <DescriptionList
          columns={3}
          items={[
            { id: "signed", term: t("signedOn"), description: formatDate(agreement.signedOn, locale) },
            { id: "term", term: t("termMonths"), description: t("months", { count: agreement.termMonths }) },
            {
              id: "discount",
              term: t("discountPct"),
              description: (
                <span data-testid="pilot-discount-value">{formatPercent(agreement.discountPct, locale)}</span>
              ),
            },
            { id: "review", term: t("kpiReviewOn"), description: formatDate(agreement.kpiReviewOn, locale) },
            {
              id: "cadence",
              term: t("cadence"),
              description: t.has(`cadenceName.${agreement.feedbackCadence}`)
                ? t(`cadenceName.${agreement.feedbackCadence}`)
                : agreement.feedbackCadence,
            },
            {
              id: "rights",
              term: t("rights"),
              description:
                [
                  agreement.referenceSiteRights ? t("referenceSite") : null,
                  agreement.anonymisedDataUse ? t("anonymisedData") : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null,
            },
          ]}
        />
      </Card>
      <section aria-labelledby="pilot-kpis-title" className="flex flex-col gap-3">
        <h2 id="pilot-kpis-title" className="text-lg font-semibold">
          {t("kpis")}
        </h2>
        {kpis.data ? (
          <PilotKpiView
            kpis={kpis.data}
            locale={locale}
            windowHref={(value) => `/tenants/${tenant.id}/pilot?window=${value}`}
          />
        ) : (
          <SectionError error={kpis.error} />
        )}
      </section>
    </div>
  );
}
