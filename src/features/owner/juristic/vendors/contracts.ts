/**
 * Service contracts (D-331): the renewal queue, the expiry badge and the SLA table of the editor. Dates are the API's
 * (`daysLeft`, `noticeBy` are computed by the API in Bangkok time); this file only compares them to decide which words
 * and tone a contract wears. Money and the instalment schedule are never computed here.
 */

export const PRIORITIES = ["urgent", "high", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** The alert thresholds of `juristic.contract_expiry_alert_days` as renewal windows, largest first (default none). */
export function renewalWindows(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const days = value.filter((entry): entry is number => Number.isInteger(entry) && entry > 0 && entry <= 365);
  return [...new Set(days)].sort((a, b) => b - a);
}

/** The window the renewal queue shows: the one asked for when it is one of the setting's, else the largest. */
export function renewalWindow(windows: readonly number[], requested: string | undefined): number | null {
  const asked = Number(requested);
  if (windows.includes(asked)) return asked;
  return windows[0] ?? null;
}

export type ExpiryBadge =
  | { kind: "renewing"; tone: "info" }
  | { kind: "notice"; tone: "warning"; noticeBy: string; daysLeft: number }
  | { kind: "ending"; tone: "info"; daysLeft: number }
  | { kind: "ended"; tone: "neutral" }
  | null;

/**
 * The badge a contract wears in lists and on its record (J-DESIGN §1.2 calm: nothing red):
 * - a renewal draft exists → "มีร่างต่อสัญญาแล้ว" (info);
 * - active and the notice date has come (today ≥ `noticeBy`) → "แจ้งต่อหรือยกเลิกภายใน …" (warning);
 * - active and inside the renewal window → "เหลือ N วัน" (info);
 * - active past its end (the job has not run yet) or expired → "สิ้นสุดแล้ว" (neutral);
 * - otherwise no badge (drafts, terminated, far from the end).
 */
export function expiryBadge(
  contract: { state: string; daysLeft: number; noticeBy: string; renewalId: string | null },
  today: string,
  window: number | null,
): ExpiryBadge {
  if (contract.state !== "active" && contract.state !== "expired") return null;
  if (contract.renewalId) return { kind: "renewing", tone: "info" };
  if (contract.state === "expired" || contract.daysLeft < 0) return { kind: "ended", tone: "neutral" };
  if (contract.noticeBy <= today)
    return { kind: "notice", tone: "warning", noticeBy: contract.noticeBy, daysLeft: contract.daysLeft };
  if (window !== null && contract.daysLeft <= window)
    return { kind: "ending", tone: "info", daysLeft: contract.daysLeft };
  return null;
}

export const CONTRACT_TABS = ["renewal", "active", "draft", "expired", "terminated", "all"] as const;
export type ContractTab = (typeof CONTRACT_TABS)[number];

/** The tab the list opens on: the one asked for, else the renewal queue when it has contracts, else every contract. */
export function contractTab(requested: string | undefined, renewalCount: number | undefined): ContractTab {
  const asked = CONTRACT_TABS.find((tab) => tab === requested);
  if (asked) return asked;
  return renewalCount && renewalCount > 0 ? "renewal" : "all";
}

export interface SlaRowInput {
  priority: Priority;
  responseHours: string;
  resolveHours: string;
}

export type SlaProblem = "both" | "range" | "order";

/**
 * The SLA table of the editor → the API's `slaTerms`: a row counts when both hours are filled; a half-filled row, an
 * hour outside 1–8760 or a resolve time shorter than the response time is a problem on that row.
 */
export function slaTerms(rows: readonly SlaRowInput[]): {
  terms: { priority: Priority; responseHours: number; resolveHours: number }[];
  problems: Partial<Record<Priority, SlaProblem>>;
} {
  const terms: { priority: Priority; responseHours: number; resolveHours: number }[] = [];
  const problems: Partial<Record<Priority, SlaProblem>> = {};
  for (const row of rows) {
    const response = row.responseHours.trim();
    const resolve = row.resolveHours.trim();
    if (!response && !resolve) continue;
    if (!response || !resolve) {
      problems[row.priority] = "both";
      continue;
    }
    const r = Number(response);
    const s = Number(resolve);
    if (![r, s].every((hours) => Number.isInteger(hours) && hours >= 1 && hours <= 8760)) {
      problems[row.priority] = "range";
      continue;
    }
    if (s < r) {
      problems[row.priority] = "order";
      continue;
    }
    terms.push({ priority: row.priority, responseHours: r, resolveHours: s });
  }
  return { terms, problems };
}

/** The editor's rows from a contract's terms (every priority, empty where the contract has none). */
export function slaRows(terms: readonly { priority: string; responseHours: number; resolveHours: number }[]) {
  return PRIORITIES.map((priority): SlaRowInput => {
    const term = terms.find((entry) => entry.priority === priority);
    return {
      priority,
      responseHours: term ? String(term.responseHours) : "",
      resolveHours: term ? String(term.resolveHours) : "",
    };
  });
}
