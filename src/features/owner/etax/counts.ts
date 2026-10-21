import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";

/**
 * e-Tax documents the provider refused or that failed every retry (D-215) — what the owner or accountant has to
 * fix and retry. Two reads (the list filters one status at a time); `undefined` when unreadable.
 */
export async function etaxToFix(api: ApiClient): Promise<number | undefined> {
  try {
    const [rejected, failed] = await Promise.all(
      (["rejected", "failed"] as const).map((status) =>
        unwrap(api.GET("/v1/owner/etax/submissions", { params: { query: { status, perPage: 1 } } })),
      ),
    );
    return rejected!.meta.total + failed!.meta.total;
  } catch {
    return undefined;
  }
}
