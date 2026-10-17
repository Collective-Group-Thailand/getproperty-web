"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { Button } from "@/ui/components/Button";
import { SkeletonText } from "@/ui/components/Skeleton";
import { IconExternal } from "@/ui/icons/glyphs/external";

import { ProblemNotice } from "@/features/shared/console/useApiAction";
import { loadUnitPanel } from "./loadUnit";
import { UnitPanel, type UnitPanelData } from "./UnitPanel";

/** The board's unit drawer body (lazy chunk): the unit panel read through the BFF, refetched after a change. */
export function UnitDrawerContent({ unitId, prefix }: { unitId: string; prefix: string }) {
  const t = useTranslations("owner.units.panel");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const [data, setData] = useState<UnitPanelData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadUnitPanel(browserApi(), unitId)
      .then((answer) => {
        if (!cancelled) {
          setData(answer);
          setError(null);
        }
      })
      .catch((failure: unknown) => !cancelled && setError(failure));
    return () => {
      cancelled = true;
    };
  }, [unitId, version]);

  const refetch = useCallback(() => setVersion((current) => current + 1), []);

  if (error) return <ProblemNotice error={error} />;
  if (!data)
    return (
      <div role="status">
        <span className="sr-only">{common("loading")}</span>
        <SkeletonText lines={8} />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <UnitPanel
        data={data}
        locale={locale}
        onChanged={refetch}
        links={{
          unit: `${prefix}/units/${unitId}`,
          lease: (id) => `${prefix}/leases/${id}`,
          newLease: `${prefix}/leases/new?unit=${unitId}`,
          invoice: (id) => `${prefix}/invoices/${id}`,
          meter: (id) => `${prefix}/meters/${id}`,
        }}
      />
      <Button asChild variant="secondary" iconStart={IconExternal}>
        <a href={`${prefix}/units/${unitId}`} data-testid="drawer-open-unit">
          {t("openPage")}
        </a>
      </Button>
    </div>
  );
}
