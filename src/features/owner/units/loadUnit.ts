import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import type { UnitPanelData } from "./UnitPanel";

const LIVE = new Set<Schemas["LeaseStatus"]>(["active", "notice_given", "ending", "pending_signature"]);
const OPEN = new Set<Schemas["InvoiceStatus"]>(["issued", "partially_paid", "overdue"]);

/**
 * The unit panel's data from the API (board drawer in the browser, unit page on the server): the unit,
 * the lease in force (or the signed-for one of a reserved unit), each meter's last reading and the open
 * invoices. A failed side read leaves its part empty rather than failing the whole panel.
 */
export async function loadUnitPanel(api: ApiClient, unitId: string): Promise<UnitPanelData> {
  const unit = await unwrap(api.GET("/v1/owner/units/{unitId}", { params: { path: { unitId } } }));
  const leaseRead = unit.currentLeaseId
    ? unwrap(api.GET("/v1/owner/leases/{leaseId}", { params: { path: { leaseId: unit.currentLeaseId } } }))
    : unwrap(
        api.GET("/v1/owner/leases", {
          params: { query: { unitId, perPage: 10, sort: "startDate", order: "desc" } },
        }),
      ).then((page) => page.data.find((lease) => LIVE.has(lease.status)) ?? null);
  const [lease, meters, invoices] = await Promise.all([
    leaseRead.catch(() => null),
    unwrap(api.GET("/v1/owner/units/{unitId}/meters", { params: { path: { unitId } } }))
      .then((list) =>
        Promise.all(
          list.map(async (meter) => ({
            meter,
            last: await unwrap(
              api.GET("/v1/owner/meters/{assetItemId}/readings", {
                params: {
                  path: { assetItemId: meter.assetItemId },
                  query: { perPage: 1, sort: "readAt", order: "desc" },
                },
              }),
            )
              .then((page) => page.data[0] ?? null)
              .catch(() => null),
          })),
        ),
      )
      .catch(() => []),
    unwrap(
      api.GET("/v1/owner/invoices", { params: { query: { unitId, perPage: 20, sort: "periodStart", order: "desc" } } }),
    )
      .then((page) => page.data.filter((invoice) => OPEN.has(invoice.status)))
      .catch(() => []),
  ]);
  return { unit, lease, meters, invoices };
}
