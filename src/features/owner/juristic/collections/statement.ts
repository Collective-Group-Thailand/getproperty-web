import type { Schemas } from "@/lib/api/types";

export interface StatementUnitGroup {
  key: string;
  unitNo: string | null;
  building: string | null;
  invoices: Schemas["StatementInvoiceDto"][];
}

/**
 * A statement's open invoices grouped by unit, in the order the statement lists its units (J-DESIGN §4 paper
 * statement, multi-unit grouping): an owner of two units reads one block per unit. A unit without an open invoice is
 * still listed (nothing due there); an invoice whose unit the statement does not name is kept in a last group, never
 * dropped. The balances are the API's strings — nothing is summed here.
 */
export function groupByUnit(statement: Pick<Schemas["StatementDto"], "units" | "openInvoices">): StatementUnitGroup[] {
  const groups: StatementUnitGroup[] = statement.units.map((unit) => ({
    key: unit.id,
    unitNo: unit.unitNo,
    building: unit.building,
    invoices: [],
  }));
  const other: StatementUnitGroup = { key: "other", unitNo: null, building: null, invoices: [] };
  for (const invoice of statement.openInvoices) {
    const group = groups.find((candidate) => candidate.unitNo !== null && candidate.unitNo === invoice.unitNo);
    (group ?? other).invoices.push(invoice);
  }
  for (const group of groups) group.invoices.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  return other.invoices.length ? [...groups, other] : groups;
}

/** `YYYY-MM` months for the issue / letter forms: this month and the eleven before it, newest first (Bangkok). */
export function recentMonths(today: string, count = 12): string[] {
  const [year, month] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, index) => {
    const total = year * 12 + (month - 1) - index;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}
