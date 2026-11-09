import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import {
  activeStep,
  differenceFilter,
  differenceView,
  goLiveChecklist,
  importProblem,
  reconcileAccount,
  rollbackBlocker,
  importSettings,
  IMPORT_PROBLEMS,
  isNegative,
  isZero,
  missingSheets,
  nextBlock,
  normaliseDeclared,
  problemStep,
  reconcileProblem,
  rowsSheet,
  viewStep,
  wizardSteps,
} from "./wizard";

type Job = Schemas["JuristicImportJobDto"];
type Report = Schemas["JuristicParallelCycleReportDto"];

const file = (sheet: Schemas["ImportSheet"], patch: Partial<Schemas["JuristicImportFileDto"]> = {}) => ({
  sheet,
  documentId: `doc-${sheet}`,
  fileName: `${sheet}.csv`,
  format: "csv" as const,
  rowCount: 10,
  errorCount: 0,
  warningCount: 0,
  uploadedAt: "2026-11-01T00:00:00+07:00",
  ...patch,
});

const totals = (patch: Partial<Schemas["JuristicImportTotalsDto"]> = {}): Schemas["JuristicImportTotalsDto"] => ({
  units: 48,
  unitsNew: 48,
  unitsAttached: 0,
  floorsNew: 8,
  parties: 50,
  partiesNew: 50,
  partiesAttached: 0,
  ownerships: 52,
  unitsIncomplete: 0,
  billTos: 0,
  openingInvoices: 12,
  unitsInArrears: 12,
  principal: "100.00",
  surcharge: "0.00",
  receivables: "100.00",
  historyCount: 0,
  historyAmount: "0.00",
  bankOperating: "0.00",
  bankFund: "0.00",
  errors: 0,
  warnings: 0,
  ...patch,
});

const rec = (
  patch: Partial<Schemas["JuristicImportReconciliationDto"]> = {},
): Schemas["JuristicImportReconciliationDto"] => ({
  items: [],
  explanationRequired: false,
  declaredReceivables: "100.00",
  note: null,
  documentId: null,
  reconciledAt: "2026-11-02T00:00:00+07:00",
  ...patch,
});

function job(patch: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    number: 1,
    buildingId: "b-1",
    buildingName: "อาคาร B",
    state: "draft",
    asOfDate: "2026-10-31",
    note: null,
    files: [],
    totals: null,
    reconciliation: null,
    created: {},
    committedAt: null,
    liveAt: null,
    rolledBackAt: null,
    rollbackReason: null,
    cancelledAt: null,
    parallelCycleId: null,
    parallelRunAt: null,
    nextActions: ["upload", "validate", "cancel"],
    createdAt: "2026-11-01T00:00:00+07:00",
    version: 1,
    ...patch,
  };
}

const diff = (unitNo: string, difference: string, explanation: string | null = null) => ({
  id: `d-${unitNo}`,
  unitId: null,
  unitNo,
  computed: "1000.00",
  legacy: "1000.00",
  difference,
  explanation,
  explainedAt: explanation ? "2026-11-03T00:00:00+07:00" : null,
});

function report(rows: ReturnType<typeof diff>[], runAt: string | null = "2026-11-03T00:00:00+07:00"): Report {
  const different = rows.filter((row) => !isZero(row.difference));
  return {
    importJobId: "job-1",
    billingCycleId: "c-1",
    periodKey: "2026-11",
    runAt,
    differences: rows,
    summary: {
      units: rows.length,
      matching: rows.length - different.length,
      different: different.length,
      unexplained: different.filter((row) => !row.explanation).length,
      computedTotal: "0.00",
      legacyTotal: "0.00",
      differenceTotal: "0.00",
    },
  };
}

