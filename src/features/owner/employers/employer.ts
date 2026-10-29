import type { Schemas } from "@/lib/api/types";

/*
 * Employer housing (G8, D-299) on the owner side: pure helpers. Money stays the API's decimal strings — the console
 * never splits an invoice or computes a deduction (the statement does).
 */

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The statement month: `?month=YYYY-MM` when well-formed, else the current Bangkok month. */
export function statementMonth(value: string | undefined, now: number): string {
  if (value && MONTH.test(value)) return value;
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 7);
}

/** The month before / after a `YYYY-MM` key (navigation only). */
export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Roles of people who stay under a lease (TM30's staying roles) — a guarantor is never a worker. */
const STAYING = new Set<Schemas["LeasePartyRole"]>(["lessee", "co_tenant", "occupant"]);

export interface WorkerRow {
  partyId: string;
  name: string;
  unitNo: string | null;
  employeeNo: string;
}

/**
 * The rows of the payroll-number editor: everyone staying under the agreement's leases (once each, in lease order),
 * then workers already numbered who are no longer on one of those leases (kept, so a save never drops a number
 * silently).
 */
export function workerRows(
  leases: Pick<Schemas["LeaseDto"], "unitNo" | "parties">[],
  workers: Schemas["EmployerWorkerDto"][],
  names: Map<string, string> = new Map(),
): WorkerRow[] {
  const numbers = new Map(workers.map((worker) => [worker.partyId, worker.employeeNo]));
  const rows: WorkerRow[] = [];
  const seen = new Set<string>();
  for (const lease of leases) {
    for (const party of lease.parties) {
      if (!STAYING.has(party.role) || seen.has(party.partyId)) continue;
      seen.add(party.partyId);
      rows.push({
        partyId: party.partyId,
        name: party.displayName ?? names.get(party.partyId) ?? "—",
        unitNo: lease.unitNo,
        employeeNo: numbers.get(party.partyId) ?? "",
      });
    }
  }
  for (const worker of workers) {
    if (seen.has(worker.partyId)) continue;
    rows.push({
      partyId: worker.partyId,
      name: names.get(worker.partyId) ?? "—",
      unitNo: null,
      employeeNo: worker.employeeNo,
    });
  }
  return rows;
}

/** The body of `PUT …/workers`: numbered rows only, trimmed. */
export function workersBody(rows: Pick<WorkerRow, "partyId" | "employeeNo">[]): Schemas["EmployerWorkerDto"][] {
  return rows
    .map((row) => ({ partyId: row.partyId, employeeNo: row.employeeNo.trim() }))
    .filter((row) => row.employeeNo !== "");
}

/** Whether a lease may be attached to an agreement: in force, and in its building when it names one. */
export function attachable(
  agreement: Pick<Schemas["EmployerAgreementDto"], "state" | "buildingId">,
  lease: Pick<Schemas["LeaseDto"], "buildingId">,
): boolean {
  return agreement.state === "active" && (agreement.buildingId === null || agreement.buildingId === lease.buildingId);
}

const DEDUCT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
/** The API's deduct-percent rule (0–100, up to two decimals) — checked before sending. */
export function validDeductPercent(value: string): boolean {
  return DEDUCT.test(value.trim());
}
