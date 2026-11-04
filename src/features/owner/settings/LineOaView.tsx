import { getTranslations } from "next-intl/server";

import { MESSAGING_CHANNEL_STATUS } from "@/domain/status/messagingChannel";
import { PLATFORM_INVOICE_STATUS } from "@/domain/status";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { vatPercent } from "@/features/shared/growth/sponsored";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Avatar } from "@/ui/components/Avatar";
import { Progress } from "@/ui/components/Progress";
import { Icon } from "@/ui/icons";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconLink } from "@/ui/icons/glyphs/link";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { ConnectLineOa, CopyWebhookUrl, RevokeLineOa, VerifyLineOa, type AddonTerms } from "./LineOaActions";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

/**
 * The operator's own LINE Official Account (D-254): connected channels (for every building, or one), each with its
 * state from LINE, the webhook URL to paste in LINE Developers and how many residents confirmed; how to connect one.
 * No channel = every message goes through the shared getproperty OA, which also covers residents not yet linked.
 */
export async function LineOaView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.settings.lineOa");
  const { api, locale, me, buildings } = context;
  const [channels, usage, addons] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/messaging/channels"))),
    section(unwrap(api.GET("/v1/owner/messaging/usage"))),
    section(unwrap(api.GET("/v1/owner/messaging/addons"))),
  ]);
  const offer = addons.data?.offer ?? null;
  // G4 (D-287): while the agency add-on is priced, connecting restates its prices and asks for them to be accepted.
  const terms: AddonTerms | null =
    offer?.onSale && offer.versionId && offer.monthlyFee && offer.setupFee
      ? {
          versionId: offer.versionId,
          monthlyFee: offer.monthlyFee,
          setupFee: offer.setupFee,
          vatRate: offer.vatRate,
          setupCharged: addons.data?.setupCharged ?? false,
        }
      : null;
  const manage = ownerCan(me, "tenant.settings.update") && !readOnly(me);
  const scope = (id: string | null) =>
    id ? (buildings.find((building) => building.id === id)?.name ?? t("scopeOther")) : t("scopeAll");
  const options = buildings.map((building) => ({ id: building.id, name: building.name }));
  const connected = (channels.data ?? []).length > 0;
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/line-oa"
      title={t("title")}
      description={t("description")}
      testId="line-oa"
    >
      {!channels.data ? (
        <SectionError error={channels.error} />
      ) : !connected ? (
        <section
          aria-labelledby="line-oa-status"
          className="rounded-card border-border bg-surface shadow-card flex flex-col gap-4 border p-5 md:flex-row md:items-center md:justify-between md:p-6"
          data-testid="line-oa-status"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <span className="flex flex-wrap items-center gap-3">
              <h2 id="line-oa-status" className="text-lg font-semibold">
                {t("statusTitle")}
              </h2>
              <Badge tone="neutral" icon={IconLink}>
                {t("notConnected")}
              </Badge>
            </span>
            <p className="text-muted text-base">{t("emptyHint")}</p>
          </div>
          {manage ? (
            <div className="shrink-0">
              <ConnectLineOa buildings={options} addon={terms} />
            </div>
          ) : null}
        </section>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-label={t("title")}>
          {channels.data.map((channel) => (
            <li key={channel.id}>
              <article
                className="rounded-card border-border bg-surface shadow-card flex flex-col border"
                data-testid="line-oa-channel"
                data-state={channel.state}
              >
                <div className="flex flex-col gap-5 p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {channel.botPictureUrl ? (
                        // A LINE profile image (any host): a plain <img>.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={channel.botPictureUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <Avatar name={channel.botName ?? "LINE"} />
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-lg font-semibold">{channel.botName ?? t("unnamed")}</span>
                        <span className="text-muted text-sm">
                          {scope(channel.buildingId)} ·{" "}
                          <span className="tabular-nums">{t("channel", { id: channel.lineChannelId })}</span>
                        </span>
                      </div>
                    </div>
                    <StatusBadgeOf map={MESSAGING_CHANNEL_STATUS} value={channel.state} />
                  </div>
                  {channel.state === "failing" && channel.lastError ? (
                    <Callout tone="danger">{channel.lastError}</Callout>
                  ) : null}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t("webhook")}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <code
                        className="bg-bg-subtle border-border rounded-control min-w-0 flex-1 border px-3 py-2 font-mono text-sm break-all"
                        data-testid="line-oa-webhook"
                      >
                        {channel.webhookUrl}
                      </code>
                      <CopyWebhookUrl url={channel.webhookUrl} />
                    </div>
                    <span className="text-muted text-sm">{t("webhookHint")}</span>
                  </div>
                  <p className="text-muted flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span data-testid="line-oa-linked" className="text-fg">
                      {t("linked", { count: channel.linkedUsers })}
                    </span>
                    {channel.lastCheckedAt ? (
                      <span>{t("checkedAt", { date: formatDateTime(channel.lastCheckedAt, locale) })}</span>
                    ) : null}
                  </p>
                </div>
                {manage ? (
                  <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3 md:px-6">
                    <VerifyLineOa channel={channel} />
                    <RevokeLineOa channel={channel} />
                  </div>
                ) : null}
              </article>
            </li>
          ))}
          {manage ? (
            <li className="flex justify-end">
              <ConnectLineOa buildings={options} addon={terms} secondary />
            </li>
          ) : null}
        </ul>
      )}

      {usage.data ? <UsageCard usage={usage.data} locale={locale} t={t} /> : null}
      {addons.data?.offer ? <AddonCard addons={addons.data} locale={locale} t={t} /> : null}

      <SettingsCard id="line-oa-how-title" testId="line-oa-how" title={t("how.title")}>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {(["step1", "step2", "step3", "step4"] as const).map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden="true"
                className="border-border-strong text-fg grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <span className="text-base">{t(`how.${step}`)}</span>
            </li>
          ))}
        </ol>
        <div className="bg-info-subtle text-info-subtle-fg rounded-control mt-5 flex gap-2 px-4 py-3 text-sm">
          <Icon icon={IconInfo} className="mt-0.5 shrink-0" />
          <span>{t("shared")}</span>
        </div>
      </SettingsCard>
    </SettingsFrame>
  );
}

