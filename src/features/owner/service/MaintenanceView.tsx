import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";

import { ownerPath } from "../shared/links";
import { fieldMembers } from "../shared/members";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { EditPlan, NewPlan, type AssetChoice } from "./MaintenanceActions";
import { buildingUnits, serviceCategories } from "./server";
import { ServiceNav } from "./ServiceNav";
import { bangkokToday } from "@/features/shared/console/time";

/**
 * Preventive maintenance (F2 2.7, D-210): plans on the building's asset items with their **next-due list**,
 * soonest first and overdue marked; each plan's last preventive work order; new plans and edits.
 */
export async function MaintenanceView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.service.maintenance");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const [plans, categories, members, items, units] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/maintenance-plans", { params: { query: { buildingId: building?.id } } }))),
    serviceCategories(api),
    fieldMembers(api, { permission: "service_request.handle", buildingId: building?.id }),
    building
      ? unwrap(
          api.GET("/v1/owner/buildings/{buildingId}/asset-items", {
            params: { path: { buildingId: building.id }, query: { status: "active" } },
          }),
        )
          .then((body) => body.data)
          .catch(() => [])
      : Promise.resolve([]),
    building ? buildingUnits(api, building.id) : Promise.resolve([]),
  ]);
  const canManage = ownerCan(me, "maintenance_plan.manage") && !readOnly(me);
  // Every active asset item of the building, in the API's order; the form narrows them by unit.
  const assets: AssetChoice[] = items.map((item) => ({
    id: item.id,
    unitId: item.unitId,
    label: t("assetLabel", { category: t(`assetCategory.${item.category}`), name: item.name }),
  }));
  const today = bangkokToday();
  const list = [...(plans.data?.data ?? [])].sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn));
  const categoryOptions = categories.map(({ id, nameTh }) => ({ id, nameTh }));

  return (
    <OwnerPage testId="maintenance">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("title") }]}
        actions={
          canManage && building ? (
            <NewPlan assets={assets} units={units} categories={categoryOptions} members={members} />
          ) : null
        }
      />
      <ServiceNav current="/maintenance" locale={locale} />
      {plans.error ? <SectionError error={plans.error} /> : null}
      <Card>
        <CardHeader title={t("nextDue")} description={t("nextDueHint")} />
        {list.length === 0 ? (
          <EmptyState icon={IconCalendar} title={t("empty.title")} description={t("empty.body")} />
        ) : (
          <SimpleTable
            caption={t("nextDue")}
            testId="plan-table"
            minWidth="48rem"
            columns={[
              { key: "due", header: t("due") },
              { key: "plan", header: t("plan") },
              { key: "interval", header: t("interval") },
              { key: "last", header: t("lastWorkOrder") },
              { key: "actions", header: <span className="sr-only">{t("actions")}</span> },
            ]}
            rows={list.map((plan) => {
              const overdue = plan.isActive && plan.nextDueOn < today;
              return {
                key: plan.id,
                testId: "plan-row",
                tone: overdue ? "warning" : "default",
                data: { overdue, active: plan.isActive },
                cells: {
                  due: (
                    <span className="flex flex-col gap-1">
                      <span className="tabular-nums">{formatDate(plan.nextDueOn, locale)}</span>
                      {overdue ? (
                        <Badge tone="warning" size="sm">
                          {t("overdue")}
                        </Badge>
                      ) : null}
                      {plan.isActive ? null : (
                        <Badge tone="neutral" size="sm">
                          {t("paused")}
                        </Badge>
                      )}
                    </span>
                  ),
                  plan: (
                    <span className="flex flex-col">
                      <span className="font-medium">{plan.title}</span>
                      <span className="text-muted text-xs">{plan.assetItemName}</span>
                    </span>
                  ),
                  interval: t("every", { days: plan.intervalDays, lead: plan.leadDays }),
                  last: plan.lastWorkOrderId ? (
                    <a
                      className="underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/work-orders/${plan.lastWorkOrderId}`)}
                    >
                      {t("openWorkOrder")}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
                  actions: canManage ? <EditPlan plan={plan} categories={categoryOptions} members={members} /> : null,
                },
              };
            })}
          />
        )}
      </Card>
    </OwnerPage>
  );
}
