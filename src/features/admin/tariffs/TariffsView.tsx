import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TARIFF_VERSION_STATUS } from "@/domain/status/tariffVersion";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatDecimal, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Stepper } from "@/ui/components/Stepper";

import { can, param, section, type AdminContext } from "../shared/server";
import { EnterVersion } from "./EnterVersion";
import { PlatformFileButton } from "../shared/PlatformFileButton";
import { sampleCharge } from "./server";
import { asStructure, diffStructures } from "./structure";
import { VersionActions } from "./VersionActions";

const PENDING: Schemas["TariffVersionState"][] = ["draft", "entered", "verified"];

function inForce(tariff: Schemas["UtilityTariffDto"]) {
  return tariff.versions.find((version) => version.state === "published") ?? null;
}

/**
 * Utility tariffs (F5 5.2, D-021a, D-140): each utility × provider × tariff code with the version in
 * force (its ceiling per unit, from), and versions waiting for the second check or for publishing.
 */
export async function TariffsView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.tariffs");
  const providers = await getTranslations("admin.tariffs.provider");
  const { api, locale } = context;
  const tariffs = await section(unwrap(api.GET("/v1/admin/utility-tariffs")));
  return (
    <ConsolePage testId="tariffs">
      <PageHeader title={t("title")} description={t("description")} />
      {!tariffs.data ? (
        <SectionError error={tariffs.error} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="tariff-table"
          minWidth="52rem"
          columns={[
            { key: "tariff", header: t("col.tariff") },
            { key: "provider", header: t("col.provider") },
            { key: "ceiling", header: t("col.ceiling"), align: "end" },
            { key: "since", header: t("col.since") },
            { key: "pending", header: t("col.pending") },
          ]}
          rows={tariffs.data.map((tariff) => {
            const current = inForce(tariff);
            const pending = tariff.versions.filter((version) => PENDING.includes(version.state));
            return {
              key: tariff.id,
              testId: "tariff-row",
              data: { provider: tariff.provider, code: tariff.tariffCode },
              cells: {
                tariff: (
                  <a href={`/tariffs/${tariff.id}`} className="flex flex-col hover:underline">
                    <span className="font-semibold">{tariff.nameTh}</span>
                    <span className="text-muted text-xs">
                      {t(`utility.${tariff.utility}`)} · {tariff.tariffCode}
                    </span>
                  </a>
                ),
                provider: providers(tariff.provider),
                ceiling: current
                  ? t("perUnit", {
                      price: formatDecimal(current.ceilingPerUnit, locale, 4),
                      unit: t(`unitShort.${tariff.utility}`),
                    })
                  : "—",
                since: current ? formatDate(current.effectiveFrom, locale) : t("nonePublished"),
                pending: pending.length ? (
                  <span className="flex flex-wrap gap-1">
                    {pending.map((version) => (
                      <StatusBadgeOf key={version.id} map={TARIFF_VERSION_STATUS} value={version.state} size="sm" />
                    ))}
                  </span>
                ) : (
                  "—"
                ),
              },
            };
          })}
        />
      )}
    </ConsolePage>
  );
}

/**
 * One utility tariff (F5 5.2): the workflow of the newest pending version as a stepper
 * (enter → verify by a second user → publish), every version with its state and who entered/verified
 * it, a diff between any two versions, and a sample bill at a chosen version — the API's own charge
 * of the consumption typed (`?units=`), compared with the version in force.
 */
