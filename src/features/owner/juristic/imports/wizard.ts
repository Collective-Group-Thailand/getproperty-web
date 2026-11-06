import type { Schemas } from "@/lib/api/types";

/**
 * The import wizard's step machine (JW3a; api J3.1, D-332), pure and unit-tested. The API decides what may happen
 * (`state`, `nextActions`, refusals); this only says which of the five steps the job stands at, what each step's
 * status line reads, why the next step is not open yet, and how far go-live is — from the API's own facts. Nothing
 * here adds money up: figures are shown as the API returns them.
 */

type Job = Schemas["JuristicImportJobDto"];
type Report = Schemas["JuristicParallelCycleReportDto"];
type Sheet = Schemas["ImportSheet"];
type UploadSheet = Schemas["ImportUploadSheet"];

export const STEPS = ["upload", "validate", "reconcile", "commit", "golive"] as const;
export type StepKey = (typeof STEPS)[number];

/** The sheets of a commit, in the order the office fills them; the first two are required (D-332 (1)). */
export const REQUIRED_SHEETS: readonly UploadSheet[] = ["register", "opening_balance"];
export const OPTIONAL_SHEETS: readonly UploadSheet[] = ["payment_history", "bank_balance"];
export const UPLOAD_SHEETS: readonly UploadSheet[] = [...REQUIRED_SHEETS, ...OPTIONAL_SHEETS];

/** States after which nothing more happens to the job. */
export const CLOSED_STATES: readonly Schemas["ImportState"][] = ["live", "rolled_back", "cancelled"];

export function isClosed(job: Pick<Job, "state">): boolean {
  return CLOSED_STATES.includes(job.state);
}

/** The file of a sheet, if uploaded. */
export function fileOf(job: Pick<Job, "files">, sheet: Sheet): Schemas["JuristicImportFileDto"] | undefined {
  return job.files.find((file) => file.sheet === sheet);
}

/** Required sheets with no file yet, in order. */
export function missingSheets(job: Pick<Job, "files">): UploadSheet[] {
  return REQUIRED_SHEETS.filter((sheet) => !fileOf(job, sheet));
}

/** Rows with errors: the last validation's count, else the files' own counts. */
export function rowErrors(job: Pick<Job, "files" | "totals">): number {
  if (job.totals) return job.totals.errors;
  return job.files.reduce((count, file) => count + (file.sheet === "legacy_bills" ? 0 : file.errorCount), 0);
}

/** Rows in the commit's files (the legacy bills of the parallel cycle are not part of it). */
export function rowCount(job: Pick<Job, "files">): number {
  return job.files.reduce((count, file) => count + (file.sheet === "legacy_bills" ? 0 : file.rowCount), 0);
}

/** Whether the reconciliation holds a difference the commit still needs explained (note and attachment). */
export function explanationMissing(job: Pick<Job, "reconciliation">): boolean {
  const rec = job.reconciliation;
  return !!rec && rec.explanationRequired && !(rec.note && rec.documentId);
}

/**
 * The step a job stands at: committed and live jobs at the parallel cycle and go-live; a reconciled job at the commit
 * unless a difference still needs its explanation; a validated job at the reconcile; a draft at the upload while a
 * required sheet is missing, else at the validation (rows to fix). Rolled back and cancelled jobs end where they
 * stopped: a rollback after the commit, a cancellation at the step its state had reached.
 */
export function activeStep(job: Pick<Job, "state" | "files" | "totals" | "reconciliation" | "committedAt">): StepKey {
  switch (job.state) {
    case "live":
    case "committed":
    case "rolled_back":
      return "golive";
    case "reconciled":
      return explanationMissing(job) ? "reconcile" : "commit";
    case "validated":
      return "reconcile";
    case "cancelled":
      if (job.reconciliation) return explanationMissing(job) ? "reconcile" : "commit";
      if (job.totals && missingSheets(job).length === 0 && job.totals.errors === 0) return "reconcile";
      return missingSheets(job).length ? "upload" : "validate";
    default:
      return missingSheets(job).length ? "upload" : "validate";
  }
}

/**
 * The step shown: `?step=` may reopen any step up to the active one (done steps are read back, never edited out of
 * order); anything else shows the active step.
 */
export function viewStep(job: Parameters<typeof activeStep>[0], requested: string | undefined | null): StepKey {
  const active = activeStep(job);
  const wanted = STEPS.find((step) => step === requested);
  if (!wanted) return active;
  return STEPS.indexOf(wanted) <= STEPS.indexOf(active) ? wanted : active;
}

export type StepStatus = "done" | "current" | "upcoming";

/** A step's status line as a message key under `owner.imports.track.line` and its values. */
export interface StepLine {
  key: string;
  values?: Record<string, string | number>;
  tone: "success" | "primary" | "warning" | "muted";
}

