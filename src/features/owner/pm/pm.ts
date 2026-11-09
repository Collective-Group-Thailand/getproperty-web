import type { Schemas } from "@/lib/api/types";

/*
 * The PM company's console (pack J, JW3b; api J3.3, D-334) — pure rules, unit-tested: the share a percent string
 * draws on a thin line (drawing only — the figure in words is the API's), the contract tabs, where an assignment
 * stands, the staff board joined with its assignments, the refusals in words and the windows of the date fields.
 */

type Contract = Schemas["ManagementContractDto"];
type Board = Schemas["StaffBoardDto"];
type Assignment = Pick<Schemas["PmStaffAssignmentDto"], "startsOn" | "endsOn">;

/** A percent string of the API ("94.00") in hundredths of a percent, read as text (never as a float); `null` if not one. */
export function pctHundredths(text: string | null | undefined): bigint | null {
  const match = /^(\d{1,6})(?:\.(\d{1,4}))?$/.exec((text ?? "").trim());
  if (!match) return null;
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0").slice(0, 2));
}

/** The 0–1 share a percent string draws on `ProgressLine` (drawing only — the figure in words is the API's). */
export function shareOfPct(text: string | null | undefined): number {
  const hundredths = pctHundredths(text);
  if (hundredths === null) return 0;
  return hundredths >= 10000n ? 1 : Number(hundredths) / 10000;
}

/** Budget use at or above this percent reads as a warning line (the API's percent, compared, not computed). */
export const BUDGET_WARNING_HUNDREDTHS = 9000n;
export function budgetTone(usedText: string | null): "neutral" | "warning" {
  const hundredths = pctHundredths(usedText);
  return hundredths !== null && hundredths >= BUDGET_WARNING_HUNDREDTHS ? "warning" : "neutral";
}

/** Contract list tabs: offers waiting for an answer first, then the running ones, then all. */
export const CONTRACT_TABS = ["offered", "active", "all"] as const;
export type ContractTab = (typeof CONTRACT_TABS)[number];
export const CONTRACT_TAB_STATE: Readonly<Record<ContractTab, Schemas["ManagementContractState"] | undefined>> = {
  offered: "offered",
  active: "active",
  all: undefined,
};

export function contractTab(value: string | undefined, offered: number): ContractTab {
  if (value && (CONTRACT_TABS as readonly string[]).includes(value)) return value as ContractTab;
  return offered > 0 ? "offered" : "active";
}

/** The juristic office's tabs: drafts it prepares come first after the offers it is waiting on. */
export const JURISTIC_CONTRACT_TABS = ["active", "offered", "draft", "all"] as const;
export type JuristicContractTab = (typeof JURISTIC_CONTRACT_TABS)[number];
export function juristicContractTab(value: string | undefined): JuristicContractTab {
  return value && (JURISTIC_CONTRACT_TABS as readonly string[]).includes(value)
    ? (value as JuristicContractTab)
    : "active";
}

/** Where an assignment stands on a day (`endsOn` exclusive). */
export function assignmentWindow(assignment: Assignment, today: string): "current" | "scheduled" | "ended" {
  if (assignment.endsOn && assignment.endsOn <= today) return "ended";
  if (assignment.startsOn > today) return "scheduled";
  return "current";
}

/** The board's buildings with each person's assignment id (from `members`), for the end action. */
export interface BoardStaff {
  userId: string;
  displayName: string;
  role: Schemas["PmAssignmentRole"];
  shift: string | null;
  assignmentId: string | null;
  startsOn: string | null;
  endsOn: string | null;
}

export function boardBuildings(board: Board): (Board["buildings"][number] & { people: BoardStaff[] })[] {
  return board.buildings.map((building) => ({
    ...building,
    people: building.staff.map((staff) => {
      const assignment = board.members
        .find((member) => member.userId === staff.userId)
        ?.assignments.find((entry) => entry.buildingId === building.buildingId && entry.role === staff.role);
      return {
        ...staff,
        assignmentId: assignment?.assignmentId ?? null,
        startsOn: assignment?.startsOn ?? null,
        endsOn: assignment?.endsOn ?? null,
      };
    }),
  }));
}

/** Everyone an assignment may name: members assigned today and the unassigned, once each, by name. */
export function assignableMembers(board: Board): { userId: string; displayName: string }[] {
  const seen = new Map<string, string>();
  for (const member of [...board.members, ...board.unassigned]) seen.set(member.userId, member.displayName);
  return [...seen.entries()]
    .map(([userId, displayName]) => ({ userId, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "th"));
}

/** An offer whose start date has passed: accepting it is refused (`management_contract.offer_expired`). */
export function offerExpired(contract: Pick<Contract, "state" | "startsOn">, today: string): boolean {
  return contract.state === "offered" && contract.startsOn < today;
}

/** The dates a termination may take effect on: today … the contract's last day. */
export function terminateWindow(contract: Pick<Contract, "endsOn">, today: string): { min: string; max: string } {
  return { min: today, max: contract.endsOn < today ? today : contract.endsOn };
}

/** A management contract ends within the portfolio's expiry window (the API's `withinDays`): a calm warning. */
export function contractEndingSoon(daysLeft: number, withinDays: number): boolean {
  return daysLeft >= 0 && daysLeft <= withinDays;
}

export type ContractNext = "reload" | "juristic" | "staff" | null;

const PROBLEMS: Readonly<Record<string, { key: string; next: ContractNext }>> = {
  "management_contract.invalid_state": { key: "invalidState", next: "reload" },
  "management_contract.offer_expired": { key: "offerExpired", next: "juristic" },
  "management_contract.overlap": { key: "overlap", next: null },
  "management_contract.resolution_required": { key: "resolutionRequired", next: null },
  "management_contract.resolution_invalid": { key: "resolutionInvalid", next: null },
  "management_contract.pm_tenant_invalid": { key: "pmTenantInvalid", next: null },
  "vendor.blocked": { key: "vendorBlocked", next: null },
};

/** A refusal of a management contract action in words with its next step; `null` → the API's own notice. */
export function contractProblem(code: string | null | undefined): { key: string; next: ContractNext } | null {
  return code ? (PROBLEMS[code] ?? null) : null;
}

/** Staff assignment refusals → the field they belong to (the dialog shows them inline). */
export function staffProblemField(code: string | null | undefined): { field: string; key: string } | null {
  switch (code) {
    case "pm_staff.not_member":
      return { field: "userId", key: "notMember" };
    case "pm_staff.outside_term":
      return { field: "startsOn", key: "outsideTerm" };
    case "pm_staff.overlap":
      return { field: "userId", key: "overlap" };
    case "pm_staff.ended":
      return { field: "endsOn", key: "ended" };
    default:
      return null;
  }
}

export const PM_ROLES: readonly Schemas["PmAssignmentRole"][] = [
  "building_manager",
  "assistant_manager",
  "accountant",
  "technician",
  "admin_officer",
  "security_supervisor",
  "other",
];
