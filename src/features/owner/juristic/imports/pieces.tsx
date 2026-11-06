import { useTranslations } from "next-intl";

import { RECONCILE_STATUS } from "@/domain/status";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { cn } from "@/ui/lib/cn";

import { differenceKind, isNegative, isZero, MONEY_COLUMNS, ROW_COLUMNS, type GoLiveCheck } from "./wizard";

/**
 * Pieces of the import wizard that render the same on the server and in Storybook (JW3a): the summary facts, the
 * reconcile blocks, the row issues table, the per-unit differences table and the go-live checklist. Every figure is
 * the API's decimal string, formatted — money stays ink (J-DESIGN §3), the badges explain.
 */

/** "+฿2,000.00" / "−฿50.00" / "฿0.00": a difference with its sign read from the string, never computed. */
export function signedTHB(amount: string, locale: Locale): string {
  if (isZero(amount)) return formatTHB("0.00", locale);
  const bare = amount.trim().replace(/^[-+]/, "");
  return `${isNegative(amount) ? "−" : "+"}${formatTHB(bare, locale)}`;
}

export interface SummaryFact {
  key: string;
  icon: IconGlyph;
  label: React.ReactNode;
  value: React.ReactNode;
}

/** The sticky summary's facts (Stitch "สรุปข้อมูลที่นำเข้า"): an icon, the words, the figure with its unit word. */
export function SummaryFacts({ facts, title }: { facts: SummaryFact[]; title: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3" data-testid="import-summary">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="divide-border m-0 flex flex-col divide-y">
        {facts.map((fact) => (
          <div key={fact.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-muted flex min-w-0 items-center gap-2.5 text-sm">
              <Icon icon={fact.icon} size={18} className="text-subtle shrink-0" />
              <span>{fact.label}</span>
            </dt>
            <dd
              className="m-0 text-end font-semibold whitespace-nowrap tabular-nums"
              data-testid={`summary-${fact.key}`}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One figure of a reconcile block: the label above, the amount in ink below. */
function Figure({
  label,
  value,
  align = "start",
  testId,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  align?: "start" | "end";
  testId?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", align === "end" && "sm:items-end sm:text-end")}>
      <span className="text-muted text-sm">{label}</span>
      <span className="text-xl font-semibold tracking-tight whitespace-nowrap tabular-nums" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

/**
 * A reconcile block (Stitch): the title, one line of what is compared, the status badge at the end, then the three
 * figures on a quiet band — imported, reference, difference — all ink; a missing statement says so in words.
 */
export function ReconcileBlock({ item, locale }: { item: Schemas["JuristicReconcileItemDto"]; locale: Locale }) {
  const t = useTranslations("owner.imports.reconcile");
  const receivables = item.kind === "receivables";
  const account = item.label.replace(/^(operating|fund)\s*/, "").trim();
  const title = receivables
    ? t("receivablesTitle")
    : item.label.startsWith("fund")
      ? t("fundTitle", { account })
      : t("bankTitle", { account });
  const imported = (
    <Figure
      label={receivables ? t("fromFile") : t("inFile")}
      value={formatTHB(item.imported, locale)}
      testId="reconcile-imported"
    />
  );
  const reference = (
    <Figure
      label={receivables ? t("declared") : t("statement")}
      value={item.reference === null ? "—" : formatTHB(item.reference, locale)}
      testId="reconcile-reference"
    />
  );
  return (
    <section
      className="flex flex-col gap-4"
      data-testid="reconcile-block"
      data-kind={item.kind}
      data-status={item.status}
      aria-label={title}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-muted m-0 text-sm">{receivables ? t("receivablesLede") : t("bankLede")}</p>
        </div>
        <StatusBadgeOf map={RECONCILE_STATUS} value={item.status} size="md" />
      </div>
      <div className="bg-bg-subtle border-border rounded-card grid gap-4 border px-5 py-4 sm:grid-cols-3">
        {receivables ? (
          <>
            {imported}
            {reference}
          </>
        ) : (
          <>
            {reference}
            {imported}
          </>
        )}
        <Figure
          label={item.status === "match" ? t("difference") : t("differenceToExplain")}
          value={item.difference === null ? "—" : signedTHB(item.difference, locale)}
          align="end"
          testId="reconcile-difference"
        />
      </div>
      {item.status === "no_statement" ? (
        <StatusText tone="muted" icon={IconInfo}>
          {t("noStatement")}
        </StatusText>
      ) : null}
    </section>
  );
}

/** The column label of a template key, in the page language (`owner.imports.column.<key>`), or the key. */
function useColumnLabel() {
  const t = useTranslations("owner.imports.column");
  return (key: string) => (t.has(key) ? t(key) : key);
}

/**
 * Rows of one sheet with their issues (Stitch "แถวที่ต้องแก้ไขในระบบ"): row number, the sheet's key fields, the
 * problems found (column + the API's message) and a state badge. The row data is the API's normalised values; money
 * columns are formatted when they hold a decimal string, anything else is shown as typed.
 */
export function RowIssuesTable({
  sheet,
  rows,
  locale,
}: {
  sheet: Schemas["ImportSheet"];
  rows: readonly Schemas["JuristicImportRowDto"][];
  locale: Locale;
}) {
  const t = useTranslations("owner.imports.rows");
  const label = useColumnLabel();
  const columns = ROW_COLUMNS[sheet];
  const cell = (key: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return <span className="text-muted">—</span>;
    if (MONEY_COLUMNS.has(key) && /^-?\d+(\.\d+)?$/.test(value))
      return <span className="whitespace-nowrap tabular-nums">{formatTHB(value, locale)}</span>;
    if (key === "unit_no") return <span className="font-mono text-sm whitespace-nowrap">{value}</span>;
    return <span>{value}</span>;
  };
  return (
    <SimpleTable
      caption={t("caption")}
      testId="import-rows"
      stackOnPhones
      minWidth="44rem"
      columns={[
        { key: "row", header: t("row"), className: "w-14", phone: "meta" },
        ...columns.map((key, index) => ({
          key,
          header: label(key),
          align: MONEY_COLUMNS.has(key) ? ("end" as const) : undefined,
          phone: index === 0 ? ("title" as const) : ("meta" as const),
        })),
        { key: "issues", header: t("issues"), className: "w-2/5", phone: "wide" },
        { key: "state", header: t("state"), phone: "status" },
      ]}
      rows={rows.map((row) => {
        const state = row.errors.length ? "error" : row.warnings.length ? "warning" : "ok";
        return {
          key: `${row.sheet}-${row.rowNo}`,
          testId: "import-row",
          data: { row: row.rowNo, state },
          cells: {
            row: <span className="text-muted tabular-nums">{t("rowNo", { row: row.rowNo })}</span>,
            ...Object.fromEntries(columns.map((key) => [key, cell(key, row.data[key])])),
            issues:
              row.errors.length || row.warnings.length ? (
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm" data-testid="row-issues">
                  {[
                    ...row.errors.map((issue) => ({ ...issue, kind: "error" as const })),
                    ...row.warnings.map((issue) => ({ ...issue, kind: "warning" as const })),
                  ].map((issue) => (
                    <li key={`${issue.kind}-${issue.column}-${issue.code}`} className="flex flex-col">
                      <span className={issue.kind === "error" ? "font-medium" : "text-muted"}>
                        {issue.column === "row" ? t("wholeRow") : label(issue.column)}
                        {issue.column !== "row" && row.data[issue.column] && !columns.includes(issue.column) ? (
                          <span className="text-muted font-normal">
                            {" · "}
                            {row.data[issue.column]}
                          </span>
                        ) : null}
                      </span>
                      <span className={issue.kind === "error" ? "text-fg" : "text-muted"}>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted text-sm">—</span>
              ),
            state:
              state === "error" ? (
                <Badge tone="danger" size="sm" icon={IconAlert}>
                  {t("needsFix")}
                </Badge>
              ) : state === "warning" ? (
                <Badge tone="warning" size="sm" icon={IconInfo}>
                  {t("warning")}
                </Badge>
              ) : (
                <Badge tone="success" size="sm" icon={IconCheckCircle}>
                  {t("ok")}
                </Badge>
              ),
          },
        };
      })}
    />
  );
}

/**
 * The parallel cycle per unit: unit, what the new system computed, what the legacy system billed, the difference (ink,
 * signed) and its state — matches, explained (with the words) or to explain — plus the row's action slot.
 */
export function DifferencesTable({
  rows,
  locale,
  action,
}: {
  rows: readonly Schemas["JuristicCycleDifferenceDto"][];
  locale: Locale;
  /** The explain button of a row (only while the job is committed and the viewer may). */
  action?: (row: Schemas["JuristicCycleDifferenceDto"]) => React.ReactNode;
}) {
  const t = useTranslations("owner.imports.differences");
  return (
    <SimpleTable
      caption={t("caption")}
      testId="difference-rows"
      stackOnPhones
      minWidth="48rem"
      columns={[
        { key: "unit", header: t("unit"), phone: "title" },
        { key: "computed", header: t("computed"), align: "end", phone: "meta", phoneLabel: true },
        { key: "legacy", header: t("legacy"), align: "end", phone: "meta", phoneLabel: true },
        { key: "difference", header: t("difference"), align: "end", phone: "figure" },
        { key: "state", header: t("state"), className: "min-w-56", phone: "status" },
        ...(action
          ? [
              {
                key: "action",
                header: <span className="sr-only">{t("action")}</span>,
                align: "end" as const,
                phone: "meta" as const,
              },
            ]
          : []),
      ]}
      rows={rows.map((row) => {
        const kind = differenceKind(row);
        return {
          key: row.id,
          testId: "difference-row",
          data: { unit: row.unitNo, kind },
          cells: {
            unit: <span className="font-mono text-sm">{row.unitNo}</span>,
            computed: <span className="whitespace-nowrap tabular-nums">{formatTHB(row.computed, locale)}</span>,
            legacy: <span className="whitespace-nowrap tabular-nums">{formatTHB(row.legacy, locale)}</span>,
            difference: (
              <span className="font-medium whitespace-nowrap tabular-nums" data-testid="difference-amount">
                {signedTHB(row.difference, locale)}
              </span>
            ),
            state:
              kind === "match" ? (
                <Badge tone="success" size="sm" icon={IconCheckCircle}>
                  {t("match")}
                </Badge>
              ) : kind === "explained" ? (
                <span className="flex flex-col gap-1">
                  <Badge tone="neutral" size="sm" icon={IconCheckCircle}>
                    {t("explained")}
                  </Badge>
                  <span className="text-muted text-sm" data-testid="difference-explanation">
                    {row.explanation}
                  </span>
                </span>
              ) : (
                <Badge tone="warning" size="sm" icon={IconAlert}>
                  {t("toExplain")}
                </Badge>
              ),
            ...(action ? { action: kind === "match" ? null : action(row) } : {}),
          },
        };
      })}
    />
  );
}

/** The go-live checklist (J-DESIGN pilot go-live): one row per condition with an icon and words, never colour alone. */
export function GoLiveChecklist({ checks }: { checks: readonly GoLiveCheck[] }) {
  const t = useTranslations("owner.imports.checklist");
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" data-testid="golive-checklist">
      {checks.map((check) => (
        <li
          key={check.key}
          className="flex items-start gap-3"
          data-testid="golive-check"
          data-key={check.key}
          data-state={check.state}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{t(`${check.key}.title`)}</span>
            <StatusText
              tone={check.state === "done" ? "success" : check.state === "todo" ? "warning" : "muted"}
              icon={check.state === "done" ? IconCheckCircle : check.state === "todo" ? IconAlert : IconInfo}
            >
              {t(`${check.key}.${check.state}`, check.values ?? {})}
            </StatusText>
          </span>
        </li>
      ))}
    </ul>
  );
}
