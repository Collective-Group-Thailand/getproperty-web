import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { DEFAULT_FREE_GB, GIB, storageToday, type MockStorageWorld } from "../storage-world";
import { audit, body, json, notFound, paged, platform, problem, query, record, validation } from "./support";
import { TENANT_IDS } from "./world";

type Schemas = components["schemas"];

/**
 * Pack G1 on the admin surface (D-279, D-285, D-286): every tenant's latest snapshot (a spread of levels for
 * review), storage package definitions (price-plan add-ons; a price is set through a price-plan version, O-022),
 * per-tenant free-quota overrides (audited, never backdated) and the reconciliation reports.
 */

const s = (): MockStorageWorld => state.storage;
const KEY = /^[a-z][a-z0-9_]{1,40}$/;
const DECIMAL = /^\d{1,6}(\.\d{1,4})?$/;

/** Latest snapshot per tenant (GB used); the allowance follows the tenant's quota override. */
const SNAPSHOTS = [
  [TENANT_IDS.sample, 4.4],
  [TENANT_IDS.garden, 0.3],
  [TENANT_IDS.riverside, 5.6],
  [TENANT_IDS.branch, 1.9],
] as const;

const tenantName = (tenantId: string) => state.platform.tenants.find((t) => t.id === tenantId) ?? null;