export async function TariffDetail({
  context,
  tariffId,
  searchParams,
}: {
  context: AdminContext;
  tariffId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.tariffs");
  const providers = await getTranslations("admin.tariffs.provider");
  const { api, locale, me } = context;
  const tariffs = await unwrap(api.GET("/v1/admin/utility-tariffs"));
  const tariff = tariffs.find((candidate) => candidate.id === tariffId);
  if (!tariff) notFound();
  const versions = [...tariff.versions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const current = inForce(tariff);
  const pending = versions.find((version) => PENDING.includes(version.state)) ?? null;
  const label = (version: Schemas["TariffVersionDto"]) =>
    `${tariff.tariffCode} · ${formatDate(version.effectiveFrom, locale)}`;
  const steps = ["entered", "verified", "published"] as const;
  const step = pending ? (pending.state === "verified" ? 2 : 1) : 3;

  // Diff: `?a=&b=` (default: the version in force against the newest pending one).
  const a = versions.find((v) => v.id === param(searchParams.a)) ?? current ?? versions[1] ?? null;
  const b = versions.find((v) => v.id === param(searchParams.b)) ?? pending ?? versions[0] ?? null;
  const diff = a && b && a.id !== b.id ? diffStructures(a.structure, b.structure) : [];

  // Sample bill: `?units=&at=` (default: the pending version, compared with the one in force).
  const units = /^\d{1,6}(\.\d{1,3})?$/.test(param(searchParams.units) ?? "") ? param(searchParams.units)! : null;
  const sampled = versions.find((v) => v.id === param(searchParams.at)) ?? pending ?? current;
  const [sample, baseline] =
    units && sampled
      ? await Promise.all([
          section(sampleCharge(api, sampled.id, units)),
          current && current.id !== sampled.id ? section(sampleCharge(api, current.id, units)) : Promise.resolve(null),
        ])
      : [null, null];

  const unitShort = t(`unitShort.${tariff.utility}`);
  const select = (name: string, value: string | undefined) => (
    <NativeSelect
      name={name}
      defaultValue={value}
      inputSize="sm"
      data-testid={`select-${name}`}
      options={versions.map((version) => ({
        value: version.id,
        label: `${label(version)} · ${t(`stateShort.${version.state}`)}`,
      }))}
    />
  );

  return (
    <ConsolePage testId="tariff-detail">
      <PageHeader
        title={tariff.nameTh}
        testId="tariff-title"
        crumbs={[{ label: tariff.nameTh }]}
        description={`${t(`utility.${tariff.utility}`)} · ${providers(tariff.provider)} · ${tariff.tariffCode}`}
        actions={
          can(me, "admin.utility_tariff.enter") ? (
            <EnterVersion
              tariffId={tariff.id}
              name={tariff.nameTh}
              unit={tariff.utility === "electric" ? "kwh" : "m3"}
              current={current ? asStructure(current.structure) : null}
            />
          ) : null
        }
      />

      <Card
        as="section"
        aria-labelledby="tariff-workflow"
        data-testid="tariff-workflow"
        data-state={pending?.state ?? "published"}
      >
        <CardHeader
          title={
            <span id="tariff-workflow">
              {pending ? t("workflowPending", { label: label(pending) }) : t("workflowIdle")}
            </span>
          }
          description={
            pending ? t("workflowHint") : current ? t("inForce", { label: label(current) }) : t("nonePublished")
          }
          action={pending ? <VersionActions version={pending} label={label(pending)} /> : undefined}
        />
        <Stepper
          label={t("workflowLabel")}
          progressText={t("stepOf", { step, total: steps.length })}
          current={step - 1}
          steps={steps.map((state) => ({ id: state, label: t(`step.${state}`) }))}
        />
        {pending?.state === "entered" && pending.enteredBy === me.user.id ? (
          <Callout tone="info" className="mt-4" title={t("secondPersonTitle")}>
            {t("secondPersonBody")}
          </Callout>
        ) : null}
        {pending?.needsCheck ? (
          <Callout tone="warning" className="mt-4" title={t("needsCheckTitle")}>
            {t("needsCheckBody")}
          </Callout>
        ) : null}
      </Card>

      <section aria-labelledby="tariff-versions" className="flex flex-col gap-3">
        <h2 id="tariff-versions" className="text-lg font-semibold">
          {t("versions")}
        </h2>
        <SimpleTable
          caption={t("versions")}
          testId="tariff-versions"
          minWidth="56rem"
          columns={[
            { key: "effective", header: t("col.effective") },
            { key: "ceiling", header: t("col.ceiling"), align: "end" },
            { key: "source", header: t("col.source") },
            { key: "people", header: t("col.people") },
            { key: "state", header: t("col.state") },
          ]}
          rows={versions.map((version) => ({
            key: version.id,
            testId: "tariff-version",
            data: { state: version.state, id: version.id },
            cells: {
              effective: `${formatDate(version.effectiveFrom, locale)}${version.effectiveTo ? ` – ${formatDate(version.effectiveTo, locale)}` : ""}`,
              ceiling: t("perUnit", { price: formatDecimal(version.ceilingPerUnit, locale, 4), unit: unitShort }),
              source: (
                <span className="flex flex-col items-start gap-1">
                  <a
                    href={version.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary break-all underline-offset-4 hover:underline"
                  >
                    {t("sourceLink")}
                  </a>
                  {version.sourceDocumentId ? (
                    <PlatformFileButton
                      fileId={version.sourceDocumentId}
                      label={t("sourceDocumentLink")}
                      testId={`source-document-${version.id}`}
                    />
                  ) : null}
                </span>
              ),
              people: (
                <span className="text-xs">
                  {t("enteredBy", { id: version.enteredBy?.slice(0, 8) ?? "—" })}
                  <br />
                  {t("verifiedBy", { id: version.verifiedBy?.slice(0, 8) ?? "—" })}
                  {version.publishedAt ? (
                    <>
                      <br />
                      {t("publishedAt", { date: formatDateTime(version.publishedAt, locale) })}
                    </>
                  ) : null}
                </span>
              ),
              state: (
                <span className="flex flex-wrap items-center gap-1">
                  <StatusBadgeOf map={TARIFF_VERSION_STATUS} value={version.state} size="sm" />
                  {version.needsCheck ? (
                    <Badge size="sm" tone="warning">
                      {t("needsCheckBadge")}
                    </Badge>
                  ) : null}
                </span>
              ),
            },
          }))}
        />
      </section>

      <Card as="section" aria-labelledby="tariff-diff">
        <CardHeader title={<span id="tariff-diff">{t("diff")}</span>} description={t("diffHint")} />
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3" data-testid="diff-form">
          <label className="flex flex-col gap-1 text-sm">
            {t("diffFrom")}
            {select("a", a?.id)}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("diffTo")}
            {select("b", b?.id)}
          </label>
          {units ? <input type="hidden" name="units" value={units} /> : null}
          <Button type="submit" size="sm" variant="secondary">
            {t("compare")}
          </Button>
        </form>
        {diff.length === 0 ? (
          <p className="text-muted" data-testid="diff-empty">
            {t("noDiff")}
          </p>
        ) : (
          <SimpleTable
            caption={t("diff")}
            testId="tariff-diff"
            columns={[
              { key: "path", header: t("col.path") },
              { key: "before", header: a ? label(a) : "—", align: "end" },
              { key: "after", header: b ? label(b) : "—", align: "end" },
            ]}
            rows={diff.map((row) => ({
              key: row.path,
              testId: "diff-row",
              data: { path: row.path },
              cells: {
                path: <span className="font-mono text-xs">{row.path}</span>,
                before: <span className="font-mono">{row.before ?? "—"}</span>,
                after: <strong className="font-mono">{row.after ?? "—"}</strong>,
              },
            }))}
          />
        )}
      </Card>

      <Card as="section" aria-labelledby="tariff-sample">
        <CardHeader title={<span id="tariff-sample">{t("sample")}</span>} description={t("sampleHint")} />
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3" data-testid="sample-form">
          <label className="flex flex-col gap-1 text-sm">
            {t("sampleUnits", { unit: unitShort })}
            <Input
              name="units"
              inputMode="decimal"
              inputSize="sm"
              defaultValue={units ?? ""}
              className="w-32"
              data-testid="sample-units"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("sampleAt")}
            {select("at", sampled?.id)}
          </label>
          {a ? <input type="hidden" name="a" value={a.id} /> : null}
          {b ? <input type="hidden" name="b" value={b.id} /> : null}
          <Button type="submit" size="sm">
            {t("sampleRun")}
          </Button>
        </form>
        {sample ? (
          sample.data ? (
            <div className="grid gap-4 lg:grid-cols-2" data-testid="sample-result">
              <ChargeTable
                title={sampled ? label(sampled) : ""}
                charge={sample.data}
                locale={locale}
                unitShort={unitShort}
              />
              {baseline?.data ? (
                <ChargeTable
                  title={t("inForceShort", { label: current ? label(current) : "" })}
                  charge={baseline.data}
                  locale={locale}
                  unitShort={unitShort}
                />
              ) : baseline ? (
                <SectionError error={baseline.error} />
              ) : null}
            </div>
          ) : (
            <SectionError error={sample.error} />
          )
        ) : (
          <p className="text-muted">{t("sampleEmpty")}</p>
        )}
      </Card>
    </ConsolePage>
  );
}

async function ChargeTable({
  title,
  charge,
  locale,
  unitShort,
}: {
  title: string;
  charge: Schemas["TariffChargeDto"];
  locale: AdminContext["locale"];
  unitShort: string;
}) {
  const t = await getTranslations("admin.tariffs");
  return (
    <div className="flex flex-col gap-2" data-testid="charge">
      <h3 className="font-semibold">{title}</h3>
      <SimpleTable
        caption={title}
        minWidth="24rem"
        columns={[
          { key: "label", header: t("col.line") },
          { key: "units", header: t("col.units"), align: "end" },
          { key: "price", header: t("col.price"), align: "end" },
          { key: "amount", header: t("col.amount"), align: "end" },
        ]}
        rows={charge.lines.map((line, index) => ({
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
        {t("sampleTotal")}: <strong data-testid="charge-total">{formatTHB(charge.totalExVat, locale)}</strong>
        {charge.effectiveAverageRate
          ? ` · ${t("averageRate", { rate: formatDecimal(charge.effectiveAverageRate, locale, 4), unit: unitShort })}`
          : ""}
        {charge.minimumApplied ? ` · ${t("minimumApplied")}` : ""}
      </p>
    </div>
  );
}