export interface StepView {
  key: StepKey;
  status: StepStatus;
  line: StepLine;
}

/** The five steps with their status and one line each — the Stitch stepper ("นำเข้า 248 แปลง", "ยอดค้าง 37 บัญชี"). */
export function wizardSteps(job: Job, report?: Report | null): StepView[] {
  const active = STEPS.indexOf(activeStep(job));
  const live = job.state === "live";
  const status = (index: number): StepStatus =>
    live || index < active ? "done" : index === active ? "current" : "upcoming";
  const units = job.totals?.units ?? 0;
  return STEPS.map((key, index): StepView => {
    const state = status(index);
    if (state === "upcoming") return { key, status: state, line: { key: "upcoming", tone: "muted" } };
    const done = state === "done";
    switch (key) {
      case "upload": {
        const missing = missingSheets(job).length;
        if (done || missing === 0)
          return {
            key,
            status: state,
            line: {
              key: "files",
              values: { files: job.files.filter((f) => f.sheet !== "legacy_bills").length, rows: rowCount(job) },
              tone: done ? "success" : "primary",
            },
          };
        return { key, status: state, line: { key: "missing", values: { count: missing }, tone: "primary" } };
      }
      case "validate": {
        if (done) return { key, status: state, line: { key: "units", values: { count: units }, tone: "success" } };
        const errors = rowErrors(job);
        if (errors > 0)
          return { key, status: state, line: { key: "errors", values: { count: errors }, tone: "warning" } };
        return { key, status: state, line: { key: "checking", tone: "primary" } };
      }
      case "reconcile": {
        const rec = job.reconciliation;
        if (done)
          return {
            key,
            status: state,
            line: {
              key: rec?.explanationRequired ? "explained" : "matched",
              values: { count: job.totals?.unitsInArrears ?? 0 },
              tone: "success",
            },
          };
        if (rec && explanationMissing(job)) return { key, status: state, line: { key: "explain", tone: "warning" } };
        return { key, status: state, line: { key: "declare", tone: "primary" } };
      }
      case "commit": {
        if (done)
          return {
            key,
            status: state,
            line: { key: "committed", values: { count: job.created.unit ?? units }, tone: "success" },
          };
        return { key, status: state, line: { key: "ready", values: { count: units }, tone: "primary" } };
      }
      case "golive": {
        if (live) return { key, status: "done", line: { key: "live", tone: "success" } };
        if (job.state === "rolled_back") return { key, status: state, line: { key: "rolledBack", tone: "muted" } };
        if (job.state === "cancelled") return { key, status: state, line: { key: "cancelled", tone: "muted" } };
        if (report?.runAt) {
          const unexplained = report.summary.unexplained;
          if (unexplained > 0)
            return {
              key,
              status: state,
              line: { key: "differences", values: { count: unexplained }, tone: "warning" },
            };
          return { key, status: state, line: { key: "compared", tone: "primary" } };
        }
        return { key, status: state, line: { key: "parallel", tone: "primary" } };
      }
    }
  }).map((view) =>
    // A closed job that stopped before the last step: the steps after it never happen.
    !live &&
    (job.state === "cancelled" || job.state === "rolled_back") &&
    view.status === "current" &&
    view.key !== "golive"
      ? { ...view, line: { key: "cancelled", tone: "muted" } }
      : view,
  );
}

/**
 * Why the wizard cannot move on from the active step, in one reason (the disabled next button's line, Stitch: "แก้ 3
 * แถวก่อน จึงจะสามารถดำเนินการต่อได้"); null when the next step is open.
 */
export type NextBlock =
  | { reason: "read_only" }
  | { reason: "missing_sheets"; count: number }
  | { reason: "row_errors"; count: number }
  | { reason: "reconcile_first" }
  | { reason: "explain_difference" }
  | { reason: "closed" }
  | null;

export function nextBlock(job: Job): NextBlock {
  if (isClosed(job)) return { reason: "closed" };
  if (job.nextActions.length === 0) return { reason: "read_only" };
  switch (activeStep(job)) {
    case "upload":
      return { reason: "missing_sheets", count: missingSheets(job).length };
    case "validate":
      return rowErrors(job) > 0 ? { reason: "row_errors", count: rowErrors(job) } : null;
    case "reconcile":
      return job.reconciliation ? { reason: "explain_difference" } : { reason: "reconcile_first" };
    default:
      return null;
  }
}

// --------------------------------------------------------------------------------------------- reconcile gating

/** A decimal string is zero ("0.00", "-0.00") — read, not computed. */
export function isZero(amount: string | null | undefined): boolean {
  return !!amount && /^[-+]?0*(\.0*)?$/.test(amount.trim()) && /\d/.test(amount);
}