export const storageAdminHandlers: HttpHandler[] = [
  http.get("*/v1/admin/storage/tenants", ({ request }) => {
    const ok = platform(request, "admin.storage.tenants", ["admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const data = SNAPSHOTS.map(([tenantId, gb]) => {
      const tenant = tenantName(tenantId);
      const used = gb * GIB;
      const allowance = Number(s().quota[tenantId]?.freeGb ?? DEFAULT_FREE_GB) * GIB;
      const usedPercent = Math.floor((used / allowance) * 100);
      return {
        tenantId,
        displayName: tenant?.displayName ?? tenantId,
        type: tenant?.type ?? "apartment",
        day: storageToday(),
        usedBytes: String(Math.round(used)),
        fileBytes: String(Math.round(used * 0.92)),
        allowanceBytes: String(Math.round(allowance)),
        usedPercent,
        level: (usedPercent > 100
          ? "over"
          : usedPercent === 100
            ? "full"
            : usedPercent >= 80
              ? "warning"
              : "ok") as Schemas["StorageLevel"],
      };
    }).sort((a, b) => Number(b.usedBytes) - Number(a.usedBytes));
    return json({
      data,
      totals: {
        tenants: data.length,
        usedBytes: String(data.reduce((sum, r) => sum + Number(r.usedBytes), 0)),
        nearOrOver: data.filter((r) => r.level !== "ok").length,
      },
    } satisfies Schemas["AdminStorageOverviewDto"]);
  }),

  http.get("*/v1/admin/storage/packages", ({ request }) => {
    const ok = platform(request, "admin.storage.packages", ["admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    return json({ data: s().definitions } satisfies Schemas["StoragePackageDefinitionsDto"]);
  }),

  http.post("*/v1/admin/storage/packages", async ({ request }) => {
    const op = "admin.storage.createPackage";
    const ok = platform(request, op, ["admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["CreateStoragePackageDto"]>(request);
    record(op, request, input);
    if (!KEY.test(input.key ?? "")) return validation(op, "key", "a–z, 0–9 and _ (2–41 characters)");
    if (s().definitions.some((d) => d.key === input.key)) return validation(op, "key", "Key already used", "taken");
    if (!DECIMAL.test(input.sizeGb ?? "") || Number(input.sizeGb) <= 0) return validation(op, "sizeGb", "GB > 0");
    if (input.unitPrice && !DECIMAL.test(input.unitPrice)) return validation(op, "unitPrice", "Decimal price");
    if (!input.nameTh?.trim() || !input.nameEn?.trim()) return validation(op, "nameTh", "Both names are required");
    if (!input.effectiveFrom || input.effectiveFrom < storageToday()) return problem(op, "settings.backdated");
    const definition: Schemas["StoragePackageDefinitionDto"] = {
      id: crypto.randomUUID(),
      key: input.key,
      nameTh: input.nameTh.trim(),
      nameEn: input.nameEn.trim(),
      tenantType: input.tenantType ?? null,
      isActive: true,
      sizeBytes: String(Math.round(Number(input.sizeGb) * GIB)),
      period: input.period,
      visibility: input.visibility,
      // The version is a draft until published on Price plans: never on sale at creation (O-022).
      onSale: false,
      versionId: crypto.randomUUID(),
      versionState: "draft",
      unitPrice: input.unitPrice ? Number(input.unitPrice).toFixed(4) : null,
      vatRate: input.vatRate ? Number(input.vatRate).toFixed(4) : "0.0700",
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
    };
    s().definitions.push(definition);
    audit(ok, "storage_package.created", { type: "price_plan", id: definition.id }, { after: definition });
    return json(definition, 201);
  }),

  http.patch("*/v1/admin/storage/packages/:packageId", async ({ request, params }) => {
    const op = "admin.storage.updatePackage";
    const ok = platform(request, op, ["admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const definition = s().definitions.find((d) => d.id === params.packageId);
    if (!definition) return notFound(op);
    const input = await body<Schemas["UpdateStoragePackageDto"]>(request);
    record(op, request, input);
    if (input.nameTh !== undefined) definition.nameTh = input.nameTh;
    if (input.nameEn !== undefined) definition.nameEn = input.nameEn;
    if (input.isActive !== undefined) definition.isActive = input.isActive;
    audit(ok, "storage_package.updated", { type: "price_plan", id: definition.id }, { after: input });
    return json(definition);
  }),

  http.get("*/v1/admin/storage/reconciliations", ({ request }) => {
    const ok = platform(request, "admin.storage.reconciliations", ["admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const tenantId = query(request).get("tenantId");
    const rows = s()
      .reconciliations.filter((r) => !tenantId || r.tenantId === tenantId)
      .sort((a, b) => b.ranAt.localeCompare(a.ranAt));
    return json(paged(rows, request) satisfies Schemas["StorageReconciliationPageDto"]);
  }),

  http.post("*/v1/admin/storage/tenants/:tenantId/actions/reconcile", ({ request, params }) => {
    const op = "admin.storage.reconcile";
    const ok = platform(request, op, ["admin.setting.manage"]);
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantName(tenantId)) return notFound(op);
    record(op, request, { tenantId });
    const bytes = String(SNAPSHOTS.find(([id]) => id === tenantId)?.[1] ?? 0);
    const report: Schemas["StorageReconciliationDto"] = {
      id: crypto.randomUUID(),
      tenantId,
      ranAt: new Date().toISOString(),
      s3Bytes: String(Math.round(Number(bytes) * GIB * 0.92)),
      s3Objects: "1206",
      dbBytes: String(Math.round(Number(bytes) * GIB * 0.92)),
      dbObjects: "1206",
      driftBytes: "0",
      corrected: false,
      details: { countedAfter: "0", missing: [], missingCount: 0, orphanCount: 0, orphans: [], resizedDocuments: 0 },
    };
    s().reconciliations.push(report);
    return json(report);
  }),

  http.put("*/v1/admin/tenants/:tenantId/storage-quota", async ({ request, params }) => {
    const op = "admin.storage.setQuota";
    const ok = platform(request, op, ["admin.setting.manage"]);
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantName(tenantId)) return notFound(op);
    const input = await body<Schemas["StorageQuotaOverrideDto"]>(request);
    record(op, request, input);
    if (!DECIMAL.test(input.freeGb ?? "") || Number(input.freeGb) <= 0) return problem(op, "settings.invalid_value");
    if (!input.reason?.trim()) return validation(op, "reason", "Write why (audit note)");
    if (input.effectiveFrom && Date.parse(input.effectiveFrom) < Date.now() - 60_000)
      return problem(op, "settings.backdated");
    const quota = {
      freeGb: input.freeGb,
      versionId: crypto.randomUUID(),
      effectiveFrom: input.effectiveFrom ?? new Date().toISOString(),
    };
    s().quota[tenantId] = quota;
    audit(ok, "setting.updated", { type: "setting", id: "storage.free_gb" }, { tenantId, after: input });
    return json({ tenantId, ...quota } satisfies Schemas["StorageQuotaDto"]);
  }),
];
