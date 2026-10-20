import { getTranslations } from "next-intl/server";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { can, type AdminContext, type AdminPermission } from "../shared/server";
import { isOverdue } from "./PrivacyView";

interface Queue {
  key: string;
  href: string;
  count: number | null;
}

/** A count from an API read, or `null` when the read failed (the card then says it could not be counted). */
async function count(read: () => Promise<number>): Promise<number | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/**
 * The back office's morning (F5): what waits for Collective staff, each queue only for the people who
 * may act on it — tariff versions for the second check or publishing, overdue platform invoices, support
 * requests waiting for a tenant, PDPA requests past their deadline, upgrade surveys to schedule, events
 * that failed to relay and gateways offline. Counts come from the list endpoints; nothing is inferred.
 */
export async function AdminHome({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.operations.home");
  const { api, me, locale } = context;
  const allowed = (...permissions: AdminPermission[]) => permissions.some((permission) => can(me, permission));
  const pending: Promise<Queue>[] = [];
  const add = (key: string, href: string, read: () => Promise<number>) =>
    pending.push(count(read).then((value) => ({ key, href, count: value })));

  if (allowed("admin.utility_tariff.enter", "admin.utility_tariff.verify")) {
    const tariffs = unwrap(api.GET("/v1/admin/utility-tariffs"));
    add(
      "tariffsToVerify",
      "/tariffs",
      async () =>
        (await tariffs).flatMap((tariff) => tariff.versions).filter((version) => version.nextActions.includes("verify"))
          .length,
    );
    add(
      "tariffsToPublish",
      "/tariffs",
      async () =>
        (await tariffs)
          .flatMap((tariff) => tariff.versions)
          .filter((version) => version.nextActions.includes("publish")).length,
    );
  }
  if (allowed("admin.subscription.manage", "admin.platform_invoice.issue")) {
    add(
      "overdueInvoices",
      "/subscriptions/invoices?state=overdue",
      async () =>
        (await unwrap(api.GET("/v1/admin/platform-invoices", { params: { query: { state: "overdue", perPage: 1 } } })))
          .meta.total,
    );
    add(
      "pastDue",
      "/subscriptions?state=past_due",
      async () =>
        (await unwrap(api.GET("/v1/admin/subscriptions", { params: { query: { state: "past_due", perPage: 1 } } })))
          .meta.total,
    );
  }
  if (allowed("admin.subscription.manage", "admin.device.manage")) {
    add(
      "surveys",
      "/subscriptions/field-work",
      async () =>
        (await unwrap(api.GET("/v1/admin/site-surveys"))).filter((survey) => survey.state === "requested").length,
    );
  }
  if (allowed("admin.support_grant.request", "admin.support_grant.approve_incident")) {
    add(
      "grantsWaiting",
      "/support",
      async () =>
        (await unwrap(api.GET("/v1/admin/support-grants"))).filter((grant) => grant.state === "requested").length,
    );
  }
  if (allowed("admin.dsr.manage")) {
    add(
      "dsrOverdue",
      "/privacy",
      async () => (await unwrap(api.GET("/v1/admin/data-subject-requests"))).filter((dsr) => isOverdue(dsr)).length,
    );
  }
  if (allowed("admin.outbox.manage")) {
    add(
      "outboxDead",
      "/outbox?state=dead",
      async () => (await unwrap(api.GET("/v1/admin/outbox/messages", { params: { query: { state: "dead" } } }))).length,
    );
  }
  if (allowed("admin.device.manage")) {
    add(
      "gatewaysOffline",
      "/devices?kind=gateway&status=offline",
      async () =>
        (
          await unwrap(
            api.GET("/v1/admin/devices", { params: { query: { kind: "gateway", status: "offline", perPage: 1 } } }),
          )
        ).meta.total,
    );
  }
  const queues = await Promise.all(pending);
  const open = queues.filter((queue) => queue.count !== 0);

  return (
    <ConsolePage testId="admin-home">
      <PageHeader title={t("title")} description={t("description")} />
      {open.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("clearTitle")} description={t("clearBody")} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="admin-queues">
          {open.map((queue) => (
            <li key={queue.key} data-testid="admin-queue" data-queue={queue.key}>
              <a
                href={queue.href}
                className="border-border bg-surface rounded-card hover:bg-bg-subtle flex items-start justify-between gap-3 border p-4"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">{t(`queue.${queue.key}.title`)}</span>
                  <span className="text-muted text-sm">
                    {queue.count === null ? t("uncounted") : t(`queue.${queue.key}.body`, { count: queue.count })}
                  </span>
                </span>
                {queue.count !== null ? (
                  <span aria-hidden="true">
                    <Badge tone="primary">{formatNumber(queue.count, locale)}</Badge>
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </ConsolePage>
  );
}