/** A decimal string below zero ("-50.00") — its sign, read. */
export function isNegative(amount: string | null | undefined): boolean {
  return !!amount && amount.trim().startsWith("-") && !isZero(amount);
}

export const NOTE_MIN = 10;
export const NOTE_MAX = 2000;

/**
 * The reconcile form's check before sending (the API checks again, D-332 (4)): any item not matching needs the note
 * (10–2000) and an attachment, together; a note or an attachment alone is refused by the API, so it is said here.
 */
export type ReconcileProblem =
  "declared_missing" | "declared_invalid" | "note_short" | "note_long" | "attachment" | "note";

export function reconcileProblem(input: {
  declared: string | null;
  note: string;
  hasAttachment: boolean;
  /** Whether the last reconciliation found a difference (then both are required). */
  explanationRequired: boolean;
}): ReconcileProblem | null {
  const declared = input.declared?.trim() ?? "";
  if (!declared) return "declared_missing";
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(declared)) return "declared_invalid";
  const note = input.note.trim();
  if (!input.explanationRequired && !note && !input.hasAttachment) return null;
  if (!note) return input.explanationRequired || input.hasAttachment ? "note" : null;
  if (note.length < NOTE_MIN) return "note_short";
  if (note.length > NOTE_MAX) return "note_long";
  if (!input.hasAttachment) return "attachment";
  return null;
}

/** "12,345.50" / "฿12,345.50" / "12345.5" → "12345.50"-style input the API takes, or null. Typed input, not money maths. */
export function normaliseDeclared(raw: string): string | null {
  const cleaned = raw.replace(/[฿,\s]/g, "");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return null;
  return cleaned;
}

// --------------------------------------------------------------------------------------------- go-live checklist

export interface ImportSettings {
  /** `juristic.import.parallel_cycle_required`; unknown → required (conservative). */
  parallelRequired: boolean;
  /** `juristic.import.allow_unexplained_differences`; unknown → not allowed. */
  allowUnexplained: boolean;
}

export function importSettings(values: { parallelRequired?: unknown; allowUnexplained?: unknown }): ImportSettings {
  return {
    parallelRequired: values.parallelRequired !== false,
    allowUnexplained: values.allowUnexplained === true,
  };
}

export type CheckState = "done" | "todo" | "optional" | "acknowledge";

export interface GoLiveCheck {
  key: "reconcile" | "parallel" | "differences";
  state: CheckState;
  values?: Record<string, string | number>;
}

/**
 * J-DESIGN pilot go-live: reconciliation 100 % (matched, or explained with an attachment), one parallel cycle compared
 * (unless the setting says it is not required), every difference explained — or, only where the setting allows it,
 * acknowledged. `ready` is true when go-live can be sent (with `acknowledgeDifferences` when `acknowledge`).
 */
export function goLiveChecklist(
  job: Job,
  report: Report | null | undefined,
  settings: ImportSettings,
): { checks: GoLiveCheck[]; ready: boolean; needsAcknowledgement: boolean } {
  const rec = job.reconciliation;
  const reconcile: GoLiveCheck = {
    key: "reconcile",
    state: rec && !explanationMissing(job) ? "done" : "todo",
    values: { explained: rec?.explanationRequired ? 1 : 0 },
  };
  const ran = !!report?.runAt;
  const parallel: GoLiveCheck = {
    key: "parallel",
    state: ran ? "done" : settings.parallelRequired ? "todo" : "optional",
    values: { units: report?.summary.units ?? 0 },
  };
  const unexplained = ran ? report!.summary.unexplained : 0;
  const different = ran ? report!.summary.different : 0;
  const differences: GoLiveCheck = {
    key: "differences",
    state: !ran
      ? settings.parallelRequired
        ? "todo"
        : "optional"
      : unexplained === 0
        ? "done"
        : settings.allowUnexplained
          ? "acknowledge"
          : "todo",
    values: { different, unexplained },
  };
  const checks = [reconcile, parallel, differences];
  return {
    checks,
    ready: checks.every((check) => check.state !== "todo"),
    needsAcknowledgement: differences.state === "acknowledge",
  };
}

// --------------------------------------------------------------------------------------------- differences table

export type DifferenceFilter = "all" | "different" | "unexplained";
type Difference = Schemas["JuristicCycleDifferenceDto"];

export function differenceKind(row: Difference): "match" | "explained" | "unexplained" {
  if (isZero(row.difference)) return "match";
  return row.explanation ? "explained" : "unexplained";
}

const RANK = { unexplained: 0, explained: 1, match: 2 } as const;
const unitOrder = new Intl.Collator("th", { numeric: true });

/**
 * The per-unit comparison: unexplained differences first (the office's work), then explained ones, then matching
 * units, each by unit number (numeric-aware); filtered; with the counts for the filter tabs.
 */
