import "server-only";

import { viewCounts } from "@/features/shared/console/views";
import { ViewTabs } from "@/ui/components/ListToolbar";

/**
 * The view tabs of an admin list by state ("ทั้งหมด" + one per state), each with the API's own total for that query
 * (`perPage=1`, REDESIGN-PROMPT §4.4) — a tab whose total the API cannot give shows no number.
 */
export async function StateTabs<Key extends string>({
  states,
  current,
  total,
  href,
  label,
  allLabel,
  navLabel,
  testIdPrefix,
  hideEmpty = true,
}: {
  states: readonly Key[];
  current: Key | undefined;
  /** The list's own read for one state (`undefined` = all), with `perPage: 1`. */
  total: (state: Key | undefined) => Promise<{ meta: { total: number } }>;
  href: (state: Key | undefined) => string;
  label: (state: Key) => string;
  allLabel: string;
  navLabel: string;
  testIdPrefix?: string;
  /** Leave out the states nobody is in (but never the open one): a list of seven states reads as noise. */
  hideEmpty?: boolean;
}) {
  const keys = ["all", ...states] as const;
  const counts = await viewCounts(keys, (key) => total(key === "all" ? undefined : (key as Key)));
  return (
    <ViewTabs
      label={navLabel}
      current={current ?? "all"}
      tabs={keys
        .filter((key) => !hideEmpty || key === "all" || key === (current ?? "all") || counts[key] !== 0)
        .map((key) => ({
          key,
          href: href(key === "all" ? undefined : (key as Key)),
          label: key === "all" ? allLabel : label(key as Key),
          count: counts[key],
          testId: testIdPrefix ? `${testIdPrefix}-${key}` : undefined,
        }))}
    />
  );
}