describe("step machine (state × files × totals × reconciliation)", () => {
  it("a draft without both required sheets is at the upload", () => {
    expect(activeStep(job())).toBe("upload");
    expect(activeStep(job({ files: [file("register")] }))).toBe("upload");
    expect(missingSheets(job({ files: [file("register"), file("payment_history")] }))).toEqual(["opening_balance"]);
  });

  it("a draft with both sheets is at the validation (rows to fix)", () => {
    const draft = job({
      files: [file("register", { errorCount: 3 }), file("opening_balance")],
      totals: totals({ errors: 3 }),
    });
    expect(activeStep(draft)).toBe("validate");
    expect(nextBlock(draft)).toEqual({ reason: "row_errors", count: 3 });
  });

  it("validated → reconcile; reconciled → commit unless a difference is unexplained", () => {
    const files = [file("register"), file("opening_balance")];
    expect(activeStep(job({ state: "validated", files, totals: totals() }))).toBe("reconcile");
    expect(activeStep(job({ state: "reconciled", files, totals: totals(), reconciliation: rec() }))).toBe("commit");
    const unexplained = job({
      state: "reconciled",
      files,
      totals: totals(),
      reconciliation: rec({ explanationRequired: true }),
    });
    expect(activeStep(unexplained)).toBe("reconcile");
    expect(nextBlock(unexplained)).toEqual({ reason: "explain_difference" });
    const halfExplained = {
      ...unexplained,
      reconciliation: rec({ explanationRequired: true, note: "เช็ครอเคลียร์ 2,000 บาท" }),
    };
    expect(activeStep(halfExplained)).toBe("reconcile");
    const explained = {
      ...unexplained,
      reconciliation: rec({ explanationRequired: true, note: "เช็ครอเคลียร์ 2,000 บาท", documentId: "doc-9" }),
    };
    expect(activeStep(explained)).toBe("commit");
    expect(nextBlock(explained)).toBeNull();
  });

  it("committed, live and rolled back jobs stand at the last step; a cancelled one where it stopped", () => {
    expect(activeStep(job({ state: "committed" }))).toBe("golive");
    expect(activeStep(job({ state: "live" }))).toBe("golive");
    expect(activeStep(job({ state: "rolled_back" }))).toBe("golive");
    expect(activeStep(job({ state: "cancelled" }))).toBe("upload");
    expect(
      activeStep(job({ state: "cancelled", files: [file("register"), file("opening_balance")], totals: totals() })),
    ).toBe("reconcile");
    expect(nextBlock(job({ state: "cancelled" }))).toEqual({ reason: "closed" });
  });

  it("a viewer without manage rights gets no next step, with the reason", () => {
    expect(nextBlock(job({ nextActions: [] }))).toEqual({ reason: "read_only" });
    expect(nextBlock(job())).toEqual({ reason: "missing_sheets", count: 2 });
  });

  it("?step= reopens done steps only", () => {
    const reconciled = job({
      state: "reconciled",
      files: [file("register"), file("opening_balance")],
      totals: totals(),
      reconciliation: rec(),
    });
    expect(viewStep(reconciled, "validate")).toBe("validate");
    expect(viewStep(reconciled, "golive")).toBe("commit");
    expect(viewStep(reconciled, "nonsense")).toBe("commit");
    expect(viewStep(reconciled, undefined)).toBe("commit");
  });

  it("status lines follow the Stitch stepper", () => {
    const steps = wizardSteps(
      job({
        state: "reconciled",
        files: [file("register", { rowCount: 52 }), file("opening_balance", { rowCount: 20 })],
        totals: totals({ units: 48, unitsInArrears: 12 }),
        reconciliation: rec({ explanationRequired: true }),
      }),
    );
    expect(steps.map((step) => step.status)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expect(steps[0]!.line).toMatchObject({ key: "files", values: { files: 2, rows: 72 } });
    expect(steps[1]!.line).toMatchObject({ key: "units", values: { count: 48 } });
    expect(steps[2]!.line).toMatchObject({ key: "explain", tone: "warning" });
    expect(steps[3]!.line.key).toBe("upcoming");
  });

  it("a live job shows every step done; differences show on the last step while committed", () => {
    expect(wizardSteps(job({ state: "live", totals: totals() })).every((step) => step.status === "done")).toBe(true);
    const committed = job({ state: "committed", totals: totals(), reconciliation: rec(), created: { unit: 48 } });
    const steps = wizardSteps(committed, report([diff("B-101", "0.00"), diff("B-102", "-50.00")]));
    expect(steps[3]!.line).toMatchObject({ key: "committed", values: { count: 48 } });
    expect(steps[4]!.line).toMatchObject({ key: "differences", values: { count: 1 }, tone: "warning" });
    expect(wizardSteps(committed, null)[4]!.line.key).toBe("parallel");
  });

  it("a cancelled job's current step reads cancelled", () => {
    const steps = wizardSteps(job({ state: "cancelled", files: [file("register")] }));
    expect(steps[0]).toMatchObject({ status: "current", line: { key: "cancelled" } });
  });
});

describe("reconcile gating", () => {
  const base = { declared: "612450.00", note: "", hasAttachment: false, explanationRequired: false };
  it("needs a declared total in the API's format", () => {
    expect(reconcileProblem({ ...base, declared: "" })).toBe("declared_missing");
    expect(reconcileProblem({ ...base, declared: "12,00" })).toBe("declared_invalid");
    expect(reconcileProblem({ ...base, declared: "1.234" })).toBe("declared_invalid");
    expect(reconcileProblem(base)).toBeNull();
  });
  it("a difference needs the note (10–2000) and the attachment together", () => {
    const required = { ...base, explanationRequired: true };
    expect(reconcileProblem(required)).toBe("note");
    expect(reconcileProblem({ ...required, note: "สั้นไป" })).toBe("note_short");
    expect(reconcileProblem({ ...required, note: "x".repeat(2001) })).toBe("note_long");
    expect(reconcileProblem({ ...required, note: "ค่าธรรมเนียมโอนเงินและเช็ครอเคลียร์" })).toBe("attachment");
    expect(
      reconcileProblem({ ...required, note: "ค่าธรรมเนียมโอนเงินและเช็ครอเคลียร์", hasAttachment: true }),
    ).toBeNull();
  });
  it("an attachment without a note is refused even when nothing differs (the API takes both or neither)", () => {
    expect(reconcileProblem({ ...base, hasAttachment: true })).toBe("note");
    expect(reconcileProblem({ ...base, note: "ตรวจกับงบแล้ว ตรงทุกบัญชี" })).toBe("attachment");
  });
  it("typed totals are normalised, never computed", () => {
    expect(normaliseDeclared("฿612,450.00")).toBe("612450.00");
    expect(normaliseDeclared(" 2 184 330.15 ")).toBe("2184330.15");
    expect(normaliseDeclared("12.345")).toBeNull();
    expect(normaliseDeclared("-5")).toBeNull();
  });
  it("reads signs and zeros of decimal strings", () => {
    expect(isZero("0.00")).toBe(true);
    expect(isZero("-0.00")).toBe(true);
    expect(isZero("0.01")).toBe(false);
    expect(isZero("")).toBe(false);
    expect(isNegative("-50.00")).toBe(true);
    expect(isNegative("-0.00")).toBe(false);
    expect(isNegative("2000.00")).toBe(false);
  });
});

describe("go-live checklist", () => {
  const committed = job({
    state: "committed",
    reconciliation: rec(),
    nextActions: ["parallel_cycle", "rollback", "go_live"],
  });
  const strict = importSettings({ parallelRequired: true, allowUnexplained: false });

  it("unknown settings read conservatively", () => {
    expect(importSettings({})).toEqual({ parallelRequired: true, allowUnexplained: false });
    expect(importSettings({ parallelRequired: "false", allowUnexplained: "true" })).toEqual({
      parallelRequired: true,
      allowUnexplained: false,
    });
  });

  it("needs the parallel cycle when required", () => {
    const result = goLiveChecklist(committed, null, strict);
    expect(result.checks.map((check) => check.state)).toEqual(["done", "todo", "todo"]);
    expect(result.ready).toBe(false);
  });

  it("is optional when the setting says so", () => {
    const result = goLiveChecklist(committed, null, { parallelRequired: false, allowUnexplained: false });
    expect(result.checks.map((check) => check.state)).toEqual(["done", "optional", "optional"]);
    expect(result.ready).toBe(true);
  });

  it("every difference explained → ready; unexplained → todo, or acknowledge where allowed", () => {
    const explained = report([diff("B-101", "0.00"), diff("B-102", "-50.00", "ระบบเดิมรวมค่าที่จอดรถ")]);
    expect(goLiveChecklist(committed, explained, strict).ready).toBe(true);
    const open = report([diff("B-101", "0.00"), diff("B-102", "-50.00")]);
    expect(goLiveChecklist(committed, open, strict)).toMatchObject({ ready: false, needsAcknowledgement: false });
    expect(goLiveChecklist(committed, open, { parallelRequired: true, allowUnexplained: true })).toMatchObject({
      ready: true,
      needsAcknowledgement: true,
    });
  });

  it("an unexplained reconciliation is not done", () => {
    const unexplained = { ...committed, reconciliation: rec({ explanationRequired: true }) };
    expect(goLiveChecklist(unexplained, report([]), strict).checks[0]!.state).toBe("todo");
  });
});

describe("differences table", () => {
  const rows = [
    diff("B-110", "0.00"),
    diff("B-102", "-50.00", "ที่จอดรถ"),
    diff("B-9", "120.00"),
    diff("B-101", "0.00"),
    diff("B-10", "-0.00"),
    diff("B-201", "35.00"),
  ];
  it("puts unexplained first, then explained, then matching, by unit number", () => {
    const view = differenceView(rows, "all");
    expect(view.rows.map((row) => row.unitNo)).toEqual(["B-9", "B-201", "B-102", "B-10", "B-101", "B-110"]);
    expect(view.counts).toEqual({ all: 6, different: 3, unexplained: 2 });
  });
  it("filters", () => {
    expect(differenceView(rows, "different").rows.map((row) => row.unitNo)).toEqual(["B-9", "B-201", "B-102"]);
    expect(differenceView(rows, "unexplained").rows.map((row) => row.unitNo)).toEqual(["B-9", "B-201"]);
  });
  it("opens on unexplained when there are some", () => {
    expect(differenceFilter(null, { unexplained: 2 })).toBe("unexplained");
    expect(differenceFilter(null, { unexplained: 0 })).toBe("all");
    expect(differenceFilter("different", { unexplained: 2 })).toBe("different");
  });
});

describe("refusals", () => {
  it("maps every import code of the contract to words and a next step", () => {
    for (const code of [
      "import.job_open",
      "import.invalid_state",
      "import.preview_stale",
      "import.reconciliation_unexplained",
      "import.bill_to_consent_required",
      "import.rollback_blocked",
      "import.parallel_cycle_missing",
      "import.differences_unexplained",
      "import.go_live_pending",
      "import.file_invalid",
      "import.invalid_rows",
    ])
      expect(importProblem(code), code).not.toBeNull();
    expect(importProblem("validation.failed")).toBeNull();
    expect(importProblem(null)).toBeNull();
  });
  it("leads to the step that resolves it", () => {
    expect(problemStep(IMPORT_PROBLEMS["import.preview_stale"]!.next)).toBe("validate");
    expect(problemStep(IMPORT_PROBLEMS["import.reconciliation_unexplained"]!.next)).toBe("reconcile");
    expect(problemStep(IMPORT_PROBLEMS["import.bill_to_consent_required"]!.next)).toBe("commit");
    expect(problemStep(IMPORT_PROBLEMS["import.differences_unexplained"]!.next)).toBe("golive");
    expect(problemStep(IMPORT_PROBLEMS["import.job_open"]!.next)).toBeNull();
  });
});

describe("rows table", () => {
  it("opens the first sheet with errors", () => {
    const withErrors = job({
      files: [file("register"), file("opening_balance", { errorCount: 2 }), file("legacy_bills")],
    });
    expect(rowsSheet(withErrors, null)).toBe("opening_balance");
    expect(rowsSheet(withErrors, "register")).toBe("register");
    expect(rowsSheet(withErrors, "legacy_bills")).toBe("opening_balance");
    expect(rowsSheet(job(), null)).toBeNull();
  });
});

describe("J-CR answers in the wizard (D-335)", () => {
  it("names the record that blocks a rollback from the problem's table", () => {
    expect(rollbackBlocker("ops.invoice")).toBe("invoice");
    expect(rollbackBlocker("juristic.journal")).toBe("journal");
    expect(rollbackBlocker("ops.payment")).toBe("payment");
    expect(rollbackBlocker("ops.something_new")).toBeNull();
    expect(rollbackBlocker(undefined)).toBeNull();
  });

  it("reads the bank item's account from its fields, the label only for older reconciliations", () => {
    expect(
      reconcileAccount({ label: "operating ••4012", accountType: "operating", last4: "4012", fundName: null }),
    ).toEqual({ fund: false, account: "••4012" });
    expect(reconcileAccount({ label: "fund x", accountType: "fund", last4: "9911", fundName: "กองทุนสำรอง" })).toEqual({
      fund: true,
      account: "กองทุนสำรอง",
    });
    expect(reconcileAccount({ label: "fund กองทุนซ่อม", accountType: null, last4: null, fundName: null })).toEqual({
      fund: true,
      account: "กองทุนซ่อม",
    });
    expect(reconcileAccount({ label: "operating ••1234", accountType: null, last4: null, fundName: null })).toEqual({
      fund: false,
      account: "••1234",
    });
  });
});
