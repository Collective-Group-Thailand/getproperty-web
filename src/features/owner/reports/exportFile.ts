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
  etax_monthly_xlsx: "xlsx",
};

/** `income_expense-2026-10.xlsx`: kind, the period (or as-of date) the export covers, and its format. */
export function exportFileName(job: Pick<Schemas["ExportJobDto"], "kind" | "params" | "requestedAt">): string {
  const scope = job.params.period ?? job.params.asOf ?? job.requestedAt.slice(0, 10);
  return `${job.kind}-${scope.replace(/[^0-9A-Za-z-]/g, "")}.${EXTENSION[job.kind]}`;
}
