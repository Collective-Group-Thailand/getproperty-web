import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { IMPORT_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { bangkokToday } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { FilterLinks } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { StepTrack } from "@/ui/components/StepTrack";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconFileArchive } from "@/ui/icons/glyphs/file-archive";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconImport } from "@/ui/icons/glyphs/import";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconSpreadsheet } from "@/ui/icons/glyphs/spreadsheet";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { DocumentButton } from "../../shared/DocumentButton";
import { ownerPath, withQuery } from "../../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import {
  CancelImportButton,
  CommitButton,
  ExplainDifferenceButton,
  FullExportButton,
  GoLiveButton,
  ParallelCycleForm,
  ReconcileForm,
  RevalidateButton,
  RollbackButton,
  SheetUpload,
  StartImportButton,
} from "./ImportActions";
import {
  DifferencesTable,
  GoLiveChecklist,
  ReconcileBlock,
  RowIssuesTable,
  SummaryFacts,
  type SummaryFact,
} from "./pieces";
import {
  activeStep,
  differenceFilter,
  differenceView,
  fileOf,
  goLiveChecklist,
  importSettings,
  isClosed,
  missingSheets,
  nextBlock,
  OPTIONAL_SHEETS,
  REQUIRED_SHEETS,
  rowErrors,
  rowsSheet,
  STEPS,
  validationSheets,
  viewStep,
  wizardSteps,
  type StepKey,
} from "./wizard";

type SearchParams = Record<string, string | string[] | undefined>;
type Job = Schemas["JuristicImportJobDto"];
type Report = Schemas["JuristicParallelCycleReportDto"];
const OPEN_STATES: readonly Schemas["ImportState"][] = ["draft", "validated", "reconciled", "committed"];

/** The two J3.1 settings the wizard reads; unknown values read conservatively (`importSettings`). */
async function readImportSettings(context: OwnerContext) {
  const settings = await unwrap(context.api.GET("/v1/owner/settings", { params: { query: {} } })).catch(
    () => [] as Schemas["SettingDto"][],
  );
  const value = (key: string) => settings.find((setting) => setting.key === key)?.value;
  return importSettings({
    parallelRequired: value("juristic.import.parallel_cycle_required"),
    allowUnexplained: value("juristic.import.allow_unexplained_differences"),
  });
}

/**
 * `/juristic/import` (JW3a, D-332): the import jobs of the office's buildings — one per building — with the step each
 * stands at, the start of a new one (buildings with an open or committed job say so), and the full export.
 */
export async function ImportsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.imports.list");
  const track = await getTranslations("owner.imports.track");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const page = pageParam(searchParams.page);
  const [list, all] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/imports", {
          params: { query: { page, perPage: 25, ...(building ? { buildingId: building.id } : {}) } },
        }),
      ),
    ),
    unwrap(api.GET("/v1/owner/juristic/imports", { params: { query: { perPage: 100 } } }))
      .then((answer) => answer.data)
      .catch(() => [] as Job[]),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.import.manage");
  const canExport = !readOnly(me) && ownerCan(me, "juristic.export.run");
  const today = bangkokToday();
  const buildings = context.buildings.map((entry) => {
    const open = all.find((job) => job.buildingId === entry.id && OPEN_STATES.includes(job.state));
    return { id: entry.id, name: entry.name, openJob: open ? { id: open.id, number: open.number } : null };
  });
  const start = (variant: "primary" | "secondary") =>
    canManage ? (
      <StartImportButton buildings={buildings} defaultBuildingId={building?.id} today={today} variant={variant} />
    ) : undefined;
  const rows = list.data?.data ?? [];
  const base = ownerPath(locale, "/juristic/import");
  return (
    <OwnerPage testId="juristic-imports">
      <PageHeader title={t("title")} description={t("lede")} actions={start("primary")} />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconImport}
          title={building ? t("empty.buildingTitle", { building: building.name }) : t("empty.title")}
          description={t("empty.body")}
          action={start("secondary")}
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="import-jobs"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "job", header: t("col.job"), phone: "title" },
            { key: "asOf", header: t("col.asOf"), phone: "meta" },
            { key: "files", header: t("col.files"), phone: "meta" },
            { key: "step", header: t("col.step"), phone: "meta" },
            { key: "state", header: t("col.state"), phone: "status" },
          ]}
          rows={rows.map((job) => {
            const step = activeStep(job);
            const view = wizardSteps(job).find((entry) => entry.key === step)!;
            const files = job.files.filter((file) => file.sheet !== "legacy_bills");
            return {
              key: job.id,
              href: ownerPath(locale, `/juristic/import/${job.id}`),
              testId: "import-job",
              data: { state: job.state, building: job.buildingName },
              cells: {
                job: (
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      {t("jobName", { number: job.number, building: job.buildingName })}
                    </span>
                    <span className="text-muted line-clamp-1 text-sm">
                      {job.note ?? t("startedAt", { date: formatDate(job.createdAt, locale) })}
                    </span>
                  </span>
                ),
                asOf: <span className="whitespace-nowrap">{formatDate(job.asOfDate, locale)}</span>,
                files: (
                  <span className="text-sm whitespace-nowrap tabular-nums">
                    {t("filesRows", { files: files.length, rows: files.reduce((sum, file) => sum + file.rowCount, 0) })}
                  </span>
                ),
                step: isClosed(job) ? (
                  <span className="text-muted text-sm">
                    {t(`closed.${job.state}`, {
                      date: formatDate(job.liveAt ?? job.rolledBackAt ?? job.cancelledAt ?? job.createdAt, locale),
                    })}
                  </span>
                ) : (
                  <span className="flex flex-col">
                    <span className="text-sm">
                      {t("stepOf", {
                        index: STEPS.indexOf(step) + 1,
                        total: STEPS.length,
                        step: track(`step.${step}`),
                      })}
                    </span>
                    <span className="text-muted text-sm">{track(`line.${view.line.key}`, view.line.values ?? {})}</span>
                  </span>
                ),
                state: <StatusBadgeOf map={IMPORT_STATUS} value={job.state} size="sm" />,
              },
            };
          })}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
      {canExport ? (
        <Card
          as="section"
          aria-labelledby="full-export"
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          data-testid="full-export-card"
        >
          <div className="flex items-start gap-3">
            <span className="border-border text-subtle grid size-10 shrink-0 place-items-center rounded-full border">
              <Icon icon={IconFileArchive} size={20} />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 id="full-export" className="text-base font-semibold">
                {t("export.title")}
              </h2>
              <p className="text-muted m-0 text-sm">{t("export.body")}</p>
            </div>
          </div>
          <FullExportButton />
        </Card>
      ) : null}
    </OwnerPage>
  );
}

