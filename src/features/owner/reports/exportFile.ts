import type { Schemas } from "@/lib/api/types";

/** The file extension of each export kind (D-051, D-202). */
const EXTENSION: Record<Schemas["ExportKind"], string> = {
  invoices_xlsx: "xlsx",
  payments_xlsx: "xlsx",
  arrears_xlsx: "xlsx",
  units_xlsx: "xlsx",
  flowaccount_csv: "csv",
  peak_csv: "csv",
  readings_csv: "csv",
  vat_pp30: "xlsx",
  income_expense: "xlsx",
  tax_annual_summary: "xlsx",
  tm30: "zip",
  document_archive_zip: "zip",
  loss_report_csv: "csv",
  payroll_deduction: "csv",
  etax_monthly_xlsx: "xlsx",
  juristic_receivables_csv: "csv",
  // J2.1: journals for the accountant's own software (Express is tab-separated text, FlowAccount a CSV).
  juristic_journal_csv: "csv",
  juristic_journal_express: "txt",
  juristic_journal_flowaccount: "csv",
  // J3.1: every juristic table, the register and the billing tables, one CSV each (D-332 (11)).
  juristic_full_export: "zip",
};

/** `income_expense-2026-10.xlsx`: kind, the period (or as-of date) the export covers, and its format. */
export function exportFileName(job: Pick<Schemas["ExportJobDto"], "kind" | "params" | "requestedAt">): string {
  const scope = job.params.period ?? job.params.asOf ?? job.requestedAt.slice(0, 10);
  return `${job.kind}-${scope.replace(/[^0-9A-Za-z-]/g, "")}.${EXTENSION[job.kind]}`;
}
