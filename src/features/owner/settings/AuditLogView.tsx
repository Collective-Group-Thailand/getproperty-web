import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { withQuery } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../shared/links";
import { param, section, type OwnerContext } from "../shared/server";
import { SettingsFrame } from "./SettingsNav";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bangkok = (value: string | undefined, end = false) =>
  value && DAY.test(value)
    ? new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`).toISOString()
    : undefined;

/** The areas of the log, as the API's action prefixes (`invoice.*`); the filter sends the prefix. */
const AREAS = [
  "invoice",
  "payment",
  "receipt",
  "lease",
  "deposit",
  "setting",
  "tenant",
  "member",
  "export",
  "support_grant",
  "dsr",
  "utility_tariff",
] as const;

/** The message id of an action (`support_grant.used` → `support_grant_used`). */
const id = (value: string) => value.replaceAll(".", "_");

/**
 * Settings › Audit log (F2 2.6, D-090; redesign G6, the admin audit table scoped to the tenant): who did what and when
 * — money, leases, settings, exports and every read made under a support grant — the action in Thai (never its code),
 * the person or "getproperty support", the outcome in words and an icon; filtered by area and day from one toolbar.
 */
export async function AuditLogView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.audit");
  const { api, locale, me } = context;
  const keep = { action: param(searchParams.action), from: param(searchParams.from), to: param(searchParams.to) };
  const cursor = param(searchParams.cursor);
  const rows = await section(
    unwrap(
      api.GET("/v1/owner/audit-log", {
        params: {
          query: {
            action: keep.action?.trim() || undefined,
            from: bangkok(keep.from),
            to: bangkok(keep.to, true),
            cursor,
            limit: 50,
          },
        },
      }),
    ),
  );
  const path = ownerPath(locale, "/settings/audit-log");
  const filtered = Boolean(keep.action || keep.from || keep.to);
  const areaOf = (action: string) => AREAS.find((area) => action.startsWith(`${area}.`));
  const actionText = (action: string) => {
    if (t.has(`actionName.${id(action)}`)) return t(`actionName.${id(action)}` as never);
    const area = areaOf(action);
    return area ? t("actionInArea", { area: t(`area.${area}`) }) : t("actionOther");
  };
  const actorText = (actor: Record<string, unknown>) => {
    if (typeof actor.displayName === "string" && actor.displayName) return actor.displayName;
    const kind =
      typeof actor.audience === "string" ? actor.audience : typeof actor.type === "string" ? actor.type : "system";
    return t.has(`actor.${kind}`) ? t(`actor.${kind}` as never) : t("actor.system");
  };
  const subjectText = (type: string | null) =>
    type && t.has(`subject.${id(type)}`) ? t(`subject.${id(type)}` as never) : null;

  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/audit-log"
      title={t("title")}
      description={t("description")}
      testId="audit-log"
    >
      <ListToolbar
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              {
                name: "action",
                label: t("area.label"),
                type: "select",
                placeholder: t("area.all"),
                options: [
                  // A link from another page may carry its own prefix (support access → `support_grant.*`).
                  ...AREAS.map((area) => ({ value: `${area}.*`, label: t(`area.${area}`) })),
                ],
              },
              { name: "from", label: t("from"), type: "date" },
              { name: "to", label: t("to"), type: "date" },
            ]}
          />
        }
        className="xl:justify-start"
      />
      {!rows.data ? (
        <SectionError error={rows.error} />
      ) : rows.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconHistory}
          title={filtered ? t("emptyFiltered") : t("empty")}
          description={filtered ? t("emptyFilteredHint") : t("emptyHint")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={path}>{t("clear")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/settings")}>{t("backToSettings")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="audit-table"
          minWidth="48rem"
          stackOnPhones
          columns={[
            { key: "action", header: t("col.action"), phone: "title" },
            { key: "actor", header: t("col.actor"), phone: "meta" },
            { key: "subject", header: t("col.subject"), phone: "meta" },
            { key: "at", header: t("col.at"), className: "whitespace-nowrap", phone: "figure" },
            { key: "outcome", header: t("col.outcome"), className: "whitespace-nowrap", phone: "status" },
          ]}
          rows={rows.data.data.map((entry) => ({
            key: entry.id,
            testId: "audit-row",
            data: { action: entry.action },
            cells: {
              action: (
                <span className="flex flex-col items-start gap-1">
                  <span className="font-medium">{actionText(entry.action)}</span>
                  {entry.supportGrantId ? (
                    <Badge size="sm" tone="info">
                      {t("underGrant")}
                    </Badge>
                  ) : null}
                </span>
              ),
              actor: actorText(entry.actor),
              subject: subjectText(entry.subjectType) ?? <span className="text-muted">—</span>,
              at: <span className="tabular-nums">{formatDateTime(entry.occurredAt, locale)}</span>,
              outcome:
                entry.outcome === "success" ? (
                  <StatusText tone="success" icon={IconCheckCircle}>
                    {t("outcome.success")}
                  </StatusText>
                ) : entry.outcome === "denied" ? (
                  <StatusText tone="warning" icon={IconAlert}>
                    {t("outcome.denied")}
                  </StatusText>
                ) : (
                  <StatusText tone="danger" icon={IconXCircle}>
                    {t("outcome.failure")}
                  </StatusText>
                ),
            },
          }))}
        />
      )}
      {cursor || rows.data?.meta.nextCursor ? (
        <nav aria-label={t("pages")} className="flex justify-between gap-2">
          {cursor ? (
            <Button asChild variant="secondary" size="sm">
              <a href={withQuery(path, keep)}>{t("newest")}</a>
            </Button>
          ) : (
            <span />
          )}
          {rows.data?.meta.nextCursor ? (
            <Button asChild variant="secondary" size="sm">
              <a href={withQuery(path, { ...keep, cursor: rows.data.meta.nextCursor })} data-testid="audit-older">
                {t("older")}
              </a>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </SettingsFrame>
  );
}
