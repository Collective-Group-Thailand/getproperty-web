import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { INSTALL_ORDER_STATUS, INSTALL_ORDER_VALUES } from "@/domain/status/installOrder";
import { SITE_SURVEY_STATUS, SITE_SURVEY_VALUES } from "@/domain/status/siteSurvey";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";

import { can, enumParam, pageParam, section, tenantNames, type AdminContext } from "../shared/server";
import { InstallOrderActions, SiteSurveyActions, type Assignee } from "./FieldActions";

type SearchParams = Record<string, string | string[] | undefined>;
const KINDS: Schemas["InstallOrderKind"][] = ["install", "deinstall", "replace", "site_survey"];

/** Who can be given field work: field engineers and platform admins (listed when the user may read platform users). */
async function assignees(context: AdminContext): Promise<Assignee[]> {
  if (!can(context.me, "admin.user.manage")) return [{ id: context.me.user.id, name: context.me.user.displayName }];
  const users = await section(unwrap(context.api.GET("/v1/admin/platform-users")));
  return (users.data ?? [])
    .filter(
      (user) =>
        user.status === "active" && user.roles.some((r) => r.role === "field_engineer" || r.role === "platform_admin"),
    )
    .map((user) => ({ id: user.id, name: user.displayName }));
}

/**
 * Field work (F5 5.1, D-081, D-205): install and de-install orders with their items (one gateway, a
 * meter device per unit and utility), and the site surveys owners asked for to upgrade to Smart.
 */