async function loadJob(context: OwnerContext, jobId: string): Promise<Job> {
  try {
    return await unwrap(
      context.api.GET("/v1/owner/juristic/imports/{importId}", { params: { path: { importId: jobId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

/** "312 แถว · 48 ห้อง": the sum of the counts the API gave, per file. */
function sheetLabel(t: Awaited<ReturnType<typeof getTranslations>>, sheet: Schemas["ImportSheet"]) {
  return t(`sheet.${sheet}.name`);
}

/**
 * `/juristic/import/[jobId]` (JW3a, Stitch `import-wizard-desktop`): the five-step track with a status line per step,
 * the step's work on the left, the sticky summary on the right (facts from the API's totals, what happens next, the
 * next action — disabled with its reason — download bad rows, the destructive action last).
 */
export async function ImportWizardView({
  context,
  jobId,
  searchParams,
}: {
  context: OwnerContext;
  jobId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.imports");
  const { api, locale, me } = context;
  const job = await loadJob(context, jobId);
  const active = activeStep(job);
  const step = viewStep(job, param(searchParams.step));
  const manage = !readOnly(me) && job.nextActions.length > 0;
  const can = (action: string) => !readOnly(me) && job.nextActions.includes(action);
  const afterCommit = ["committed", "live", "rolled_back"].includes(job.state);
  const building = context.buildings.find((entry) => entry.id === job.buildingId) ?? null;
  const [report, settings] = await Promise.all([
    afterCommit
      ? unwrap(
          api.GET("/v1/owner/juristic/imports/{importId}/parallel-cycle", { params: { path: { importId: job.id } } }),
        ).catch(() => null)
      : Promise.resolve(null),
    readImportSettings(context),
  ]);
  const steps = wizardSteps(job, report);
  const href = (key: StepKey) => ownerPath(locale, `/juristic/import/${job.id}${key === active ? "" : `?step=${key}`}`);
  const files = job.files.filter((file) => file.sheet !== "legacy_bills");
  const errors = rowErrors(job);
  const firstBad = validationSheets(job).find((sheet) => (fileOf(job, sheet)?.errorCount ?? 0) > 0) ?? null;
  const badRowsHref = (sheet: string) =>
    `/bff/v1/owner/juristic/imports/${job.id}/bad-rows?sheet=${sheet}&format=xlsx&language=${locale}`;
  const checklist = goLiveChecklist(job, report, settings);
  const block = nextBlock(job);
  const createdText = Object.entries(job.created)
    .filter(([, count]) => count > 0)
    .map(([entity, count]) =>
      t("created.item", { entity: t.has(`created.entity.${entity}`) ? t(`created.entity.${entity}`) : entity, count }),
    )
    .join(" · ");

  // ── the summary panel ────────────────────────────────────────────────────────────────────────────────────────
  const totals = job.totals;
  const facts: SummaryFact[] = totals
    ? [
        {
          key: "units",
          icon: IconBuilding,
          label: t("summary.units"),
          value: t("summary.unitsValue", { count: totals.units }),
        },
        {
          key: "owners",
          icon: IconResidents,
          label: t("summary.owners"),
          value: t("summary.ownersValue", { count: totals.parties }),
        },
        {
          key: "arrears",
          icon: IconBill,
          label: t("summary.arrears"),
          value: t("summary.arrearsValue", { count: totals.unitsInArrears }),
        },
        {
          key: "receivables",
          icon: IconWallet,
          label: t("summary.receivables"),
          value: formatTHB(totals.receivables, locale),
        },
        {
          key: "history",
          icon: IconHistory,
          label: t("summary.history"),
          value: t("summary.historyValue", { count: totals.historyCount }),
        },
      ]
    : [
        {
          key: "files",
          icon: IconSpreadsheet,
          label: t("summary.files"),
          value: t("summary.filesValue", { count: files.length, total: REQUIRED_SHEETS.length }),
        },
      ];
  const reasonLine = (key: string, values: Record<string, string | number> = {}) => (
    <StatusText tone="warning" icon={IconAlert} testId="import-next-reason">
      {t(`panel.reason.${key}`, values)}
    </StatusText>
  );
  const disabledNext = (label: string, reason: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <Button block disabled data-testid="import-next">
        {label}
      </Button>
      {reason}
    </div>
  );
  let primary: React.ReactNode = undefined;
  if (step !== active && !isClosed(job)) {
    primary = (
      <Button asChild block>
        <a href={href(active)} data-testid="import-to-current">
          {t("panel.toCurrent", { step: t(`track.step.${active}`) })}
        </a>
      </Button>
    );
  } else if (!isClosed(job) && manage) {
    switch (active) {
      case "upload":
        primary = disabledNext(
          t("panel.next.validate"),
          reasonLine("missing_sheets", { count: missingSheets(job).length }),
        );
        break;
      case "validate":
        primary =
          errors > 0 ? (
            disabledNext(t("panel.next.reconcile"), reasonLine("row_errors", { count: errors }))
          ) : (
            <RevalidateButton jobId={job.id} variant="primary" block />
          );
        break;
      case "reconcile":
        primary = disabledNext(t("panel.next.commit"), reasonLine(block?.reason ?? "reconcile_first"));
        break;
      case "commit":
        primary = can("commit") ? (
          <CommitButton job={job} needsConsent={(totals?.billTos ?? 0) > 0} building={job.buildingName} />
        ) : undefined;
        break;
      case "golive":
        primary = can("go_live") ? (
          <div className="flex flex-col gap-2">
            <GoLiveButton
              job={job}
              ready={checklist.ready}
              needsAcknowledgement={checklist.needsAcknowledgement}
              unexplained={report?.summary.unexplained ?? 0}
            />
            {!checklist.ready
              ? reasonLine(`golive_${checklist.checks.find((check) => check.state === "todo")!.key}`)
              : null}
          </div>
        ) : undefined;
        break;
    }
  }
  const secondary = (
    <>
      {firstBad && !isClosed(job) && !afterCommit ? (
        <Button asChild variant="secondary" iconStart={IconDownload} block>
          <a href={badRowsHref(firstBad)} download data-testid="bad-rows-download">
            {t("panel.badRows")}
          </a>
        </Button>
      ) : null}
      {active === "validate" && errors > 0 && can("validate") && step === active ? (
        <RevalidateButton jobId={job.id} block />
      ) : null}
    </>
  );
  const destructive = can("cancel") ? (
    <CancelImportButton job={job} />
  ) : can("rollback") ? (
    <RollbackButton job={job} created={createdText} />
  ) : undefined;
  const panelBody = isClosed(job)
    ? t(`panel.closed.${job.state}`, {
        date: formatDateTime(job.liveAt ?? job.rolledBackAt ?? job.cancelledAt ?? job.createdAt, locale),
      })
    : !manage
      ? t("panel.readOnly")
      : t(`panel.body.${active}`);

  // ── the step's work ──────────────────────────────────────────────────────────────────────────────────────────
  let content: React.ReactNode;
  if (step === "upload") content = await UploadStep({ job, canEdit: can("upload"), locale });
  else if (step === "validate")
    content = await ValidateStep({ context, job, searchParams, canValidate: can("validate") });
  else if (step === "reconcile") content = await ReconcileStep({ job, canReconcile: can("reconcile"), locale });
  else if (step === "commit") content = await CommitStep({ context, job, createdText });
  else content = await GoLiveStep({ context, job, report, building, searchParams, checklist, settings, createdText });

  return (
    <OwnerPage testId="juristic-import">
      <PageHeader
        title={t("wizard.title")}
        status={<StatusBadgeOf map={IMPORT_STATUS} value={job.state} />}
        description={t("wizard.lede", { building: job.buildingName, date: formatDate(job.asOfDate, locale) })}
        back={{ label: t("wizard.back"), href: ownerPath(locale, "/juristic/import") }}
        actions={
          <span
            className="border-border bg-surface rounded-control text-muted inline-flex h-10 items-center gap-2 border px-3 text-sm whitespace-nowrap"
            data-testid="import-dataset"
          >
            <Icon icon={IconSpreadsheet} size={16} className="text-subtle" />
            {t("wizard.dataset", { number: job.number, files: files.length })}
          </span>
        }
      />
      <StepTrack
        label={t("track.label")}
        selected={step}
        steps={steps.map((view) => ({
          key: view.key,
          label: t(`track.step.${view.key}`),
          line: t(`track.line.${view.line.key}`, view.line.values ?? {}),
          lineTone: view.line.tone,
          status: view.status,
          href: view.status === "done" && !(job.state === "live" && view.key === "golive") ? href(view.key) : undefined,
        }))}
      />
      <DetailLayout
        panelFirstOnPhones={false}
        panel={
          <ActionPanel
            testId="import-panel"
            summary={<SummaryFacts title={t("summary.title")} facts={facts} />}
            title={isClosed(job) ? t(`panel.closedTitle.${job.state}`) : t(`panel.title.${active}`)}
            description={
              <div className="flex flex-col gap-3">
                <p className="m-0">{panelBody}</p>
                {!isClosed(job) && !afterCommit ? (
                  <p
                    className="bg-info-subtle text-info-subtle-fg rounded-control m-0 flex items-start gap-2 p-3 text-sm"
                    data-testid="import-reversible"
                  >
                    <Icon icon={IconInfo} size={16} className="mt-0.5 shrink-0" />
                    <span>{t("panel.reversible")}</span>
                  </p>
                ) : job.state === "committed" ? (
                  <div data-testid="import-pending">
                    <Callout tone="warning" size="sm">
                      {t("panel.pending", { building: job.buildingName })}
                    </Callout>
                  </div>
                ) : null}
              </div>
            }
            primary={primary}
            secondary={secondary}
            destructive={destructive}
          />
        }
      >
        {content}
      </DetailLayout>
    </OwnerPage>
  );
}

// ── step 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function UploadStep({ job, canEdit, locale }: { job: Job; canEdit: boolean; locale: Locale }) {
  const t = await getTranslations("owner.imports");
  const template = (sheet: string, format: "xlsx" | "csv") =>
    `/bff/v1/owner/juristic/imports/templates/${sheet}?format=${format}&language=${locale}`;
  const sheetRow = (sheet: Schemas["ImportUploadSheet"], required: boolean) => {
    const file = fileOf(job, sheet) ?? null;
    return (
      <li
        key={sheet}
        className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0"
        data-testid="sheet-row"
        data-sheet={sheet}
      >
        <div className="flex flex-col gap-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
              {sheetLabel(t, sheet)}
              <Badge tone={required ? "primary" : "neutral"} size="sm">
                {required ? t("upload.required") : t("upload.optional")}
              </Badge>
            </h3>
            <p className="text-muted m-0 text-sm">{t(`sheet.${sheet}.body`)}</p>
          </div>
          <span className="-ms-1.5 flex items-center gap-1 text-sm" data-testid="sheet-templates">
            <span className="text-muted ms-1.5 me-1">{t("upload.template")}</span>
            <a
              className="text-primary inline-flex h-9 items-center gap-1 px-1.5 font-medium underline-offset-4 hover:underline"
              href={template(sheet, "xlsx")}
              download
              data-testid="template-xlsx"
            >
              <Icon icon={IconDownload} size={14} />
              {t("upload.excel")}
            </a>
            <a
              className="text-primary inline-flex h-9 items-center gap-1 px-1.5 font-medium underline-offset-4 hover:underline"
              href={template(sheet, "csv")}
              download
              data-testid="template-csv"
            >
              {t("upload.csv")}
            </a>
          </span>
        </div>
        <SheetUpload
          jobId={job.id}
          buildingId={job.buildingId}
          sheet={sheet}
          file={file}
          canEdit={canEdit}
          label={sheetLabel(t, sheet)}
        />
      </li>
    );
  };
  return (
    <>
      <Card as="section" aria-labelledby="import-files" className="flex flex-col gap-5" data-testid="upload-step">
        <CardHeader
          title={<span id="import-files">{t("upload.title")}</span>}
          description={t("upload.lede", { date: formatDate(job.asOfDate, locale) })}
        />
        <ol className="divide-border m-0 flex list-none flex-col divide-y p-0">
          {REQUIRED_SHEETS.map((sheet) => sheetRow(sheet, true))}
          {OPTIONAL_SHEETS.map((sheet) => sheetRow(sheet, false))}
        </ol>
      </Card>
      <Callout tone="neutral" title={t("upload.privacyTitle")}>
        {t("upload.privacy")}
      </Callout>
    </>
  );
}

// ── step 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function ValidateStep({
  context,
  job,
  searchParams,
  canValidate,
}: {
  context: OwnerContext;
  job: Job;
  searchParams: SearchParams;
  canValidate: boolean;
}) {
  const t = await getTranslations("owner.imports");
  const { api, locale } = context;
  const sheet = rowsSheet(job, param(searchParams.sheet));
  const errorsOnly = param(searchParams.all) !== "1";
  const page = pageParam(searchParams.page);
  const rows = sheet
    ? await section(
        unwrap(
          api.GET("/v1/owner/juristic/imports/{importId}/rows", {
            params: { path: { importId: job.id }, query: { sheet, errorsOnly, page, perPage: 25, language: locale } },
          }),
        ),
      )
    : null;
  const totals = job.totals;
  const base = ownerPath(locale, `/juristic/import/${job.id}`);
  const errors = rowErrors(job);
  const figures = totals
    ? [
        {
          key: "rows",
          label: t("validate.rows"),
          value: formatNumber(
            job.files.filter((f) => f.sheet !== "legacy_bills").reduce((s, f) => s + f.rowCount, 0),
            locale,
          ),
        },
        {
          key: "errors",
          label: t("validate.errors"),
          value: formatNumber(totals.errors, locale),
          attention: totals.errors > 0,
        },
        { key: "warnings", label: t("validate.warnings"), value: formatNumber(totals.warnings, locale) },
        { key: "units", label: t("validate.units"), value: formatNumber(totals.units, locale) },
      ]
    : [];
  return (
    <>
      {figures.length ? (
        <dl
          className="border-border bg-surface rounded-card shadow-card divide-border m-0 grid grid-cols-2 divide-x border sm:grid-cols-4"
          data-testid="validate-figures"
        >
          {figures.map((figure) => (
            <div
              key={figure.key}
              className={figure.attention ? "bg-primary-subtle text-primary-subtle-fg px-5 py-4" : "px-5 py-4"}
            >
              <dt className={figure.attention ? "text-sm" : "text-muted text-sm"}>{figure.label}</dt>
              <dd className="m-0 text-2xl font-semibold tabular-nums">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {errors === 0 && totals ? (
        <Callout tone="success" title={t("validate.passedTitle")} icon={IconCheckCircle}>
          {t("validate.passed", { units: totals.units, warnings: totals.warnings })}
        </Callout>
      ) : null}
      <Card
        as="section"
        aria-labelledby="import-rows-title"
        className="flex flex-col gap-4 overflow-hidden"
        padding="none"
        data-testid="validate-step"
      >
        <div className="flex flex-col gap-4 px-5 pt-5 md:px-6 md:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="import-rows-title" className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                {t("validate.title")}
                {errors > 0 ? (
                  <Badge tone="danger" size="md" icon={IconAlert}>
                    {t("validate.count", { count: errors })}
                  </Badge>
                ) : null}
              </h2>
              <p className="text-muted m-0 text-sm">{t("validate.lede")}</p>
            </div>
            {canValidate ? <RevalidateButton jobId={job.id} /> : null}
          </div>
          {sheet ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav aria-label={t("validate.sheets")} className="relative -mx-1 min-w-0 overflow-x-auto px-1">
                <ul className="flex w-max items-center gap-1" data-testid="sheet-tabs">
                  {validationSheets(job).map((entry) => {
                    const file = fileOf(job, entry)!;
                    const current = entry === sheet;
                    return (
                      <li key={entry}>
                        <a
                          href={withQuery(base, { step: "validate", sheet: entry, all: errorsOnly ? undefined : "1" })}
                          aria-current={current ? "page" : undefined}
                          data-testid={`sheet-tab-${entry}`}
                          className={
                            current
                              ? "border-primary text-fg flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap"
                              : "text-muted hover:text-fg flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap"
                          }
                        >
                          {t(`sheet.${entry}.name`)}
                          {file.errorCount ? (
                            <Badge tone="danger" size="sm">
                              {formatNumber(file.errorCount, locale)}
                            </Badge>
                          ) : (
                            <span className="text-muted text-xs">{t("validate.ok")}</span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="flex flex-wrap items-center gap-2">
                <FilterLinks
                  label={t("validate.show")}
                  current={errorsOnly ? "errors" : "all"}
                  links={[
                    {
                      key: "errors",
                      href: withQuery(base, { step: "validate", sheet }),
                      label: t("validate.errorsOnly"),
                      testId: "rows-errors-only",
                    },
                    {
                      key: "all",
                      href: withQuery(base, { step: "validate", sheet, all: "1" }),
                      label: t("validate.allRows"),
                      testId: "rows-all",
                    },
                  ]}
                />
                {(fileOf(job, sheet)?.errorCount ?? 0) > 0 ? (
                  <Button asChild variant="secondary" size="sm" iconStart={IconDownload}>
                    <a
                      href={`/bff/v1/owner/juristic/imports/${job.id}/bad-rows?sheet=${sheet}&format=xlsx&language=${locale}`}
                      download
                      data-testid="sheet-bad-rows"
                    >
                      {t("validate.badRows")}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        {!sheet ? (
          <EmptyState
            icon={IconSpreadsheet}
            title={t("validate.noFiles")}
            description={t("validate.noFilesBody")}
            action={
              <Button asChild variant="secondary">
                <a href={withQuery(base, { step: "upload" })}>{t("validate.toUpload")}</a>
              </Button>
            }
          />
        ) : !rows?.data ? (
          <div className="px-5 pb-5">
            <SectionError error={rows?.error} />
          </div>
        ) : rows.data.data.length === 0 ? (
          <EmptyState
            icon={IconCheckCircle}
            title={
              errorsOnly ? t("validate.sheetClean", { sheet: t(`sheet.${sheet}.name`) }) : t("validate.sheetEmpty")
            }
            description={errorsOnly ? t("validate.sheetCleanBody") : t("validate.sheetEmptyBody")}
            action={
              errorsOnly ? (
                <Button asChild variant="secondary">
                  <a href={withQuery(base, { step: "validate", sheet, all: "1" })}>{t("validate.allRows")}</a>
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <a href={withQuery(base, { step: "upload" })}>{t("validate.toUpload")}</a>
                </Button>
              )
            }
          />
        ) : (
          <RowIssuesTable sheet={sheet} rows={rows.data.data} locale={locale} />
        )}
        {rows?.data && rows.data.meta.total > rows.data.meta.perPage ? (
          <div className="px-5 pb-5">
            <ListPagination meta={rows.data.meta} path={base} searchParams={searchParams} locale={locale} />
          </div>
        ) : null}
        {errors > 0 ? (
          <p
            className="border-border bg-bg-subtle text-muted m-0 flex items-start gap-2 border-t px-5 py-3 text-sm md:px-6"
            data-testid="fix-in-file"
          >
            <Icon icon={IconInfo} size={16} className="mt-0.5 shrink-0" />
            <span>
              {t("validate.fixInFile")}{" "}
              <a
                className="text-primary font-medium underline-offset-4 hover:underline"
                href={withQuery(base, { step: "upload" })}
              >
                {t("validate.toUpload")}
              </a>
            </span>
          </p>
        ) : null}
      </Card>
    </>
  );
}

// ── step 3 ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function ReconcileStep({ job, canReconcile, locale }: { job: Job; canReconcile: boolean; locale: Locale }) {
  const t = await getTranslations("owner.imports.reconcile");
  const rec = job.reconciliation;
  return (
    <Card as="section" aria-labelledby="reconcile-title" className="flex flex-col gap-6" data-testid="reconcile-step">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="reconcile-title" className="flex items-center gap-2 text-xl font-semibold">
            <Icon icon={IconWallet} size={22} className="text-primary" />
            {t("title")}
          </h2>
          <p className="text-muted m-0 max-w-2xl text-sm">{t("lede")}</p>
        </div>
        <span
          className="border-border bg-bg-subtle rounded-control inline-flex h-9 items-center px-3 text-sm whitespace-nowrap"
          data-testid="reconcile-cutoff"
        >
          {t("cutoff", { date: formatDate(job.asOfDate, locale) })}
        </span>
      </div>
      {rec ? (
        <div className="divide-border flex flex-col divide-y">
          {rec.items.map((item) => (
            <div key={item.key} className="py-6 first:pt-0">
              <ReconcileBlock item={item} locale={locale} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-bg-subtle rounded-card flex flex-col gap-1 px-5 py-4" data-testid="reconcile-not-run">
          <span className="text-muted text-sm">{t("fromFile")}</span>
          <span className="text-xl font-semibold tabular-nums">
            {job.totals ? formatTHB(job.totals.receivables, locale) : "—"}
          </span>
          <span className="text-muted text-sm">{t("notRun")}</span>
        </div>
      )}
      {rec?.explanationRequired && rec.note && rec.documentId ? (
        <div className="border-border rounded-card flex flex-col gap-2 border p-4" data-testid="reconcile-explained">
          <StatusText tone="success" icon={IconCheckCircle}>
            {t("explainedTitle", { date: formatDateTime(rec.reconciledAt, locale) })}
          </StatusText>
          <p className="m-0 whitespace-pre-line">{rec.note}</p>
          <div>
            <DocumentButton
              document={{ kind: "file", id: rec.documentId }}
              label={t("openAttachment")}
              title={t("attachmentTitle")}
            />
          </div>
        </div>
      ) : null}
      <ReconcileForm jobId={job.id} buildingId={job.buildingId} reconciliation={rec} readOnly={!canReconcile} />
    </Card>
  );
}

// ── step 4 ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function CommitStep({ context, job, createdText }: { context: OwnerContext; job: Job; createdText: string }) {
  const t = await getTranslations("owner.imports.commitStep");
  const { api, locale } = context;
  const committed = !!job.committedAt;
  const preview =
    !committed && ["validated", "reconciled"].includes(job.state)
      ? await unwrap(
          api.GET("/v1/owner/juristic/imports/{importId}/preview", { params: { path: { importId: job.id } } }),
        ).catch(() => null)
      : null;
  const totals = preview?.totals ?? job.totals;
  const money = (value: string) => formatTHB(value, locale);
  if (!totals)
    return (
      <EmptyState
        variant="card"
        icon={IconSpreadsheet}
        title={t("emptyTotals")}
        description={t("emptyTotalsBody")}
        action={
          <Button asChild variant="secondary">
            <a href={ownerPath(locale, `/juristic/import/${job.id}?step=validate`)}>{t("toValidate")}</a>
          </Button>
        }
      />
    );
  const groups: { key: string; title: string; rows: { key: string; label: string; value: string; note?: string }[] }[] =
    [
      {
        key: "register",
        title: t("register"),
        rows: [
          { key: "floors", label: t("floors"), value: formatNumber(totals.floorsNew, locale) },
          {
            key: "units",
            label: t("units"),
            value: t("newAttached", { created: totals.unitsNew, attached: totals.unitsAttached }),
          },
          {
            key: "parties",
            label: t("parties"),
            value: t("newAttached", { created: totals.partiesNew, attached: totals.partiesAttached }),
            note: t("partiesNote"),
          },
          {
            key: "ownerships",
            label: t("ownerships"),
            value: formatNumber(totals.ownerships, locale),
            ...(totals.unitsIncomplete ? { note: t("incomplete", { count: totals.unitsIncomplete }) } : {}),
          },
          ...(totals.billTos
            ? [
                {
                  key: "billTos",
                  label: t("billTos"),
                  value: formatNumber(totals.billTos, locale),
                  note: t("billTosNote"),
                },
              ]
            : []),
        ],
      },
      {
        key: "money",
        title: t("money"),
        rows: [
          {
            key: "invoices",
            label: t("openingInvoices"),
            value: formatNumber(totals.openingInvoices, locale),
            note: t("openingNote"),
          },
          { key: "principal", label: t("principal"), value: money(totals.principal) },
          { key: "surcharge", label: t("surcharge"), value: money(totals.surcharge) },
          { key: "receivables", label: t("receivables"), value: money(totals.receivables) },
          {
            key: "history",
            label: t("history"),
            value: t("historyValue", { count: totals.historyCount, amount: money(totals.historyAmount) }),
            note: t("historyNote"),
          },
          { key: "bankOperating", label: t("bankOperating"), value: money(totals.bankOperating) },
          { key: "bankFund", label: t("bankFund"), value: money(totals.bankFund), note: t("bankNote") },
        ],
      },
    ];
  return (
    <>
      {committed ? (
        <Callout
          tone="success"
          title={t("committedTitle", { date: formatDateTime(job.committedAt!, locale) })}
          icon={IconCheckCircle}
        >
          <span data-testid="commit-created">{createdText || t("nothingCreated")}</span>
        </Callout>
      ) : null}
      <Card as="section" aria-labelledby="commit-what" className="flex flex-col gap-5" data-testid="commit-step">
        <CardHeader
          title={<span id="commit-what">{committed ? t("createdTitle") : t("title")}</span>}
          description={t("lede")}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.title} className="flex flex-col gap-2">
              <h3 className="text-muted text-sm font-semibold">{group.title}</h3>
              <dl className="divide-border m-0 flex flex-col divide-y">
                {group.rows.map((row) => (
                  <div key={row.key} className="flex flex-col gap-0.5 py-2.5" data-testid={`commit-${row.key}`}>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm">{row.label}</dt>
                      <dd className="m-0 text-end font-semibold tabular-nums">{row.value}</dd>
                    </div>
                    {row.note ? <p className="text-muted m-0 text-sm">{row.note}</p> : null}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </Card>
      {!committed ? (
        <Card as="section" aria-labelledby="commit-before" className="flex flex-col gap-3" data-testid="commit-before">
          <CardHeader title={<span id="commit-before">{t("beforeTitle")}</span>} />
          <ol className="m-0 flex list-decimal flex-col gap-2 ps-5">
            <li>{t("before1")}</li>
            <li>{t("before2", { building: job.buildingName })}</li>
            <li>{t("before3")}</li>
          </ol>
        </Card>
      ) : null}
      {preview && preview.openingBalances.length ? (
        <Card
          as="section"
          aria-labelledby="commit-openings"
          className="flex flex-col gap-3"
          data-testid="commit-openings"
        >
          <CardHeader
            title={<span id="commit-openings">{t("openingsTitle")}</span>}
            description={t("openingsLede", { count: preview.openingBalances.length })}
          />
          <SimpleTable
            caption={t("openingsTitle")}
            stackOnPhones
            minWidth="44rem"
            columns={[
              { key: "unit", header: t("col.unit"), phone: "title" },
              { key: "billed", header: t("col.billed"), phone: "meta" },
              { key: "period", header: t("col.period"), phone: "meta" },
              { key: "total", header: t("col.total"), align: "end", phone: "figure" },
            ]}
            rows={preview.openingBalances.slice(0, 50).map((row) => ({
              key: `${row.unitNo}-${row.billedName}`,
              testId: "opening-row",
              cells: {
                unit: <span className="font-mono text-sm">{row.unitNo}</span>,
                billed: (
                  <span className="flex flex-col">
                    <span>{row.billedName}</span>
                    {row.billedName !== row.ownerName ? (
                      <span className="text-muted text-sm">{t("onBehalf", { owner: row.ownerName })}</span>
                    ) : null}
                  </span>
                ),
                period: (
                  <span className="text-sm whitespace-nowrap">
                    {t("period", {
                      from: formatDate(row.periodStart, locale),
                      to: formatDate(row.periodEnd, locale),
                      lines: row.lines,
                    })}
                  </span>
                ),
                total: <span className="font-medium tabular-nums">{money(row.total)}</span>,
              },
            }))}
          />
          {preview.openingBalances.length > 50 || preview.truncated ? (
            <p className="text-muted m-0 text-sm">{t("openingsMore")}</p>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

// ── step 5 ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function GoLiveStep({
  context,
  job,
  report,
  building,
  searchParams,
  checklist,
  settings,
  createdText,
}: {
  context: OwnerContext;
  job: Job;
  report: Report | null;
  building: Schemas["BuildingDto"] | null;
  searchParams: SearchParams;
  checklist: ReturnType<typeof goLiveChecklist>;
  settings: ReturnType<typeof importSettings>;
  createdText: string;
}) {
  const t = await getTranslations("owner.imports.goliveStep");
  const status = await getTranslations("status.billingCycle");
  const { api, locale } = context;
  if (job.state === "live")
    return (
      <Card as="section" className="flex flex-col gap-4" data-testid="golive-done">
        <StatusText tone="success" icon={IconCheckCircle} size="md">
          {t("liveTitle", { date: formatDateTime(job.liveAt!, locale) })}
        </StatusText>
        <p className="m-0">{t("liveBody", { building: job.buildingName })}</p>
        {createdText ? <p className="text-muted m-0 text-sm">{createdText}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={ownerPath(locale, "/juristic/receivables")}>{t("toReceivables")}</a>
          </Button>
          <Button asChild variant="secondary">
            <a href={ownerPath(locale, "/juristic/register")}>{t("toRegister")}</a>
          </Button>
        </div>
      </Card>
    );
  if (job.state === "rolled_back")
    return (
      <Callout tone="neutral" title={t("rolledBackTitle", { date: formatDateTime(job.rolledBackAt!, locale) })}>
        <p data-testid="rollback-reason-shown">{job.rollbackReason}</p>
        <p className="text-muted mt-1 text-sm">{t("rolledBackBody")}</p>
      </Callout>
    );
  if (job.state === "cancelled")
    return (
      <Callout tone="neutral" title={t("cancelledTitle")}>
        {t("cancelledBody")}
      </Callout>
    );
  const committed = job.state === "committed";
  const canCompare = committed && job.nextActions.includes("parallel_cycle");
  const cycles = building
    ? await unwrap(
        api.GET("/v1/owner/billing-cycles", { params: { query: { propertyId: building.propertyId, perPage: 24 } } }),
      )
        .then((answer) => answer.data)
        .catch(() => [] as Schemas["BillingCycleDto"][])
    : [];
  const diffs = report?.differences ?? [];
  const counts = differenceView(diffs, "all").counts;
  const filter = differenceFilter(param(searchParams.diff), counts);
  const shown = differenceView(diffs, filter);
  const base = ownerPath(locale, `/juristic/import/${job.id}`);
  const money = (value: string) => formatTHB(value, locale);
  return (
    <>
      <Card as="section" aria-labelledby="parallel" className="flex flex-col gap-5" data-testid="parallel-step">
        <CardHeader
          title={<span id="parallel">{t("parallelTitle")}</span>}
          description={settings.parallelRequired ? t("parallelLede") : t("parallelOptional")}
        />
        {report?.runAt ? (
          <dl
            className="border-border divide-border rounded-card m-0 grid grid-cols-2 divide-x divide-y border sm:grid-cols-4 sm:divide-y-0"
            data-testid="parallel-summary"
          >
            {[
              { key: "units", label: t("summary.units"), value: formatNumber(report.summary.units, locale) },
              { key: "matching", label: t("summary.matching"), value: formatNumber(report.summary.matching, locale) },
              {
                key: "different",
                label: t("summary.different"),
                value: formatNumber(report.summary.different, locale),
              },
              {
                key: "unexplained",
                label: t("summary.unexplained"),
                value: formatNumber(report.summary.unexplained, locale),
                attention: report.summary.unexplained > 0,
              },
            ].map((figure) => (
              <div
                key={figure.key}
                className={figure.attention ? "bg-primary-subtle text-primary-subtle-fg px-4 py-3" : "px-4 py-3"}
              >
                <dt className={figure.attention ? "text-sm" : "text-muted text-sm"}>{figure.label}</dt>
                <dd className="m-0 text-xl font-semibold tabular-nums">{figure.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {report?.runAt ? (
          <p className="text-muted m-0 text-sm" data-testid="parallel-run">
            {t("ranAt", {
              date: formatDateTime(report.runAt, locale),
              period: report.periodKey ? formatPeriodKey(report.periodKey, locale) : "—",
              computed: money(report.summary.computedTotal),
              legacy: money(report.summary.legacyTotal),
            })}
          </p>
        ) : null}
        {canCompare ? (
          report?.runAt ? (
            <details className="border-border rounded-card border px-4 py-3" data-testid="parallel-again">
              <summary className="text-primary cursor-pointer text-sm font-medium">{t("compareAgain")}</summary>
              <div className="mt-4">
                <ParallelCycleForm
                  jobId={job.id}
                  buildingId={job.buildingId}
                  propertyId={building?.propertyId ?? null}
                  cycles={cycles.map((cycle) => ({
                    id: cycle.id,
                    status: cycle.status,
                    label: formatPeriodKey(cycle.periodKey, locale),
                  }))}
                  defaultCycleId={report.billingCycleId}
                  hasReport
                  periodLabels={Object.fromEntries(["open", "computed"].map((key) => [key, status(key)]))}
                />
              </div>
            </details>
          ) : (
            <ParallelCycleForm
              jobId={job.id}
              buildingId={job.buildingId}
              propertyId={building?.propertyId ?? null}
              cycles={cycles.map((cycle) => ({
                id: cycle.id,
                status: cycle.status,
                label: formatPeriodKey(cycle.periodKey, locale),
              }))}
              defaultCycleId={null}
              hasReport={false}
              periodLabels={Object.fromEntries(["open", "computed"].map((key) => [key, status(key)]))}
            />
          )
        ) : null}
        <p className="text-muted m-0 flex items-start gap-2 text-sm">
          <Icon icon={IconInfo} size={16} className="mt-0.5 shrink-0" />
          <span>
            {t("legacyTemplate")}{" "}
            <a
              className="text-primary font-medium underline-offset-4 hover:underline"
              href={`/bff/v1/owner/juristic/imports/templates/legacy_bills?format=xlsx&language=${locale}`}
              download
            >
              {t("excel")}
            </a>{" "}
            ·{" "}
            <a
              className="text-primary font-medium underline-offset-4 hover:underline"
              href={`/bff/v1/owner/juristic/imports/templates/legacy_bills?format=csv&language=${locale}`}
              download
            >
              {t("csv")}
            </a>
          </span>
        </p>
      </Card>
      {report?.runAt ? (
        <Card
          as="section"
          aria-labelledby="differences"
          padding="none"
          className="flex flex-col gap-4 overflow-hidden"
          data-testid="differences-step"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 md:px-6 md:pt-6">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="differences" className="text-xl font-semibold">
                {t("differencesTitle")}
              </h2>
              <p className="text-muted m-0 text-sm">{t("differencesLede")}</p>
            </div>
            <FilterLinks
              label={t("filter")}
              current={filter}
              links={(["unexplained", "different", "all"] as const).map((key) => ({
                key,
                href: withQuery(base, { step: "golive", diff: key }) + "#differences",
                label: t(`filters.${key}`, { count: counts[key] }),
                testId: `diff-filter-${key}`,
              }))}
            />
          </div>
          {shown.rows.length === 0 ? (
            <EmptyState
              icon={IconCheckCircle}
              title={t(`empty.${filter}`)}
              description={t("emptyBody")}
              action={
                <Button asChild variant="secondary">
                  <a
                    href={
                      filter === "all" ? "#parallel" : withQuery(base, { step: "golive", diff: "all" }) + "#differences"
                    }
                  >
                    {filter === "all" ? t("toParallel") : t("showAll")}
                  </a>
                </Button>
              }
            />
          ) : (
            <DifferencesTable
              rows={shown.rows}
              locale={locale}
              action={canCompare ? (row) => <ExplainDifferenceButton jobId={job.id} row={row} /> : undefined}
            />
          )}
        </Card>
      ) : null}
      <Card as="section" aria-labelledby="golive-checks" className="flex flex-col gap-4" data-testid="golive-step">
        <CardHeader title={<span id="golive-checks">{t("checklistTitle")}</span>} description={t("checklistLede")} />
        <GoLiveChecklist checks={checklist.checks} />
        {committed ? (
          <p className="border-border text-muted m-0 border-t pt-4 text-sm" data-testid="golive-after">
            {t("after")}
          </p>
        ) : null}
      </Card>
    </>
  );
}
