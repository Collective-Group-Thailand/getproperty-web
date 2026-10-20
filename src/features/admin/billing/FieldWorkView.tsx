import { getTranslations } from "next-intl/server";

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
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";

import { can, enumParam, pageParam, section, type AdminContext } from "../shared/server";
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
  const [orders, surveys, people] = await Promise.all([
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
  ]);
  const nameOf = (id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : t("nobody"));

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="install-orders" className="flex flex-col gap-3">
        <h2 id="install-orders" className="text-lg font-semibold">
          {t("orders")}
        </h2>
        <FilterBar
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
        {!orders.data ? (
          <SectionError error={orders.error} />
        ) : orders.data.data.length === 0 ? (
          <Card>
            <EmptyState icon={IconChecklist} title={t("noOrders")} />
          </Card>
        ) : (
          <>
            <SimpleTable
              caption={t("orders")}
              testId="install-orders"
              minWidth="56rem"
              columns={[
                { key: "building", header: t("col.building") },
                { key: "kind", header: t("col.kind") },
                { key: "items", header: t("col.items") },
                { key: "assignee", header: t("col.assignee") },
                { key: "due", header: t("col.due") },
                { key: "state", header: t("col.state") },
                { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
              ]}
              rows={orders.data.data.map((order) => ({
                key: order.id,
                testId: "install-order-row",
                data: { state: order.state, kind: order.kind },
                cells: {
                  building: (
                    <span className="flex flex-col">
                      <span className="font-semibold">{order.buildingName}</span>
                      {tenantId ? null : (
                        <a
                          href={`/tenants/${order.tenantId}/field-work`}
                          className="text-muted text-xs hover:underline"
                        >
                          {t("tenantLink")}
                        </a>
                      )}
                    </span>
                  ),
                  kind: t(`kindName.${order.kind}`),
                  items: t("itemsValue", {
                    done: order.items.filter((item) => item.done).length,
                    total: order.items.length,
                  }),
                  assignee: nameOf(order.assignedTo),
                  due: order.dueAt ? formatDate(order.dueAt, locale) : "—",
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
      <section aria-labelledby="site-surveys" className="flex flex-col gap-3">
        <h2 id="site-surveys" className="text-lg font-semibold">
          {t("surveys")}
        </h2>
        <FilterBar
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
        {!surveys.data ? (
          <SectionError error={surveys.error} />
        ) : surveys.data.length === 0 ? (
          <p className="text-muted">{t("noSurveys")}</p>
        ) : (
          <SimpleTable
            caption={t("surveys")}
            testId="site-surveys"
            minWidth="52rem"
            columns={[
              { key: "created", header: t("col.requested") },
              { key: "plan", header: t("col.plan") },
              { key: "scheduled", header: t("col.scheduled") },
              { key: "notes", header: t("col.notes") },
              { key: "state", header: t("col.state") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={surveys.data.map((survey) => ({
              key: survey.id,
              testId: "site-survey-row",
              data: { state: survey.state },
              cells: {
                created: (
                  <span className="flex flex-col">
                    <span>{formatDate(survey.createdAt, locale)}</span>
                    {tenantId ? null : (
                      <a href={`/tenants/${survey.tenantId}/field-work`} className="text-muted text-xs hover:underline">
                        {t("tenantLink")}
                      </a>
                    )}
                  </span>
                ),
                plan: survey.targetPlanKey,
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
