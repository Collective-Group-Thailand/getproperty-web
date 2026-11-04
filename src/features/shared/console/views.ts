import "server-only";

/**
 * The counts of a list's view tabs (REDESIGN-PROMPT §4.4): each the API's `meta.total` for the tab's own query with
 * `perPage=1`, read in parallel — never counted on the page. A count the API cannot give is left out (no number).
 */
export async function viewCounts<Key extends string>(
  keys: readonly Key[],
  total: (key: Key) => Promise<{ meta: { total: number } }>,
): Promise<Partial<Record<Key, number>>> {
  const entries = await Promise.all(
    keys.map((key) =>
      total(key).then(
        (page) => [key, page.meta.total] as const,
        () => [key, undefined] as const,
      ),
    ),
  );
  return Object.fromEntries(entries.filter(([, count]) => count !== undefined)) as Partial<Record<Key, number>>;
}
