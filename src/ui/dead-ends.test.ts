// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * No dead ends (docs/design/REDESIGN-PROMPT.md §4.9): every empty, status or error card offers the one next step.
 * An `<EmptyState>` without an `action` fails here with its file. The baseline below is the state before the
 * redesign (2026-11-03): each work group removes its own files from it; a count may only go down, a file may never
 * be added.
 */
const BASELINE: Record<string, number> = {
  "src/features/admin/billing/FieldWorkView.tsx": 1,
  "src/features/admin/billing/HardwareView.tsx": 1,
  "src/features/admin/billing/InvoicesView.tsx": 1,
  "src/features/admin/billing/MessagingRatesView.tsx": 1,
  "src/features/admin/billing/StorageView.tsx": 2,
  "src/features/admin/billing/SubscriptionsView.tsx": 1,
  "src/features/admin/credentials/ProviderCredentialsPanel.tsx": 1,
  "src/features/admin/fleet/FleetView.tsx": 2,
  "src/features/admin/fleet/IngestView.tsx": 1,
  "src/features/admin/fleet/OtaView.tsx": 2,
  "src/features/admin/growth/BroadcastCampaignsView.tsx": 1,
  "src/features/admin/growth/BroadcastSettingsView.tsx": 1,
  "src/features/admin/growth/FeeAccrualsView.tsx": 1,
  "src/features/admin/growth/MediaOrdersView.tsx": 1,
  "src/features/admin/insight/RentalHandoffsView.tsx": 1,
  "src/features/admin/insight/ReviewsModerationView.tsx": 1,
  "src/features/admin/listings/ModerationView.tsx": 2,
  "src/features/admin/operations/AdminHome.tsx": 1,
  "src/features/admin/operations/AuditView.tsx": 1,
  "src/features/admin/operations/IntegrationEventsView.tsx": 1,
  "src/features/admin/operations/OutboxView.tsx": 2,
  "src/features/admin/operations/PrivacyView.tsx": 1,
  "src/features/admin/support/SupportView.tsx": 1,
  "src/features/admin/tenants/TenantAiUsage.tsx": 1,
  "src/features/admin/tenants/TenantsView.tsx": 1,
  "src/features/owner/access/LocksView.tsx": 1,
  "src/features/owner/community/AnnouncementsView.tsx": 1,
  "src/features/owner/community/ContactsView.tsx": 1,
  "src/features/owner/community/FacilitiesView.tsx": 2,
  "src/features/owner/community/ParcelsView.tsx": 1,
  "src/features/owner/community/RulesView.tsx": 1,
  "src/features/owner/etax/EtaxView.tsx": 3,
  "src/features/owner/growth/FacebookPageView.tsx": 1,
  "src/features/owner/insights/InsightsView.tsx": 2,
  "src/features/owner/landlord-docs/IncomeView.tsx": 1,
  "src/features/owner/metering/DevicesView.tsx": 1,
  "src/features/owner/metering/LossView.tsx": 1,
  "src/features/owner/metering/MetersView.tsx": 2,
  "src/features/owner/metering/ReviewsView.tsx": 1,
  "src/features/owner/reports/ReportsView.tsx": 2,
  "src/features/owner/reviews/ReviewsView.tsx": 1,
  "src/features/owner/service/MaintenanceView.tsx": 1,
  "src/features/owner/service/RequestsView.tsx": 1,
  "src/features/owner/service/WorkOrdersView.tsx": 1,
  "src/features/owner/settings/AccessGrantsView.tsx": 1,
  "src/features/owner/settings/AuditLogView.tsx": 1,
  "src/features/owner/settings/BankAccountsView.tsx": 1,
  "src/features/owner/settings/LineOaView.tsx": 1,
  "src/features/owner/settings/MembersView.tsx": 1,
  "src/features/owner/settings/NotificationsView.tsx": 1,
  "src/features/owner/settings/PrivacyView.tsx": 2,
  "src/features/owner/settings/SupportAccessView.tsx": 1,
  "src/features/owner/tm30/Tm30View.tsx": 2,
  "src/ui/components/DataTable.tsx": 1,
};

const root = fileURLToPath(new URL("../../", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return name === "generated" ? [] : files(path);
    return /\.tsx$/.test(name) && !/\.(test|stories)\.tsx$/.test(name) ? [path] : [];
  });
}

/** The opening tag of each `<EmptyState` in a file (braces balanced, so a JSX prop value cannot end it early). */
export function emptyStatesWithoutAction(source: string): number {
  let count = 0;
  for (const match of source.matchAll(/<EmptyState\b/g)) {
    const rest = source.slice((match.index ?? 0) + match[0].length);
    let depth = 0;
    let end = rest.length;
    for (let i = 0; i < rest.length; i += 1) {
      const c = rest[i];
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (depth === 0 && (c === ">" || rest.startsWith("/>", i))) {
        end = i;
        break;
      }
    }
    if (!/\baction\s*=/.test(rest.slice(0, end))) count += 1;
  }
  return count;
}

describe("dead ends", () => {
  it("finds an EmptyState without an action", () => {
    expect(emptyStatesWithoutAction('<EmptyState title="x" />')).toBe(1);
    expect(emptyStatesWithoutAction('<EmptyState title={t("a")} action={<Button>go</Button>} />')).toBe(0);
    expect(emptyStatesWithoutAction("<EmptyState title={x > 1 ? a : b} />")).toBe(1);
  });

  it("every EmptyState offers a next step (no file above its baseline)", () => {
    const over = files("src").flatMap((file) => {
      const count = emptyStatesWithoutAction(readFileSync(join(root, file), "utf8"));
      const allowed = BASELINE[file] ?? 0;
      return count > allowed ? [`${file}: ${count} without an action (allowed ${allowed})`] : [];
    });
    expect(over).toEqual([]);
  });

  it("keeps the baseline honest: a file that is fixed leaves it", () => {
    const stale = Object.entries(BASELINE).flatMap(([file, allowed]) => {
      let count = 0;
      try {
        count = emptyStatesWithoutAction(readFileSync(join(root, file), "utf8"));
      } catch {
        return [`${file}: no longer exists`];
      }
      return count < allowed ? [`${file}: ${count} now (baseline ${allowed}) — lower it`] : [];
    });
    expect(stale).toEqual([]);
  });
});
