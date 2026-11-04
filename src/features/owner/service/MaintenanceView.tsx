import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconClock } from "@/ui/icons/glyphs/clock";

import { ownerPath } from "../shared/links";
import { fieldMembers } from "../shared/members";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { EditPlan, NewPlan, type AssetChoice } from "./MaintenanceActions";
import { buildingUnits, serviceCategories } from "./server";
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
        actions={
          canManage && building ? (
            <NewPlan assets={assets} units={units} categories={categoryOptions} members={members} />
          ) : null
        }
      />
      {plans.error ? <SectionError error={plans.error} /> : null}
      {list.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCalendar}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            canManage && building ? (
              <NewPlan
                assets={assets}
                units={units}
                categories={categoryOptions}
                members={members}
                variant="secondary"
              />
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/work-orders")}>{t("empty.workOrders")}</a>
              </Button>
            )
          }
        />
      ) : (
        <section aria-labelledby="plans-next-due" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="plans-next-due" className="text-lg font-semibold">
              {t("nextDue")}
            </h2>
            <p className="text-muted text-sm">{t("nextDueHint")}</p>
          </div>
          <SimpleTable
            caption={t("nextDue")}
            testId="plan-table"
            stackOnPhones
            minWidth="52rem"
            columns={[
              { key: "plan", header: t("plan"), phone: "title" },
              { key: "due", header: t("due"), phone: "figure", className: "md:w-44" },
              { key: "interval", header: t("interval"), phone: "meta" },
              { key: "last", header: t("lastWorkOrder"), phone: "meta", className: "md:w-36" },
              {
                key: "actions",
                header: <span className="sr-only">{t("actions")}</span>,
                phone: "status",
                className: "md:w-24",
              },
            ]}
            rows={list.map((plan) => {
              const overdue = plan.isActive && plan.nextDueOn < today;
              const days = Math.round((Date.parse(plan.nextDueOn) - Date.parse(today)) / 86_400_000);
              return {
                key: plan.id,
                testId: "plan-row",
                data: { overdue, active: plan.isActive },
                cells: {
                  due: (
                    <span className="flex flex-col items-start gap-1 max-md:items-end">
                      <span className="whitespace-nowrap tabular-nums">{formatDate(plan.nextDueOn, locale)}</span>
                      {!plan.isActive ? (
                        <Badge tone="neutral" size="sm" icon={IconClock}>
                          {t("paused")}
                        </Badge>
                      ) : overdue ? (
                        <Badge tone="warning" size="sm" icon={IconAlert}>
                          {t("overdue")}
                        </Badge>
                      ) : days <= 14 ? (
                        <span className="text-muted text-sm font-normal">
                          {days === 0 ? t("dueToday") : t("dueIn", { days })}
                        </span>
                      ) : null}
                    </span>
                  ),
                  plan: (
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{plan.title}</span>
                      <span className="text-muted text-sm">{plan.assetItemName}</span>
                    </span>
                  ),
                  interval: (
                    <span className="text-sm">{t("every", { days: plan.intervalDays, lead: plan.leadDays })}</span>
                  ),
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
        </section>
      )}
    </OwnerPage>
  );
}