/** This month's messages (D-254): the shared OA against its free messages, the charge beyond, the own OA's count. */
function UsageCard({
  usage,
  locale,
  t,
}: {
  usage: Schemas["MessagingUsageDto"];
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations<"owner.settings.lineOa">>>;
}) {
  const { shared, own } = usage;
  const tone =
    shared.usedPercent === null
      ? "primary"
      : shared.usedPercent >= 100
        ? "danger"
        : shared.usedPercent >= 80
          ? "warning"
          : "primary";
  return (
    <Card
      as="section"
      className="flex flex-col gap-4"
      data-testid="line-oa-usage"
      aria-labelledby="line-oa-usage-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="line-oa-usage-title" className="text-lg font-semibold">
          {t("usage.title")}
        </h2>
        <span className="text-muted text-sm">{t("usage.repliesFree")}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{t("usage.shared")}</span>
          {shared.allowance !== null ? (
            <span className="text-sm tabular-nums">
              {t("usage.counted", { counted: shared.counted, allowance: shared.allowance })}
            </span>
          ) : null}
        </span>
        {shared.allowance === null ? (
          <p data-testid="line-oa-usage-shared">{t("usage.notCharged", { counted: shared.counted })}</p>
        ) : (
          <>
            <Progress
              size="sm"
              showCaption={false}
              value={shared.counted}
              max={shared.allowance}
              tone={tone}
              label={t("usage.shared")}
              valueText={t("usage.counted", { counted: shared.counted, allowance: shared.allowance })}
            />
            <p className="text-muted text-sm" data-testid="line-oa-usage-shared">
              {shared.chargeable > 0 && shared.estimatedCharge !== null
                ? t("usage.beyond", {
                    count: shared.chargeable,
                    amount: formatTHB(shared.estimatedCharge, locale),
                    vat: formatTHB(shared.estimatedVat ?? "0", locale),
                  })
                : t("usage.left", { left: shared.left ?? 0 })}
            </p>
          </>
        )}
      </div>
      {own.counted > 0 ? <p className="text-sm">{t("usage.own", { count: own.counted })}</p> : null}
      {usage.quotaFallbacks > 0 ? (
        <Callout tone="warning">{t("usage.fallbacks", { count: usage.quotaFallbacks })}</Callout>
      ) : null}
    </Card>
  );
}