export function differenceView(rows: readonly Difference[], filter: DifferenceFilter) {
  const sorted = [...rows].sort(
    (a, b) => RANK[differenceKind(a)] - RANK[differenceKind(b)] || unitOrder.compare(a.unitNo, b.unitNo),
  );
  const counts = {
    all: rows.length,
    different: rows.filter((row) => differenceKind(row) !== "match").length,
    unexplained: rows.filter((row) => differenceKind(row) === "unexplained").length,
  };
  const shown =
    filter === "all"
      ? sorted
      : sorted.filter((row) =>
          filter === "different" ? differenceKind(row) !== "match" : differenceKind(row) === "unexplained",
        );
  return { rows: shown, counts };
}

export function differenceFilter(value: string | undefined | null, counts?: { unexplained: number }): DifferenceFilter {
  if (value === "all" || value === "different" || value === "unexplained") return value;
  return counts && counts.unexplained > 0 ? "unexplained" : "all";
}

// --------------------------------------------------------------------------------------------- refusals

export type ProblemNext =
  | "open_job"
  | "reload"
  | "revalidate"
  | "to_reconcile"
  | "consent"
  | "to_cycle"
  | "to_differences"
  | "template"
  | "wait_scan"
  | null;

/**
 * Every refusal of the import operations, in the wizard's own words with the one next step that resolves it (the
 * message key is `owner.imports.problem.<key>`). Unknown codes fall back to the API's own detail.
 */
export const IMPORT_PROBLEMS: Readonly<Record<string, { key: string; next: ProblemNext }>> = {
  "import.job_open": { key: "job_open", next: "open_job" },
  "import.invalid_state": { key: "invalid_state", next: "reload" },
  "import.preview_stale": { key: "preview_stale", next: "revalidate" },
  "import.reconciliation_unexplained": { key: "reconciliation_unexplained", next: "to_reconcile" },
  "import.bill_to_consent_required": { key: "bill_to_consent_required", next: "consent" },
  "import.rollback_blocked": { key: "rollback_blocked", next: null },
  "import.parallel_cycle_missing": { key: "parallel_cycle_missing", next: "to_cycle" },
  "import.differences_unexplained": { key: "differences_unexplained", next: "to_differences" },
  "import.go_live_pending": { key: "go_live_pending", next: null },
  "import.file_invalid": { key: "file_invalid", next: "template" },
  "import.invalid_rows": { key: "invalid_rows", next: "to_differences" },
  "document.scan_pending": { key: "scan_pending", next: "wait_scan" },
  "document.infected": { key: "infected", next: null },
  "document.not_uploaded": { key: "not_uploaded", next: null },
  "document.type_not_allowed": { key: "type_not_allowed", next: "template" },
};

export function importProblem(code: string | null | undefined): { key: string; next: ProblemNext } | null {
  return code ? (IMPORT_PROBLEMS[code] ?? null) : null;
}

/** Where a refusal's next step leads inside the wizard (`?step=`), when it is a step. */
export function problemStep(next: ProblemNext): StepKey | null {
  switch (next) {
    case "revalidate":
      return "validate";
    case "to_reconcile":
      return "reconcile";
    case "consent":
      return "commit";
    case "to_cycle":
    case "to_differences":
      return "golive";
    default:
      return null;
  }
}

// --------------------------------------------------------------------------------------------- rows table

/** The columns the row table shows per sheet (keys of the API's normalised row data), the key fields first. */
export const ROW_COLUMNS: Readonly<Record<Sheet, readonly string[]>> = {
  register: ["unit_no", "owner_name"],
  opening_balance: ["unit_no", "period", "principal"],
  payment_history: ["unit_no", "paid_on", "amount"],
  bank_balance: ["account_type", "balance"],
  legacy_bills: ["unit_no", "amount"],
};

/** Columns holding money (formatted as THB when the value is a decimal string). */
export const MONEY_COLUMNS: ReadonlySet<string> = new Set(["principal", "surcharge", "amount", "balance"]);

/** Sheets with rows to read in the validation step: the commit's files that were uploaded. */
export function validationSheets(job: Pick<Job, "files">): UploadSheet[] {
  return UPLOAD_SHEETS.filter((sheet) => fileOf(job, sheet));
}

/** `?sheet=`: an uploaded sheet; else the first with errors; else the first uploaded. */
export function rowsSheet(job: Pick<Job, "files">, requested: string | undefined | null): UploadSheet | null {
  const sheets = validationSheets(job);
  const wanted = sheets.find((sheet) => sheet === requested);
  if (wanted) return wanted;
  return sheets.find((sheet) => (fileOf(job, sheet)?.errorCount ?? 0) > 0) ?? sheets[0] ?? null;
}
