import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { RowList } from "@/ui/components/RowList";
import type { IconGlyph } from "@/ui/icons";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconShow } from "@/ui/icons/glyphs/show";
import { IconSyncFailed } from "@/ui/icons/glyphs/sync-failed";
import { IconWallet } from "@/ui/icons/glyphs/wallet";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { can, type AdminContext, type AdminPermission } from "../shared/server";
import { isOverdue } from "./PrivacyView";

type Role = Schemas["PlatformRole"];

interface Queue {
  key: string;
  href: string;
  count: number | null;
}

/** What each queue is about (decorative), who usually works it, and whether waiting means it is late. */
const QUEUE_META: Record<string, { icon: IconGlyph; role: Role; overdue?: boolean }> = {
  tariffsToVerify: { icon: IconElectric, role: "platform_admin" },
  tariffsToPublish: { icon: IconElectric, role: "platform_admin" },
  overdueInvoices: { icon: IconBill, role: "finance", overdue: true },
  pastDue: { icon: IconWallet, role: "finance" },
  surveys: { icon: IconWrench, role: "field_engineer" },
  grantsWaiting: { icon: IconShow, role: "support" },
  dsrOverdue: { icon: IconShield, role: "platform_admin", overdue: true },
  outboxDead: { icon: IconSyncFailed, role: "platform_admin" },
  gatewaysOffline: { icon: IconGateway, role: "field_engineer" },
};

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
        (await unwrap(api.GET("/v1/admin/site-surveys", { params: { query: { state: "requested" } } }))).length,
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
  const health = platformHealth(context);
  const [queues, figures] = await Promise.all([Promise.all(pending), health]);
  const open = queues.filter((queue) => queue.count !== 0);
  const roles = await getTranslations("glossary.platformRole");

  return (
    <ConsolePage testId="admin-home">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        {open.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconCheckCircle}
            title={t("clearTitle")}
            description={t("clearBody")}
            action={
              <Button asChild variant="secondary">
                <Link href="/tenants">{t("clearAction")}</Link>
              </Button>
            }
          />
        ) : (
          <RowList
            label={t("queuesLabel")}
            testId="admin-queues"
            items={open.map((queue) => {
              const meta = QUEUE_META[queue.key]!;
              return {
                key: queue.key,
                href: queue.href,
                icon: meta.icon,
                testId: "admin-queue",
                title: (
                  <span className="inline-flex flex-wrap items-center gap-2" data-queue={queue.key}>
                    {t(`queue.${queue.key}.title`)}
                    {meta.overdue && queue.count ? (
                      <Badge tone="danger" size="sm" icon={IconWarning}>
                        {t("overdue")}
                      </Badge>
                    ) : null}
                  </span>
                ),
                meta: queue.count === null ? t("uncounted") : t(`queue.${queue.key}.body`, { count: queue.count }),
                status: <Badge size="sm">{roles(meta.role)}</Badge>,
                figure:
                  queue.count === null ? null : (
                    <span className="text-lg font-semibold">{formatNumber(queue.count, locale)}</span>
                  ),
              };
            })}
          />
        )}
        {figures.length > 0 ? (
          <Card as="section" aria-labelledby="platform-health" data-testid="platform-health">
            <h2 id="platform-health" className="text-base font-semibold">
              {t("health.title")}
            </h2>
            <dl className="divide-border mt-3 flex flex-col divide-y">
              {figures.map((figure) => (
                <div key={figure.key} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-muted text-sm">{t(`health.${figure.key}`)}</dt>
                  <dd className="font-semibold tabular-nums">{figure.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}
      </div>
    </ConsolePage>
  );
}

/**
 * The platform's few health figures beside the queues (API totals only, each for the people who may read it): customers,
 * subscriptions on trial, gateways online of all gateways.
 */
async function platformHealth(context: AdminContext): Promise<{ key: string; value: string }[]> {
  const { api, me, locale } = context;
  const total = async (read: Promise<{ meta: { total: number } }>) => {
    try {
      return (await read).meta.total;
    } catch {
      return null;
    }
  };
  const [tenants, trial, online, gateways] = await Promise.all([
    can(me, "admin.tenant.read")
      ? total(unwrap(api.GET("/v1/admin/tenants", { params: { query: { perPage: 1 } } })))
      : null,
    can(me, "admin.subscription.manage")
      ? total(unwrap(api.GET("/v1/admin/subscriptions", { params: { query: { state: "trial", perPage: 1 } } })))
      : null,
    can(me, "admin.device.manage")
      ? total(
          unwrap(
            api.GET("/v1/admin/devices", { params: { query: { kind: "gateway", status: "online", perPage: 1 } } }),
          ),
        )
      : null,
    can(me, "admin.device.manage")
      ? total(unwrap(api.GET("/v1/admin/devices", { params: { query: { kind: "gateway", perPage: 1 } } })))
      : null,
  ]);
  const figures: { key: string; value: string }[] = [];
  if (tenants !== null) figures.push({ key: "tenants", value: formatNumber(tenants, locale) });
  if (trial !== null) figures.push({ key: "trial", value: formatNumber(trial, locale) });
  if (online !== null && gateways !== null)
    figures.push({
      key: "gateways",
      value: `${formatNumber(online, locale)} / ${formatNumber(gateways, locale)}`,
    });
  return figures;
}
