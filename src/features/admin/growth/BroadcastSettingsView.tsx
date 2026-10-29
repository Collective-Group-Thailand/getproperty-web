import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconRules } from "@/ui/icons/glyphs/rules";

import { can, section, type AdminContext } from "../shared/server";
import { BroadcastSettingsForm } from "./BroadcastSettingsForm";
import { PublishConsentText } from "./PublishConsentText";

/**
 * Settings › Sponsored LINE broadcasts (G6, D-300, D-291): whether accounts may schedule (off until LINE Thailand
 * confirms, O-023) and how many people consent (a total), the eight values in force — each change a new setting
 * version with the reason — and the `platform.recommendations` consent text in Thai and English with its next
 * version (everyone is asked again).
 */
export async function BroadcastSettingsView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.broadcast");
  const listings = await getTranslations("admin.listings");
  const { api, locale, me } = context;
  if (!can(me, "admin.setting.manage")) notFound();
  const settings = await section(unwrap(api.GET("/v1/admin/broadcast/settings")));
  const text = settings.data?.consentText ?? null;

  return (
    <ConsolePage testId="broadcast-settings">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
        crumbs={[{ label: t("settings.title") }]}
        actions={
          can(me, "admin.tenant.read") ? (
            <Button asChild variant="secondary" iconStart={IconMegaphone}>
              <Link href="/listings/broadcasts" data-testid="broadcast-campaigns-link">
                {listings("tab.broadcasts")}
              </Link>
            </Button>
          ) : null
        }
      />
      {!settings.data ? (
        <SectionError error={settings.error} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card
              as="section"
              aria-labelledby="broadcast-status"
              className="flex flex-col gap-3"
              data-testid="broadcast-status"
              data-enabled={settings.data.enabled}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Icon icon={IconMegaphone} className="text-primary text-xl" />
                <h2 id="broadcast-status" className="m-0 text-base font-semibold">
                  {t("settings.status")}
                </h2>
                <Badge tone={settings.data.enabled ? "success" : "warning"} size="sm">
                  {settings.data.enabled ? t("settings.on") : t("settings.off")}
                </Badge>
              </div>
              <p className="text-muted m-0 text-sm">
                {settings.data.enabled ? t("settings.onBody") : t("settings.offBody")}
              </p>
            </Card>
            <Card as="section" aria-labelledby="broadcast-consenting" className="flex flex-col gap-1">
              <div className="text-muted flex items-center justify-between gap-2 text-sm">
                <h2 id="broadcast-consenting" className="m-0 text-sm font-normal">
                  {t("settings.consenting")}
                </h2>
                <Icon icon={IconResidents} className="text-lg" />
              </div>
              <p className="font-display m-0 text-3xl font-semibold tabular-nums" data-testid="broadcast-consenting">
                {formatNumber(settings.data.consenting, locale)}
              </p>
              <p className="text-muted m-0 text-sm">{t("settings.consentingHint")}</p>
            </Card>
          </div>

          <Card as="section" aria-labelledby="broadcast-values" className="flex flex-col gap-4">
            <CardHeader title={<span id="broadcast-values">{t("settings.formTitle")}</span>} />
            <BroadcastSettingsForm settings={settings.data} />
          </Card>

          <Card
            as="section"
            aria-labelledby="broadcast-consent"
            className="flex flex-col gap-4"
            data-testid="consent-text"
          >
            <CardHeader
              title={<span id="broadcast-consent">{t("consent.title")}</span>}
              description={t("consent.description")}
              action={
                <PublishConsentText
                  current={text ? { th: text.th, en: text.en } : null}
                  consentingCount={settings.data.consenting}
                />
              }
            />
            {text ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="info" size="sm">
                    <span data-testid="consent-version">{t("consent.version", { version: text.version })}</span>
                  </Badge>
                  <span className="text-muted">
                    {t("consent.since", { date: formatDateTime(text.effectiveFrom, locale) })}
                  </span>
                  <span className="text-muted inline-flex items-center gap-1">
                    <Icon icon={IconRules} />
                    {t("consent.draft")}
                  </span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {(["th", "en"] as const).map((lang) => (
                    <article
                      key={lang}
                      lang={lang}
                      className="rounded-card border-border flex flex-col gap-2 border p-4"
                      data-testid={`consent-${lang}`}
                    >
                      <span className="text-muted text-xs">{t(`consent.${lang}`)}</span>
                      <h3 className="m-0 text-base font-semibold">{text[lang].title}</h3>
                      <p className="text-muted m-0 text-sm whitespace-pre-line">{text[lang].bodyMarkdown}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={IconRules} title={t("consent.none")} />
            )}
          </Card>
        </>
      )}
    </ConsolePage>
  );
}
