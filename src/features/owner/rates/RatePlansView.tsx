import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam } from "@/features/shared/console/params";
import { formatDate, formatDecimal, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { MoneyNav } from "../shared/MoneyNav";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { PLAN_KINDS } from "./constants";
import { CreateRatePlan, DeleteRatePlan, EditRatePlan, NewRateVersion } from "./RatePlanActions";
import { describeTiers } from "./tiers";

const UNITS = /^\d{1,6}(\.\d{1,3})?$/;
const PROVIDERS: Schemas["UtilityProvider"][] = ["mea", "pea", "mwa", "pwa"];

type CapRef = { utility: Schemas["Utility"]; provider: Schemas["UtilityProvider"] };

/** The (utility, provider) pairs of the tenant's buildings, from their utility accounts. */
async function capReferences(context: OwnerContext): Promise<CapRef[]> {
  const accounts = await Promise.all(
    context.buildings.map((building) =>
      unwrap(
        context.api.GET("/v1/owner/buildings/{buildingId}/utility-accounts", {
          params: { path: { buildingId: building.id } },
        }),
      ).catch(() => [] as Schemas["UtilityAccountDto"][]),
    ),
  );
  const seen = new Map<string, CapRef>();
  for (const account of accounts.flat())
    seen.set(`${account.utility}:${account.provider}`, { utility: account.utility, provider: account.provider });
  return [...seen.values()].sort((a, b) => a.utility.localeCompare(b.utility));
}

/** `compliance.tariff_cap.representative_units` as the API sends it (`{electric, water}`), when it does. */
function representativeUnits(
  settings: Schemas["SettingDto"][] | null,
  utility: Schemas["Utility"],
): string | undefined {
  const value = settings?.find((setting) => setting.key === "compliance.tariff_cap.representative_units")?.value as
    Record<string, unknown> | undefined;
  const units = value?.[utility];
  return typeof units === "string" || typeof units === "number" ? String(units) : undefined;
}

/**
 * Rate plans (F2 2.6, D-021a, D-140, D-141): what the tenant charges for power, water, common fees and
 * services, version by version, each power/water version with the API's cap comparison (above the
 * utility's effective average rate → the warning that was acknowledged). Above them, the utility
 * tariffs in force for the tenant's providers — the lawful reference — and a sample bill at the
 * utility's own rate for a consumption the owner types (`GET /v1/owner/utility-tariffs/current?units=`).
 */
export async function RatePlansView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.rates");
  const { api, locale, me, buildings } = context;
  const [plans, settings, refs] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/rate-plans"))),
    section(unwrap(api.GET("/v1/owner/settings"))),
    capReferences(context),
  ]);
  const caps = await Promise.all(
    refs.map(async (ref) => ({
      ref,
      result: await section(
        unwrap(
          api.GET("/v1/owner/utility-tariffs/current", {
            params: {
              query: {
                utility: ref.utility,
                provider: ref.provider,
                units: representativeUnits(settings.data, ref.utility),
              },
            },
          }),
        ),
      ),
    })),
  );

  // Sample bill: `?sampleUtility=&sampleProvider=&units=`.
  const sampleRef: CapRef | null = (() => {
    const provider = enumParam(searchParams.sampleProvider, PROVIDERS);
    const utility = enumParam(searchParams.sampleUtility, ["electric", "water"] as const);
    if (provider && utility) return { utility, provider };
    return refs[0] ?? null;
  })();
  const units = UNITS.test(param(searchParams.units) ?? "") ? param(searchParams.units)! : null;
  const sample =
    sampleRef && units
      ? await section(
          unwrap(
            api.GET("/v1/owner/utility-tariffs/current", {
              params: { query: { utility: sampleRef.utility, provider: sampleRef.provider, units } },
            }),
          ),
        )
      : null;

  const manage = ownerCan(me, "rate_plan.manage") && !readOnly(me);
  const unitShort = (utility: Schemas["Utility"]) => t(`unit.${utility === "electric" ? "kwh" : "m3"}`);
  const capHintFor = (kind: Schemas["RatePlanKind"]) => {
    const utility = kind === "power" ? "electric" : kind === "water" ? "water" : null;
    if (!utility) return null;
    const cap = caps.find((entry) => entry.ref.utility === utility && entry.result.data?.length)?.result.data?.[0];
    if (!cap) return null;
    return cap.charge?.effectiveAverageRate
      ? t("capHint", {
          rate: formatDecimal(cap.charge.effectiveAverageRate, locale, 4),
          units: cap.charge.units,
          unit: unitShort(utility),
          name: cap.nameTh,
        })
      : t("ceilingHint", {
          rate: formatDecimal(cap.ceilingPerUnit, locale, 4),
          unit: unitShort(utility),
          name: cap.nameTh,
        });
  };
  const buildingName = (id: string | null) =>
    id ? (buildings.find((building) => building.id === id)?.name ?? id.slice(0, 8)) : t("allBuildings");

  return (
    <OwnerPage testId="rate-plans">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          manage ? (
            <CreateRatePlan buildings={buildings.map((building) => ({ id: building.id, name: building.name }))} />
          ) : null
        }
      />
      <MoneyNav section="billing" current="/billing/rate-plans" locale={locale} />

      <Card as="section" aria-labelledby="rates-cap" data-testid="tariff-cap">
        <CardHeader title={<span id="rates-cap">{t("cap.title")}</span>} description={t("cap.description")} />
        {caps.length === 0 ? (
          <p className="text-muted">{t("cap.noAccounts")}</p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {caps.map(({ ref, result }) => (
              <li
                key={`${ref.utility}-${ref.provider}`}
                className="border-border rounded-card border p-4"
                data-testid="cap-ref"
                data-utility={ref.utility}
                data-provider={ref.provider}
              >
                <p className="font-semibold">
                  {t(`utility.${ref.utility}`)} · {t(`provider.${ref.provider}`)}
                </p>
                {!result.data ? (
                  isApiError(result.error) && result.error.code === "tariff.not_found" ? (
                    <p className="text-muted text-sm">{t("cap.notPublished")}</p>
                  ) : (
                    <SectionError error={result.error} />
                  )
                ) : (
                  result.data.map((tariff) => (
                    <div key={tariff.versionId} className="mt-2 flex flex-col gap-1 text-sm">
                      <span>
                        {tariff.nameTh} · {t("cap.since", { date: formatDate(tariff.effectiveFrom, locale) })}
                      </span>
                      {tariff.charge?.effectiveAverageRate ? (
                        <span data-testid="cap-rate">
                          {t("cap.average", {
                            rate: formatDecimal(tariff.charge.effectiveAverageRate, locale, 4),
                            unit: unitShort(ref.utility),
                            units: tariff.charge.units,
                          })}
                        </span>
                      ) : null}
                      <span className="text-muted">
                        {t("cap.ceiling", {
                          rate: formatDecimal(tariff.ceilingPerUnit, locale, 4),
                          unit: unitShort(ref.utility),
                        })}
                      </span>
                      <a
                        href={tariff.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs underline-offset-4 hover:underline"
                      >
                        {t("cap.source")}
                      </a>
                    </div>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
        {sampleRef ? (
          <div className="mt-6 flex flex-col gap-3" data-testid="sample-bill">
            <h3 className="font-semibold">{t("sample.title")}</h3>
            <p className="text-muted text-sm">{t("sample.description")}</p>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 text-sm">
                <span>{t("sample.tariff")}</span>
                <span className="flex flex-wrap gap-2">
                  {refs.map((ref) => (
                    <a
                      key={`${ref.utility}:${ref.provider}`}
                      href={`?sampleUtility=${ref.utility}&sampleProvider=${ref.provider}${units ? `&units=${units}` : ""}`}
                      aria-current={
                        ref.utility === sampleRef.utility && ref.provider === sampleRef.provider ? "true" : undefined
                      }
                      className="border-border rounded-control aria-[current=true]:border-primary aria-[current=true]:bg-primary-subtle border px-2 py-1"
                    >
                      {t(`utility.${ref.utility}`)} · {t(`provider.${ref.provider}`)}
                    </a>
                  ))}
                </span>
              </div>
              <input type="hidden" name="sampleUtility" value={sampleRef.utility} />
              <input type="hidden" name="sampleProvider" value={sampleRef.provider} />
              <label className="flex flex-col gap-1 text-sm">
                {t("sample.units", { unit: unitShort(sampleRef.utility) })}
                <Input
                  name="units"
                  inputMode="decimal"
                  inputSize="sm"
                  defaultValue={units ?? ""}
                  className="w-32"
                  data-testid="sample-units"
                />
              </label>
              <Button type="submit" size="sm" variant="secondary">
                {t("sample.run")}
              </Button>
            </form>
            {sample ? (
              sample.data?.[0]?.charge ? (
                <div className="flex flex-col gap-2" data-testid="sample-result">
                  <SimpleTable
                    caption={t("sample.title")}
                    minWidth="28rem"
                    columns={[
                      { key: "label", header: t("sample.col.line") },
                      { key: "units", header: t("sample.col.units"), align: "end" },
                      { key: "price", header: t("sample.col.price"), align: "end" },
                      { key: "amount", header: t("sample.col.amount"), align: "end" },
                    ]}
                    rows={sample.data[0].charge.lines.map((line, index) => ({
                      key: `${line.label}-${index}`,
                      cells: {
                        label: line.label,
                        units: line.units ? formatDecimal(line.units, locale, 2) : "—",
                        price: line.pricePerUnit ? formatDecimal(line.pricePerUnit, locale, 4) : "—",
                        amount: formatTHB(line.amount, locale),
                      },
                    }))}
                  />
                  <p className="text-sm">
                    {t("sample.total")}:{" "}
                    <strong data-testid="sample-total">{formatTHB(sample.data[0].charge.totalExVat, locale)}</strong>
                    {sample.data[0].charge.effectiveAverageRate
                      ? ` · ${t("sample.average", { rate: formatDecimal(sample.data[0].charge.effectiveAverageRate, locale, 4), unit: unitShort(sampleRef.utility) })}`
                      : ""}
                  </p>
                </div>
              ) : (
                <SectionError error={sample.error} />
              )
            ) : null}
          </div>
        ) : null}
      </Card>

      {!plans.data ? (
        <SectionError error={plans.error} />
      ) : plans.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        PLAN_KINDS.filter((kind) => plans.data!.some((plan) => plan.kind === kind)).map((kind) => (
          <section
            key={kind}
            aria-labelledby={`rates-${kind}`}
            className="flex flex-col gap-3"
            data-testid={`rates-${kind}`}
          >
            <h2 id={`rates-${kind}`} className="text-lg font-semibold">
              {t(`kindName.${kind}`)}
            </h2>
            {plans
              .data!.filter((plan) => plan.kind === kind)
              .map((plan) => {
                const versions = [...plan.versions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
                const above = versions.some((version) => version.inForce && version.aboveCap);
                return (
                  <Card
                    key={plan.id}
                    as="article"
                    aria-labelledby={`plan-${plan.id}`}
                    data-testid="rate-plan"
                    data-plan={plan.name}
                  >
                    <CardHeader
                      title={
                        <span id={`plan-${plan.id}`} className="flex flex-wrap items-center gap-2">
                          {plan.name}
                          {plan.isDefault ? (
                            <Badge size="sm" tone="primary">
                              {t("default")}
                            </Badge>
                          ) : null}
                        </span>
                      }
                      description={buildingName(plan.buildingId)}
                      action={
                        manage ? (
                          <span className="flex flex-wrap gap-2">
                            <NewRateVersion plan={plan} capHint={capHintFor(plan.kind)} />
                            <EditRatePlan plan={plan} />
                            <DeleteRatePlan plan={plan} />
                          </span>
                        ) : undefined
                      }
                    />
                    {above ? (
                      <Callout tone="warning" className="mb-3" title={t("aboveCapTitle")}>
                        {t("aboveCapBody")}
                      </Callout>
                    ) : null}
                    {versions.length === 0 ? (
                      <p className="text-muted text-sm">{t("noVersions")}</p>
                    ) : (
                      <SimpleTable
                        caption={plan.name}
                        testId="rate-versions"
                        minWidth="48rem"
                        columns={[
                          { key: "from", header: t("col.from") },
                          { key: "prices", header: t("col.prices") },
                          { key: "cap", header: t("col.cap") },
                          { key: "state", header: t("col.state") },
                        ]}
                        rows={versions.map((version) => {
                          const check = version.capCheck as Record<string, string | boolean | null> | null;
                          return {
                            key: version.id,
                            testId: "rate-version",
                            data: { "in-force": version.inForce, "above-cap": version.aboveCap },
                            tone: version.aboveCap ? "warning" : "default",
                            cells: {
                              from: `${formatDate(version.effectiveFrom, locale)}${version.effectiveTo ? ` – ${formatDate(version.effectiveTo, locale)}` : ""}`,
                              prices: (
                                <span className="flex flex-col text-xs">
                                  {describeTiers(version.tiers).map((line) => (
                                    <span key={line.label}>
                                      {line.label === "flat"
                                        ? t("flat")
                                        : line.label === "fixed" || line.label === "budget"
                                          ? t("fixed")
                                          : line.label}
                                      : <span className="font-mono">{line.price}</span>
                                    </span>
                                  ))}
                                  {version.minimumCharge ? (
                                    <span>{t("minimum", { amount: formatTHB(version.minimumCharge, locale) })}</span>
                                  ) : null}
                                  <span className="text-muted">{t(`basisName.${version.basis}`)}</span>
                                </span>
                              ),
                              cap: check ? (
                                <span className="flex flex-col text-xs" data-testid="cap-check">
                                  <span>
                                    {t("capCompared", {
                                      tenant: String(check.tenantRate ?? "—"),
                                      utility: String(check.effectiveAverageRate ?? "—"),
                                      units: String(check.representativeUnits ?? "—"),
                                    })}
                                  </span>
                                  {version.aboveCap ? (
                                    <Badge size="sm" tone="warning">
                                      {version.complianceAcknowledgementId ? t("aboveCapAcknowledged") : t("aboveCap")}
                                    </Badge>
                                  ) : (
                                    <Badge size="sm" tone="success">
                                      {t("withinCap")}
                                    </Badge>
                                  )}
                                </span>
                              ) : (
                                "—"
                              ),
                              state: version.inForce ? (
                                <Badge size="sm" tone="success">
                                  {t("inForce")}
                                </Badge>
                              ) : new Date(version.effectiveFrom) > new Date() ? (
                                t("scheduled")
                              ) : (
                                t("past")
                              ),
                            },
                          };
                        })}
                      />
                    )}
                  </Card>
                );
              })}
          </section>
        ))
      )}
    </OwnerPage>
  );
}