export async function FieldWork({
  context,
  searchParams,
  tenantId,
  path,
}: {
  context: AdminContext;
  searchParams: SearchParams;
  tenantId?: string;
  path: string;
}) {
  const t = await getTranslations("admin.billing.field");
  const status = await getTranslations("status.installOrder");
  const surveyStatus = await getTranslations("status.siteSurvey");
  const { api, locale, me } = context;
  const manage = can(me, "admin.device.manage") || can(me, "admin.subscription.manage");
  const kind = enumParam(searchParams.kind, KINDS);
  const [orders, surveys, people, names, plans] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/admin/install-orders", {
          params: {
            query: {
              page: pageParam(searchParams.page),
              perPage: 25,
              tenantId,
              kind,
              state: enumParam(searchParams.state, INSTALL_ORDER_VALUES),
            },
          },
        }),
      ),
    ),
    section(
      unwrap(
        api.GET("/v1/admin/site-surveys", {
          params: { query: { tenantId, state: enumParam(searchParams.surveyState, SITE_SURVEY_VALUES) } },
        }),
      ),
    ),
    manage ? assignees(context) : Promise.resolve([] as Assignee[]),
    tenantNames(),
    section(unwrap(api.GET("/v1/admin/price-plans"))),
  ]);
  const planNames = new Map((plans.data ?? []).map((plan) => [plan.key, plan.nameTh]));
  const nameOf = (id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? t("someone")) : t("nobody"));
  const tenantOf = (id: string) => names.get(id) ?? t("tenantLink");
  const filtered = Boolean(kind || searchParams.state);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="install-orders" className="flex flex-col gap-4">
        <h2 id="install-orders" className="text-lg font-semibold">
          {t("orders")}
        </h2>
        <ListToolbar
          filters={
            <FilterBar
              variant="toolbar"
              fields={[
                {
                  name: "state",
                  label: t("state"),
                  type: "select",
                  placeholder: t("allStates"),
                  options: INSTALL_ORDER_VALUES.map((value) => ({ value, label: status(value) })),
                },
                {
                  name: "kind",
                  label: t("kind"),
                  type: "select",
                  placeholder: t("allKinds"),
                  options: KINDS.map((value) => ({ value, label: t(`kindName.${value}`) })),
                },
              ]}
            />
          }
        />
        {!orders.data ? (
          <SectionError error={orders.error} />
        ) : orders.data.data.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconChecklist}
            title={filtered ? t("noOrdersFiltered") : t("noOrders")}
            action={
              <Button asChild variant="secondary">
                <a href={filtered ? path : tenantId ? `/tenants/${tenantId}/hardware` : "/subscriptions/hardware"}>
                  {filtered ? t("clear") : t("openHardware")}
                </a>
              </Button>
            }
          />
        ) : (
          <>
            <SimpleTable
              caption={t("orders")}
              testId="install-orders"
              stackOnPhones
              minWidth="60rem"
              columns={[
                { key: "building", header: t("col.building"), phone: "title" },
                { key: "kind", header: t("col.kind"), phone: "meta" },
                { key: "items", header: t("col.items"), align: "end", phone: "meta" },
                { key: "assignee", header: t("col.assignee"), phone: "meta" },
                { key: "due", header: t("col.due"), phone: "hidden" },
                { key: "state", header: t("col.state"), phone: "status" },
                {
                  key: "actions",
                  header: <span className="sr-only">{t("col.actions")}</span>,
                  phone: "figure",
                  className: "w-14",
                },
              ]}
              rows={orders.data.data.map((order) => ({
                key: order.id,
                testId: "install-order-row",
                data: { state: order.state, kind: order.kind },
                cells: {
                  building: (
                    <span className="flex flex-col">
                      <span className="font-semibold">{order.buildingName}</span>
                      {tenantId ? null : <span className="text-muted text-sm">{tenantOf(order.tenantId)}</span>}
                    </span>
                  ),
                  kind: t(`kindName.${order.kind}`),
                  items: (
                    <span className="whitespace-nowrap">
                      {t("itemsValue", {
                        done: order.items.filter((item) => item.done).length,
                        total: order.items.length,
                      })}
                    </span>
                  ),
                  assignee: nameOf(order.assignedTo),
                  due: order.dueAt ? <span className="whitespace-nowrap">{formatDate(order.dueAt, locale)}</span> : "—",
                  state: <StatusBadgeOf map={INSTALL_ORDER_STATUS} value={order.state} size="sm" />,
                  actions:
                    manage && order.nextActions.length > 0 ? (
                      <InstallOrderActions order={order} assignees={people} />
                    ) : null,
                },
              }))}
            />
            <ListPagination meta={orders.data.meta} path={path} searchParams={searchParams} locale={locale} />
          </>
        )}
      </section>
      <section aria-labelledby="site-surveys" className="flex flex-col gap-4">
        <h2 id="site-surveys" className="text-lg font-semibold">
          {t("surveys")}
        </h2>
        <ListToolbar
          filters={
            <FilterBar
              variant="toolbar"
              fields={[
                {
                  name: "surveyState",
                  label: t("state"),
                  type: "select",
                  placeholder: t("allStates"),
                  options: SITE_SURVEY_VALUES.map((value) => ({ value, label: surveyStatus(value) })),
                },
              ]}
            />
          }
        />
        {!surveys.data ? (
          <SectionError error={surveys.error} />
        ) : surveys.data.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconChecklist}
            title={t("noSurveys")}
            description={t("noSurveysBody")}
            action={
              searchParams.surveyState ? (
                <Button asChild variant="secondary">
                  <a href={path}>{t("clear")}</a>
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link href="/subscriptions/plans">{t("openPlans")}</Link>
                </Button>
              )
            }
          />
        ) : (
          <SimpleTable
            caption={t("surveys")}
            testId="site-surveys"
            stackOnPhones
            minWidth="56rem"
            columns={[
              { key: "created", header: t("col.requested"), phone: "title" },
              { key: "plan", header: t("col.plan"), phone: "meta" },
              { key: "scheduled", header: t("col.scheduled"), phone: "meta" },
              { key: "notes", header: t("col.notes"), phone: "hidden" },
              { key: "state", header: t("col.state"), phone: "status" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                phone: "figure",
                className: "w-14",
              },
            ]}
            rows={surveys.data.map((survey) => ({
              key: survey.id,
              testId: "site-survey-row",
              data: { state: survey.state },
              cells: {
                created: (
                  <span className="flex flex-col">
                    <span className="whitespace-nowrap">{formatDate(survey.createdAt, locale)}</span>
                    {tenantId ? null : <span className="text-muted text-sm">{tenantOf(survey.tenantId)}</span>}
                  </span>
                ),
                plan: planNames.get(survey.targetPlanKey) ?? survey.targetPlanKey,
                scheduled: survey.scheduledFor
                  ? `${formatDateTime(survey.scheduledFor, locale)} · ${nameOf(survey.assignedTo)}`
                  : "—",
                notes: survey.notes ?? "—",
                state: <StatusBadgeOf map={SITE_SURVEY_STATUS} value={survey.state} size="sm" />,
                actions: manage ? <SiteSurveyActions survey={survey} assignees={people} /> : null,
              },
            }))}
          />
        )}
      </section>
    </div>
  );
}
