import { getTranslations } from "next-intl/server";
import Link from "next/link";
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
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Stepper } from "@/ui/components/Stepper";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { platformUserNames } from "../operations/auditLabels";
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
      ) : tariffs.data.length === 0 ? (
        <EmptyState
          variant="card"
          title={t("empty")}
          description={t("emptyBody")}
          action={
            <Button asChild variant="secondary">
              <Link href="/settings">{t("openSettings")}</Link>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="tariff-table"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "tariff", header: t("col.tariff"), phone: "title" },
            { key: "provider", header: t("col.provider"), phone: "meta" },
            { key: "ceiling", header: t("col.ceiling"), align: "end", phone: "figure" },
            { key: "since", header: t("col.since"), phone: "meta" },
            { key: "pending", header: t("col.pending"), phone: "status" },
          ]}
          rows={tariffs.data.map((tariff) => {
            const current = inForce(tariff);
            const pending = tariff.versions.filter((version) => PENDING.includes(version.state));
            return {
              key: tariff.id,
              href: `/tariffs/${tariff.id}`,
              testId: "tariff-row",
              data: { provider: tariff.provider, code: tariff.tariffCode },
              cells: {
                tariff: (
                  <span className="flex flex-col">
                    <span className="font-semibold">{tariff.nameTh}</span>
                    <span className="text-muted text-sm font-normal">
                      {t(`utility.${tariff.utility}`)} · {t("code", { code: tariff.tariffCode })}
                    </span>
                  </span>
                ),
                provider: providers(tariff.provider),
                ceiling: current ? (
                  <span className="whitespace-nowrap">
                    {t("perUnit", {
                      price: formatDecimal(current.ceilingPerUnit, locale, 4),
                      unit: t(`unitShort.${tariff.utility}`),
                    })}
                  </span>
                ) : (
                  "—"
                ),
                since: current ? (
                  <span className="whitespace-nowrap">{formatDate(current.effectiveFrom, locale)}</span>
                ) : (
                  <span className="text-muted">{t("nonePublished")}</span>
                ),
                pending: pending.length ? (
                  <span className="flex flex-wrap gap-1">
                    {pending.map((version) =>
                      version.state === "entered" ? (
                        <Badge key={version.id} size="sm" tone="warning" icon={IconWarning}>
                          {t("waitingChecker")}
                        </Badge>
                      ) : (
                        <StatusBadgeOf key={version.id} map={TARIFF_VERSION_STATUS} value={version.state} size="sm" />
                      ),
                    )}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
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

  const users = await platformUserNames(context);
  const who = (id: string | null) => (id ? (users.get(id) ?? t("anotherUser")) : "—");
  const maker = pending?.enteredBy === me.user.id;
  const review = pending ? (
    <ActionPanel
      title={t("review.title")}
      testId="tariff-review"
      status={<StatusBadgeOf map={TARIFF_VERSION_STATUS} value={pending.state} />}
      description={
        pending.nextActions.length > 0
          ? pending.state === "verified"
            ? t("review.publishHint")
            : t("review.verifyHint")
          : maker
            ? t("review.makerWaiting")
            : t("review.nothing")
      }
      facts={[
        { key: "version", label: t("review.version"), value: formatDate(pending.effectiveFrom, locale) },
        { key: "maker", label: t("review.maker"), value: who(pending.enteredBy) },
        ...(pending.verifiedBy ? [{ key: "checker", label: t("review.checker"), value: who(pending.verifiedBy) }] : []),
      ]}
      primary={pending.nextActions.length > 0 ? <VersionActions version={pending} label={label(pending)} /> : undefined}
      secondary={
        <div className="flex flex-col gap-2 [&>*]:w-full">
          <Button asChild variant="secondary" iconStart={IconExternal}>
            <a href={pending.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t("sourceLink")}
            </a>
          </Button>
          {pending.sourceDocumentId ? (
            <PlatformFileButton
              fileId={pending.sourceDocumentId}
              label={t("sourceDocumentLink")}
              testId={`source-document-${pending.id}`}
            />
          ) : null}
        </div>
      }
      footer={t("review.rule")}
    />
  ) : (
    <ActionPanel
      title={t("review.title")}
      testId="tariff-review"
      description={current ? t("inForce", { label: label(current) }) : t("nonePublished")}
      footer={t("review.rule")}
    />
  );

  return (
    <ConsolePage testId="tariff-detail">
      <PageHeader
        title={tariff.nameTh}
        testId="tariff-title"
        crumbs={[{ label: tariff.nameTh }]}
        description={`${t(`utility.${tariff.utility}`)} · ${providers(tariff.provider)} · ${t("code", { code: tariff.tariffCode })}`}
        status={
          current ? (
            <Badge tone="success" size="md">
              {t("inForceBadge", {
                price: formatDecimal(current.ceilingPerUnit, locale, 4),
                unit: unitShort,
              })}
            </Badge>
          ) : undefined
        }
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
      <DetailLayout panel={review}>
        <Card
          as="section"
          aria-labelledby="tariff-workflow"
          data-testid="tariff-workflow"
          data-state={pending?.state ?? "published"}
        >
          <CardHeader
            title={
              <span id="tariff-workflow">
                {pending
                  ? t("workflowPending", { label: formatDate(pending.effectiveFrom, locale) })
                  : t("workflowIdle")}
              </span>
            }
            description={
              pending ? t("workflowHint") : current ? t("inForce", { label: label(current) }) : t("nonePublished")
            }
          />
          <Stepper
            labelled
            label={t("workflowLabel")}
            progressText={t("stepOf", { step, total: steps.length })}
            current={step - 1}
            steps={steps.map((state) => ({ id: state, label: t(`step.${state}`) }))}
          />
          {pending?.needsCheck ? (
            <Callout tone="warning" className="mt-5" title={t("needsCheckTitle")}>
              {t("needsCheckBody")}
            </Callout>
          ) : null}
        </Card>

        <Card as="section" aria-labelledby="tariff-diff">
          <CardHeader
            title={<span id="tariff-diff">{t("diff")}</span>}
            description={a && b ? t("diffBetween", { from: label(a), to: label(b) }) : t("diffHint")}
          />
          {diff.length === 0 ? (
            <p className="text-muted text-sm" data-testid="diff-empty">
              {t("noDiff")}
            </p>
          ) : (
            <div className="border-border rounded-control relative overflow-x-auto border">
              <table className="w-full min-w-[32rem] text-base" data-testid="tariff-diff">
                <caption className="sr-only">{t("diff")}</caption>
                <thead>
                  <tr className="border-border text-muted border-b text-sm">
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      {t("col.path")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {a ? t("diffColumn", { label: t(`stateShort.${a.state}`) }) : "—"}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {b ? t("diffColumn", { label: t(`stateShort.${b.state}`) }) : "—"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((row) => (
                    <tr
                      key={row.path}
                      className="border-border border-b last:border-b-0"
                      data-testid="diff-row"
                      data-path={row.path}
                    >
                      <th scope="row" className="px-4 py-3 text-start align-top font-normal">
                        <span className="block">{pathLabel(row.path)}</span>
                      </th>
                      <td className="text-muted px-4 py-3 text-end align-top tabular-nums">{row.before ?? "—"}</td>
                      <td className="bg-primary-subtle text-primary-subtle-fg px-4 py-3 text-end align-top font-semibold tabular-nums">
                        {row.after ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details className="mt-4">
            <summary className="text-primary w-fit cursor-pointer text-sm font-medium">{t("diffOther")}</summary>
            <form method="get" className="mt-3 flex flex-wrap items-end gap-3" data-testid="diff-form">
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
          </details>
        </Card>

        <section aria-labelledby="tariff-versions" className="flex flex-col gap-3">
          <h2 id="tariff-versions" className="text-lg font-semibold">
            {t("versions")}
          </h2>
          <SimpleTable
            caption={t("versions")}
            testId="tariff-versions"
            stackOnPhones
            minWidth="42rem"
            columns={[
              { key: "effective", header: t("col.effective"), phone: "title" },
              { key: "ceiling", header: t("col.ceiling"), align: "end", phone: "figure" },
              { key: "maker", header: t("col.maker"), phone: "meta" },
              { key: "checker", header: t("col.checker"), phone: "meta" },
              { key: "state", header: t("col.state"), phone: "status" },
            ]}
            rows={versions.map((version) => ({
              key: version.id,
              testId: "tariff-version",
              data: { state: version.state, id: version.id },
              cells: {
                effective: (
                  <span className="flex flex-col">
                    <span className="whitespace-nowrap">
                      {formatDate(version.effectiveFrom, locale)}
                      {version.effectiveTo ? ` – ${formatDate(version.effectiveTo, locale)}` : ""}
                    </span>
                    <a
                      href={version.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary w-fit text-sm font-normal underline-offset-4 hover:underline"
                    >
                      {t("sourceLink")}
                    </a>
                  </span>
                ),
                ceiling: (
                  <span className="whitespace-nowrap">
                    {t("perUnit", { price: formatDecimal(version.ceilingPerUnit, locale, 4), unit: unitShort })}
                  </span>
                ),
                maker: <span className="md:whitespace-nowrap">{who(version.enteredBy)}</span>,
                checker: (
                  <span className="flex flex-col">
                    <span className="md:whitespace-nowrap">{who(version.verifiedBy)}</span>
                    {version.publishedAt ? (
                      <span className="text-muted text-sm">
                        {t("publishedAt", { date: formatDateTime(version.publishedAt, locale) })}
                      </span>
                    ) : null}
                  </span>
                ),
                state: (
                  <span className="flex flex-wrap items-center gap-1 *:whitespace-normal">
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
            <Button type="submit" size="sm" variant="secondary">
              {t("sampleRun")}
            </Button>
          </form>
          {sample ? (
            sample.data ? (
              <div className="grid gap-6 xl:grid-cols-2" data-testid="sample-result">
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
            <p className="text-muted text-sm">{t("sampleEmpty")}</p>
          )}
        </Card>
      </DetailLayout>
    </ConsolePage>
  );

  function pathLabel(path: string): string {
    const tier = /^tiers\[(\d+)\]\.(\w+)$/.exec(path);
    if (tier) {
      const field = `pathName.tier_${tier[2]}`;
      return t.has(field) ? t(field, { n: Number(tier[1]) + 1 }) : t("pathName.other");
    }
    const key = `pathName.${path.replaceAll(".", "_")}`;
    return t.has(key) ? t(key) : t("pathName.other");
  }
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
