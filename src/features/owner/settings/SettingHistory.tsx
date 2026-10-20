"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice } from "@/features/shared/console/useApiAction";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { LazyDialog } from "@/ui/components/overlays";
import { Spinner } from "@/ui/components/Spinner";
import { IconClock } from "@/ui/icons/glyphs/clock";

import { SettingValue } from "../shared/SettingValue";

/**
 * The versions of one setting (`GET /v1/owner/settings/{key}/versions`, ADR-0004, D-214): the platform default,
 * the tenant's and the property's versions, newest effective date first — including a **scheduled** change that
 * is not in force yet, which `GET /settings` does not show. Read when the dialog opens.
 */
export function SettingHistory({
  setting,
  label,
  propertyId,
}: {
  setting: Pick<Schemas["SettingDto"], "key" | "valueType">;
  label: string;
  propertyId?: string;
}) {
  const t = useTranslations("owner.settings.history");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Schemas["SettingHistoryEntryDto"][] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = () => {
    setVersions(null);
    setError(null);
    void unwrap(
      browserApi().GET("/v1/owner/settings/{key}/versions", {
        params: { path: { key: setting.key }, query: { propertyId } },
      }),
    )
      .then(setVersions)
      .catch(setError);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        iconStart={IconClock}
        onClick={() => {
          setOpen(true);
          load();
        }}
        data-testid={`history-${setting.key}`}
      >
        {t("open")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title", { name: label })}
        description={t("description")}
        size="lg"
        closeLabel={common("close")}
      >
        {error ? (
          <ProblemNotice error={error} />
        ) : versions === null ? (
          <Spinner label={t("loading")} />
        ) : versions.length === 0 ? (
          <p className="text-muted text-sm">{t("empty")}</p>
        ) : (
          <ol className="divide-border flex flex-col divide-y" data-testid="setting-history">
            {versions.map((version) => (
              <li
                key={version.versionId}
                className="flex flex-col gap-1 py-3"
                data-testid="setting-version"
                data-scope={version.scope}
                data-scheduled={version.scheduled || undefined}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <SettingValue
                    setting={{
                      ...setting,
                      value: version.value,
                      scope: version.scope,
                      effectiveFrom: version.effectiveFrom,
                    }}
                    locale={locale}
                    testId="setting-version-value"
                  />
                  {version.scheduled ? (
                    <Badge size="sm" tone="warning" icon={IconClock}>
                      {t("scheduled")}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-muted text-xs">
                  {version.effectiveTo
                    ? t("until", { date: formatDateTime(version.effectiveTo, locale) })
                    : t("openEnded")}
                  {" · "}
                  {t("created", { date: formatDateTime(version.createdAt, locale) })}
                </span>
                {version.reason ? <span className="text-sm">{t("reason", { reason: version.reason })}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </LazyDialog>
    </>
  );
}