/**
 * The agency LINE OA integration add-on (G4, D-287, D-291): free while no price is published (O-027); otherwise the
 * monthly and setup fee of the version in force (before VAT, from when), whether the setup fee was charged and the
 * fee invoices. LINE bills its own message charges to the agency directly; an unpaid fee suspends nothing (D-250).
 */
function AddonCard({
  addons,
  locale,
  t,
}: {
  addons: Schemas["MessagingAddonsDto"];
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations<"owner.settings.lineOa">>>;
}) {
  const offer = addons.offer!;
  const name = locale === "th" ? offer.nameTh : offer.nameEn;
  const priced = offer.onSale && offer.monthlyFee !== null && offer.setupFee !== null;
  return (
    <Card className="flex flex-col gap-4" data-testid="line-oa-addon" data-on-sale={offer.onSale}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{name}</h2>
        {priced ? null : (
          <Badge tone="success" size="sm">
            {t("addon.freeBadge")}
          </Badge>
        )}
      </div>
      {priced ? (
        <div className="flex flex-col gap-3">
          <dl className="m-0 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-muted text-sm">{t("addon.monthlyLabel")}</dt>
              <dd className="m-0 text-xl font-semibold tabular-nums" data-testid="line-oa-addon-monthly">
                {formatTHB(offer.monthlyFee!, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-sm">{t("addon.setupLabel")}</dt>
              <dd className="m-0 text-xl font-semibold tabular-nums">{formatTHB(offer.setupFee!, locale)}</dd>
              <dd className="text-muted m-0 text-xs">
                {addons.setupCharged ? t("addon.setupChargedShort") : t("addon.setupOnce")}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-sm">{t("addon.vatLabel")}</dt>
              <dd className="m-0 text-xl font-semibold tabular-nums">{vatPercent(offer.vatRate, locale)}</dd>
              {offer.effectiveFrom ? (
                <dd className="text-muted m-0 text-xs">
                  {t("addon.from", { date: formatDate(offer.effectiveFrom, locale) })}
                </dd>
              ) : null}
            </div>
          </dl>
          <p className="text-muted m-0 text-sm">{t("addon.how")}</p>
        </div>
      ) : (
        <p className="m-0" data-testid="line-oa-addon-free">
          {t("addon.free")}
        </p>
      )}
      {addons.invoices.length > 0 ? (
        <section aria-labelledby="line-oa-addon-invoices" className="flex flex-col gap-2">
          <h3 id="line-oa-addon-invoices" className="text-sm font-semibold">
            {t("addon.invoices")}
          </h3>
          <ul className="divide-border m-0 list-none divide-y p-0">
            {addons.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                data-testid="line-oa-addon-invoice"
              >
                <a
                  href={ownerPath(locale, `/subscription/invoices/${invoice.id}`)}
                  className="text-primary font-medium hover:underline"
                >
                  {invoice.number}
                </a>
                <span className="text-muted">
                  {invoice.charge === "setup"
                    ? t("addon.charge.setup")
                    : t("addon.charge.monthly", {
                        from: formatDate(invoice.periodStart, locale),
                        to: formatDate(invoice.periodEnd, locale),
                      })}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{formatTHB(invoice.total, locale)}</span>
                  <StatusBadgeOf map={PLATFORM_INVOICE_STATUS} value={invoice.state} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-muted m-0 text-xs">{t("addon.lineCharges")}</p>
    </Card>
  );
}
