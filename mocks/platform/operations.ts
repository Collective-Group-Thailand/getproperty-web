import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { state } from "../state";
import {
  audit,
  body,
  idempotent,
  json,
  noContent,
  notFound,
  paged,
  platform,
  problem,
  query,
  record,
  validation,
} from "./support";

type Schemas = components["schemas"];

/**
 * B1.3 / B6.4 operations on the admin surface (F5 5.2): utility tariffs with the two-person
 * enter → verify → publish workflow (D-021a, D-140), platform settings (effective-dated, never
 * backdated), notification templates (preview, publish, test send), DSRs, the audit log (cursor),
 * the outbox and its subscribers' dead letters with replay, and platform users.
 */

const w = () => state.platform;

/** A platform-scoped file (`scopeType: platform`, no tenant, D-214), presigned until uploaded. */
function platformFile(input: {
  kind: Schemas["DocumentKind"];
  title: string | null;
  mimeType: string;
  sizeBytes: number;
}): Schemas["FileDto"] {
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    scopeType: "platform",
    scopeId: null,
    buildingId: null,
    title: input.title,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    width: null,
    height: null,
    retentionClass: input.kind,
    scanStatus: "pending",
    uploadState: "presigned",
    createdAt: new Date().toISOString(),
  };
}
const now = () => new Date().toISOString();

function tariffActions(version: Schemas["TariffVersionDto"]): string[] {
  return version.state === "entered" ? ["verify"] : version.state === "verified" ? ["publish"] : [];
}

function findVersion(versionId: string) {
  for (const tariff of w().tariffs) {
    const version = tariff.versions.find((v) => v.id === versionId);
    if (version) return { tariff, version };
  }
  return null;
}

interface Structure {
  kind?: string;
  unit?: string;
  tiers?: { fromUnits: string; toUnits: string | null; pricePerUnit: string }[] | null;
  flatPricePerUnit?: string | null;
  ft?: { pricePerUnit: string; period: string } | null;
  serviceCharge?: { amount: string } | null;
  minimumCharge?: { amount: string } | null;
  vat?: { rate: string; included: boolean };
  ceilingPerUnit?: string;
  capBasis?: string;
  needsCheck?: string[];
}

/** The API's `validateTariffStructure` (getproperty-api src/core/utility-tariffs/tariff-structure.ts). */
function structureProblems(s: Structure | null): string[] {
  const problems: string[] = [];
  if (!s || typeof s !== "object") return ["structure must be an object"];
  if (!["tiered", "flat", "tou"].includes(String(s.kind))) problems.push("kind must be tiered | flat | tou");
  if (!["kwh", "m3"].includes(String(s.unit))) problems.push("unit must be kwh | m3");
  if (s.kind === "tiered") {
    if (!Array.isArray(s.tiers) || s.tiers.length === 0) problems.push("tiered structure needs tiers");
    else {
      let expectedFrom = "0";
      s.tiers.forEach((tier, i) => {
        if (tier.fromUnits !== expectedFrom) problems.push(`tiers[${i}].fromUnits must be ${expectedFrom}`);
        if (tier.toUnits === null && i !== s.tiers!.length - 1) problems.push(`tiers[${i}] is open-ended but not last`);
        if (tier.toUnits !== null && Number(tier.toUnits) <= Number(tier.fromUnits))
          problems.push(`tiers[${i}] is empty`);
        expectedFrom = tier.toUnits ?? expectedFrom;
      });
      if (s.tiers[s.tiers.length - 1]?.toUnits !== null)
        problems.push("the last tier must be open-ended (toUnits null)");
    }
  }
  if (s.kind === "flat" && !s.flatPricePerUnit) problems.push("flat structure needs flatPricePerUnit");
  if (!s.vat || typeof s.vat.rate !== "string") problems.push("vat.rate is required");
  if (s.capBasis !== "effective_average_rate") problems.push("capBasis must be effective_average_rate (D-140)");
  return problems;
}

/** The charge of `units` at a structure (mock of the API's tariff math, excl. VAT). */
function charge(structure: Structure, units: number): Schemas["TariffChargeDto"] {
  const lines: Schemas["TariffChargeLineDto"][] = [];
  let total = 0;
  if (structure.kind === "flat" && structure.flatPricePerUnit) {
    const amount = units * Number(structure.flatPricePerUnit);
    lines.push({
      label: "อัตราคงที่",
      units: units.toFixed(2),
      pricePerUnit: structure.flatPricePerUnit,
      amount: amount.toFixed(4),
    });
    total += amount;
  } else {
    for (const tier of structure.tiers ?? []) {
      const from = Number(tier.fromUnits);
      const to = tier.toUnits === null ? Infinity : Number(tier.toUnits);
      const inTier = Math.max(0, Math.min(units, to) - from);
      if (inTier <= 0) continue;
      const amount = inTier * Number(tier.pricePerUnit);
      lines.push({
        label: `${tier.fromUnits}–${tier.toUnits ?? "∞"}`,
        units: inTier.toFixed(2),
        pricePerUnit: tier.pricePerUnit,
        amount: amount.toFixed(4),
      });
      total += amount;
    }
  }
  if (structure.ft) {
    const amount = units * Number(structure.ft.pricePerUnit);
    lines.push({
      label: `Ft ${structure.ft.period}`,
      units: units.toFixed(2),
      pricePerUnit: structure.ft.pricePerUnit,
      amount: amount.toFixed(4),
    });
    total += amount;
  }
  if (structure.serviceCharge) {
    lines.push({
      label: "ค่าบริการรายเดือน",
      units: null,
      pricePerUnit: null,
      amount: Number(structure.serviceCharge.amount).toFixed(4),
    });
    total += Number(structure.serviceCharge.amount);
  }
  let minimumApplied = false;
  if (structure.minimumCharge && total < Number(structure.minimumCharge.amount)) {
    minimumApplied = true;
    total = Number(structure.minimumCharge.amount);
  }
  return {
    units: units.toFixed(2),
    lines,
    totalExVat: total.toFixed(2),
    minimumApplied,
    effectiveAverageRate: units > 0 ? (total / units).toFixed(4) : null,
  };
}

const tariffHandlers: HttpHandler[] = [
  http.get("*/v1/admin/utility-tariffs", ({ request }) => {
    const ok = platform(request, "admin.utilityTariffs.list", [
      "admin.utility_tariff.enter",
      "admin.utility_tariff.verify",
    ]);
    if (ok instanceof Response) return ok;
    return json(
      w().tariffs.map((tariff) => ({
        ...tariff,
        versions: tariff.versions.map((version) => ({
          ...version,
          // Actions are the caller's: the maker of a version is never offered `verify` (D-021a two-person rule).
          nextActions: version.nextActions.filter((a) => !(a === "verify" && version.enteredBy === ok.userId)),
        })),
      })),
    );
  }),
  http.post("*/v1/admin/utility-tariffs/:tariffId/versions", ({ request, params }) => {
    const op = "admin.utilityTariffs.enter";
    const ok = platform(request, op, "admin.utility_tariff.enter");
    if (ok instanceof Response) return ok;
    const tariff = w().tariffs.find((t) => t.id === params.tariffId);
    if (!tariff) return notFound(op);
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["TariffEnterDto"] & { structure: Structure };
      const problems = structureProblems(payload.structure);
      if (problems.length)
        return problem(op, "tariff.invalid_structure", {
          errors: problems.map((message) => ({ path: "structure", code: "structure", message })),
        });
      if ((tariff.utility === "electric") !== (payload.structure.unit === "kwh"))
        return problem(op, "tariff.invalid_structure", {
          errors: [{ path: "structure.unit", code: "unit", message: `unit must match the ${tariff.utility} utility` }],
        });
      if (!/^https?:\/\//.test(payload.sourceUrl ?? ""))
        return validation(op, "sourceUrl", "the published source (URL)");
      if (tariff.versions.some((v) => v.effectiveFrom === payload.effectiveFrom)) return problem(op, "http.conflict");
      const version: Schemas["TariffVersionDto"] = {
        id: crypto.randomUUID(),
        state: "entered",
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: null,
        ceilingPerUnit: payload.structure.ceilingPerUnit ?? "0",
        sourceUrl: payload.sourceUrl,
        sourceDocumentId: payload.sourceDocumentId ?? null,
        notes: payload.notes ?? null,
        needsCheck: (payload.structure.needsCheck ?? []).length > 0,
        enteredBy: ok.userId,
        verifiedBy: null,
        publishedAt: null,
        structure: payload.structure as Record<string, never>,
        nextActions: ["verify"],
      };
      tariff.versions.unshift(version);
      audit(ok, "utility_tariff.entered", { type: "platform.utility_tariff_version", id: version.id });
      return { status: 201, body: version };
    });
  }),
  http.post("*/v1/admin/utility-tariffs/versions/:versionId/actions/verify", async ({ request, params }) => {
    const op = "admin.utilityTariffs.verify";
    const ok = platform(request, op, "admin.utility_tariff.verify");
    if (ok instanceof Response) return ok;
    const found = findVersion(String(params.versionId));
    if (!found) return notFound(op);
    const input = await body<Schemas["TariffVerifyDto"]>(request);
    record(op, request, input);
    const { version } = found;
    if (version.state !== "entered") return problem(op, "tariff.invalid_state");
    if (version.enteredBy === ok.userId) return problem(op, "tariff.same_verifier");
    version.state = "verified";
    version.needsCheck = false;
    version.verifiedBy = ok.userId;
    if (input.notes) version.notes = input.notes;
    version.nextActions = tariffActions(version);
    audit(ok, "utility_tariff.verified", { type: "platform.utility_tariff_version", id: version.id });
    return json(version);
  }),
  http.post("*/v1/admin/utility-tariffs/versions/:versionId/actions/publish", ({ request, params }) => {
    const op = "admin.utilityTariffs.publish";
    const ok = platform(request, op, "admin.utility_tariff.verify");
    if (ok instanceof Response) return ok;
    const found = findVersion(String(params.versionId));
    if (!found) return notFound(op);
    record(op, request, {});
    const { tariff, version } = found;
    if (version.state !== "verified") return problem(op, "tariff.invalid_state");
    const previous = tariff.versions.find(
      (v) =>
        v.state === "published" &&
        v.effectiveFrom < version.effectiveFrom &&
        (!v.effectiveTo || v.effectiveTo > version.effectiveFrom),
    );
    if (previous) {
      previous.state = "superseded";
      previous.effectiveTo = version.effectiveFrom;
    }
    version.state = "published";
    version.publishedAt = now();
    version.nextActions = [];
    audit(ok, "utility_tariff.published", { type: "platform.utility_tariff_version", id: version.id });
    emit("utility_tariff.published", { versionId: version.id }, "admin");
    return json(version);
  }),
  // `GET /v1/admin/utility-tariffs/versions/{versionId}/charge?units=` (admin.utilityTariffs.sampleCharge,
  // D-214): the sample bill at a version in any state. Answers a `TariffChargeDto`.
  http.get("*/v1/admin/utility-tariffs/versions/:versionId/charge", ({ request, params }) => {
    const op = "admin.utilityTariffs.sampleCharge";
    const ok = platform(request, op, ["admin.utility_tariff.enter", "admin.utility_tariff.verify"]);
    if (ok instanceof Response) return ok;
    const found = findVersion(String(params.versionId));
    if (!found) return notFound(op);
    const units = Number(query(request).get("units"));
    if (!(units > 0 && units <= 100_000)) return validation(op, "units", "more than 0");
    return json(charge(found.version.structure as Structure, units));
  }),
];

const settingHandlers: HttpHandler[] = [
  // D-279: every tenant's latest storage snapshot (the mock shows a spread of levels for review)
  http.get("*/v1/admin/storage/tenants", ({ request }) => {
    const ok = platform(request, "admin.storage.tenants", ["admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const GB = 1024 ** 3;
    const rows = [
      ["0199f2a0-0000-7000-8000-000000000001", "หอพักตัวอย่าง", "apartment", 4.4 * GB],
      ["0199f2a0-0000-7000-8000-000000000101", "บ้านเช่าคุณสมชาย", "landlord", 0.3 * GB],
      ["0199f2a0-0000-7000-8000-000000000102", "เดอะวิว คอนโด", "condo_juristic", 5.6 * GB],
      ["0199f2a0-0000-7000-8000-000000000103", "พรอพเพอร์ตี้ พลัส", "pm_company", 1.9 * GB],
    ] as const;
    const data = rows
      .map(([tenantId, displayName, type, used]) => {
        const allowance = 5 * GB;
        const usedPercent = Math.floor((used / allowance) * 100);
        return {
          tenantId,
          displayName,
          type,
          day: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10),
          usedBytes: String(Math.round(used)),
          fileBytes: String(Math.round(used * 0.92)),
          allowanceBytes: String(allowance),
          usedPercent,
          level: (usedPercent > 100 ? "over" : usedPercent === 100 ? "full" : usedPercent >= 80 ? "warning" : "ok") as
            "ok" | "warning" | "full" | "over",
        };
      })
      .sort((a, b) => Number(b.usedBytes) - Number(a.usedBytes));
    return json({
      data,
      totals: {
        tenants: data.length,
        usedBytes: String(data.reduce((sum, r) => sum + Number(r.usedBytes), 0)),
        nearOrOver: data.filter((r) => r.level !== "ok").length,
      },
    } satisfies Schemas["AdminStorageOverviewDto"]);
  }),
  http.get("*/v1/admin/settings", ({ request }) => {
    const ok = platform(request, "admin.settings.list", ["admin.setting.manage", "admin.compliance.manage"]);
    if (ok instanceof Response) return ok;
    return json(w().settings);
  }),
  http.put("*/v1/admin/settings/:key", async ({ request, params }) => {
    const op = "admin.settings.update";
    const ok = platform(request, op, ["admin.setting.manage", "admin.compliance.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const setting = w().settings.find((s) => s.key === params.key);
    if (!setting) return problem(op, "settings.unknown_key");
    const input = await body<Schemas["SettingUpdateDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "required");
    const effectiveFrom = input.effectiveFrom ?? now();
    if (Date.parse(effectiveFrom) < Date.now() - 60_000) return problem(op, "settings.backdated");
    const valid =
      setting.valueType === "int"
        ? Number.isInteger(input.value)
        : setting.valueType === "bool"
          ? typeof input.value === "boolean"
          : setting.valueType === "string"
            ? typeof input.value === "string"
            : true;
    if (!valid) return problem(op, "settings.invalid_value");
    if (Date.parse(effectiveFrom) <= Date.now() + 60_000) {
      setting.value = input.value as Schemas["SettingDefinitionDto"]["value"];
      setting.effectiveFrom = effectiveFrom;
    }
    audit(
      ok,
      "setting.changed",
      { type: "platform.setting", id: setting.key },
      { after: { value: input.value, effectiveFrom } },
    );
    return json({
      key: setting.key,
      scope: "platform",
      effectiveFrom,
      versionId: crypto.randomUUID(),
    } satisfies Schemas["SettingVersionDto"]);
  }),
];

function render(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    let node: unknown = data;
    for (const part of path.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    return node === undefined || node === null ? "" : String(node);
  });
}

const templateHandlers: HttpHandler[] = [
  http.get("*/v1/admin/notification-templates", ({ request }) => {
    const ok = platform(request, "admin.notificationTemplates.list", "admin.notification_template.manage");
    if (ok instanceof Response) return ok;
    return json(w().templates);
  }),
  http.post("*/v1/admin/notification-templates/versions", async ({ request }) => {
    const op = "admin.notificationTemplates.createVersion";
    const ok = platform(request, op, "admin.notification_template.manage");
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["TemplateVersionCreateDto"]>(request);
    record(op, request, input);
    if (!input.body?.trim()) return validation(op, "body", "required");
    if (/\{\{[^}]*$/.test(input.body)) return problem(op, "notification.template_invalid");
    let template = w().templates.find(
      (t) => t.key === input.key && t.channel === input.channel && t.audience === input.audience,
    );
    if (!template) {
      template = {
        id: crypto.randomUUID(),
        key: input.key,
        audience: input.audience,
        channel: input.channel,
        description: input.description ?? "",
        versions: [],
      };
      w().templates.push(template);
    }
    const version = Math.max(0, ...template.versions.map((v) => v.version)) + 1;
    template.versions.unshift({
      id: crypto.randomUUID(),
      version,
      state: "draft",
      language: input.language,
      format: input.format,
      subject: input.subject ?? null,
      body: input.body,
      sampleData: (input.sampleData ?? template.versions[0]?.sampleData ?? {}) as Record<string, never>,
      publishedAt: null,
    });
    return json(template, 201);
  }),
  http.post("*/v1/admin/notification-templates/versions/:versionId/actions/preview", async ({ request, params }) => {
    const op = "admin.notificationTemplates.preview";
    const ok = platform(request, op, "admin.notification_template.manage");
    if (ok instanceof Response) return ok;
    const version = w()
      .templates.flatMap((t) => t.versions)
      .find((v) => v.id === params.versionId);
    if (!version) return notFound(op);
    const input = await body<Schemas["TemplatePreviewDto"]>(request);
    const data = (input.data ?? version.sampleData) as Record<string, unknown>;
    return json({
      format: version.format,
      subject: version.subject ? render(version.subject, data) : null,
      text: render(version.body, data),
    } satisfies Schemas["RenderedMessageDto"]);
  }),
  http.post("*/v1/admin/notification-templates/versions/:versionId/actions/publish", ({ request, params }) => {
    const op = "admin.notificationTemplates.publish";
    const ok = platform(request, op, "admin.notification_template.manage");
    if (ok instanceof Response) return ok;
    const template = w().templates.find((t) => t.versions.some((v) => v.id === params.versionId));
    const version = template?.versions.find((v) => v.id === params.versionId);
    if (!template || !version) return notFound(op);
    if (version.state !== "draft") return problem(op, "http.conflict");
    for (const other of template.versions)
      if (other.state === "published" && other.language === version.language) other.state = "retired";
    version.state = "published";
    version.publishedAt = now();
    audit(ok, "notification_template.published", { type: "platform.notification_template_version", id: version.id });
    return json(template);
  }),
  http.post("*/v1/admin/notification-templates/:templateId/actions/test-send", async ({ request, params }) => {
    const op = "admin.notificationTemplates.testSend";
    const ok = platform(request, op, "admin.notification_template.manage");
    if (ok instanceof Response) return ok;
    const template = w().templates.find((t) => t.id === params.templateId);
    if (!template) return notFound(op);
    const input = await body<Schemas["TestSendDto"]>(request);
    record(op, request, input);
    w().testSends.push({ templateId: template.id, recipientUserId: input.recipientUserId ?? ok.userId });
    return json({ eventId: crypto.randomUUID() } satisfies Schemas["AcceptedDto"], 202);
  }),
];

const privacyHandlers: HttpHandler[] = [
  http.post("*/v1/admin/data-subject-requests/:requestId/actions/:action", async ({ request, params }) => {
    const op = "admin.dataSubjectRequests.transition";
    const ok = platform(request, op, "admin.dsr.manage");
    if (ok instanceof Response) return ok;
    const dsr = w().dsrs.find((candidate) => candidate.id === params.requestId);
    if (!dsr) return notFound(op);
    if (dsr.tenantId !== null) return problem(op, "dsr.tenant_controlled");
    const action = String(params.action) as Schemas["DsrAction"];
    if (!dsr.nextActions.includes(action)) return problem(op, "workflow.invalid_transition");
    const input = await body<Schemas["DsrActionDto"]>(request);
    const notes = input.notes?.trim() || null;
    if (action === "reject" && !notes) return validation(op, "notes", "the reason");
    record(op, request, input);
    const next: Record<Schemas["DsrAction"], { state: Schemas["DsrState"]; actions: string[] }> = {
      verify: { state: "verifying", actions: ["start", "reject"] },
      start: { state: "in_progress", actions: ["fulfil", "reject"] },
      fulfil: { state: "fulfilled", actions: [] },
      reject: { state: "rejected", actions: [] },
    };
    dsr.state = next[action].state;
    dsr.nextActions = next[action].actions;
    if (notes) dsr.notes = notes;
    if (action === "fulfil") {
      dsr.fulfilledAt = now();
      if (dsr.kind === "access" || dsr.kind === "portability") {
        const file: Schemas["FileDto"] = platformFile({
          kind: "export",
          title: `dsr-${dsr.id.slice(0, 8)}.json`,
          mimeType: "application/json",
          sizeBytes: 2048,
        });
        file.scanStatus = "clean";
        file.uploadState = "verified";
        state.staff.files.set(file.id, { file, bytes: null });
        dsr.exportDocumentId = file.id;
      }
    }
    audit(ok, `dsr.${action}`, { type: "privacy.data_subject_request", id: dsr.id });
    return json(dsr);
  }),
  http.post("*/v1/admin/files/presign", async ({ request }) => {
    const op = "admin.files.presign";
    const ok = platform(request, op, ["admin.utility_tariff.enter", "admin.tenant.manage", "admin.dsr.manage"]);
    if (ok instanceof Response) return ok;
    const input = await body<Partial<Schemas["AdminFilePresignDto"]>>(request);
    if (!input.kind || !input.fileName || !input.mimeType || !input.sizeBytes || !input.sha256)
      return validation(op, "body", "kind, fileName, mimeType, sizeBytes and sha256 are required");
    if (!["tariff_source", "contract", "other"].includes(input.kind)) return validation(op, "kind", "a platform kind");
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(input.mimeType))
      return problem(op, "document.type_not_allowed");
    const file = platformFile({
      kind: input.kind,
      title: input.title ?? input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });
    state.staff.files.set(file.id, { file, bytes: null });
    return json(
      {
        file,
        uploadUrl: `${new URL(request.url).origin}/__upload/${file.id}`,
        headers: { "Content-Type": input.mimeType },
        multipart: null,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      } satisfies Schemas["FilePresignedDto"],
      201,
    );
  }),
  http.post("*/v1/admin/files/:fileId/actions/complete", ({ request, params }) => {
    const op = "admin.files.complete";
    const ok = platform(request, op, ["admin.utility_tariff.enter", "admin.tenant.manage", "admin.dsr.manage"]);
    if (ok instanceof Response) return ok;
    const stored = state.staff.files.get(String(params.fileId));
    if (!stored || stored.file.scopeType !== "platform") return notFound(op);
    if (!stored.bytes) return problem(op, "document.not_uploaded");
    if (stored.bytes.byteLength !== stored.file.sizeBytes) return problem(op, "document.size_mismatch");
    stored.file = { ...stored.file, uploadState: "verified", scanStatus: "clean" };
    return json(stored.file);
  }),
  http.get("*/v1/admin/files/:fileId", ({ request, params }) => {
    const op = "admin.files.get";
    const ok = platform(request, op, ["admin.tenant.read", "admin.dsr.manage", "admin.utility_tariff.enter"]);
    if (ok instanceof Response) return ok;
    const stored = state.staff.files.get(String(params.fileId));
    // A tenant file is 404 here; a platform file answers once it is clean.
    if (!stored || stored.file.scopeType !== "platform") return notFound(op);
    if (stored.file.scanStatus !== "clean") return problem(op, "document.scan_pending");
    const origin = new URL(request.url).origin;
    return json({
      file: stored.file,
      url: `${origin}/__files/${stored.file.mimeType === "application/pdf" ? `pdf-${stored.file.id}` : stored.file.id}`,
      thumbnailUrl: null,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    } satisfies Schemas["FileDownloadDto"]);
  }),
  http.get("*/v1/admin/data-subject-requests", ({ request }) => {
    const ok = platform(request, "admin.dataSubjectRequests.list", "admin.dsr.manage");
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("state");
    return json(w().dsrs.filter((dsr) => !wanted || dsr.state === wanted));
  }),
  http.get("*/v1/admin/audit-log", ({ request }) => {
    const op = "admin.auditLog.list";
    const ok = platform(request, op, "admin.audit.read");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const action = params.get("action");
    const from = params.get("from");
    const to = params.get("to");
    const rows = w().audit.filter((row) => {
      if (action) {
        if (action.endsWith("*") ? !row.action.startsWith(action.slice(0, -1)) : row.action !== action) return false;
      }
      if (params.get("subjectId") && row.subjectId !== params.get("subjectId")) return false;
      if (params.get("actorId") && (row.actor as { id?: string }).id !== params.get("actorId")) return false;
      if (params.get("tenantId")) {
        const tenantId = params.get("tenantId");
        if (row.subjectId !== tenantId && (row.metadata as { tenantId?: string }).tenantId !== tenantId) return false;
      }
      if (from && row.occurredAt < new Date(from).toISOString()) return false;
      if (to && row.occurredAt > new Date(to).toISOString()) return false;
      return true;
    });
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 50));
    const cursor = params.get("cursor");
    let start = 0;
    if (cursor) {
      try {
        start = Number(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")).offset);
      } catch {
        return problem(op, "pagination.cursor_invalid");
      }
      if (!Number.isInteger(start) || start < 0) return problem(op, "pagination.cursor_invalid");
    }
    const page = rows.slice(start, start + limit);
    const next =
      start + limit < rows.length ? Buffer.from(JSON.stringify({ offset: start + limit })).toString("base64url") : null;
    return json({ data: page, meta: { nextCursor: next } });
  }),
  http.get("*/v1/admin/integration-events", ({ request }) => {
    const ok = platform(request, "admin.integrationEvents.list", "admin.integration_event.read");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const list = w()
      .integrationEvents.filter((event) => !params.get("state") || event.state === params.get("state"))
      .filter((event) => !params.get("system") || event.system === params.get("system"))
      .filter((event) => !params.get("direction") || event.direction === params.get("direction"))
      .filter((event) => !params.get("tenantId") || event.tenantId === params.get("tenantId"))
      .filter((event) => !q || event.type.toLowerCase().startsWith(q) || event.id === q)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return json(paged(list, request));
  }),
  http.get("*/v1/admin/outbox/messages", ({ request }) => {
    const ok = platform(request, "admin.outbox.messages", "admin.outbox.manage");
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("state");
    return json(w().outbox.filter((m) => !wanted || m.state === wanted));
  }),
  http.post("*/v1/admin/outbox/messages/:messageId/actions/replay", ({ request, params }) => {
    const op = "admin.outbox.replayMessage";
    const ok = platform(request, op, "admin.outbox.manage");
    if (ok instanceof Response) return ok;
    const message = w().outbox.find((m) => m.id === params.messageId);
    if (!message) return notFound(op);
    record(op, request, {});
    if (message.state !== "dead" && message.state !== "failed") return problem(op, "outbox.not_replayable");
    message.state = "published";
    message.attempts += 1;
    message.lastError = null;
    audit(ok, "outbox.replayed", { type: "platform.outbox", id: message.id });
    return json(message);
  }),
  http.get("*/v1/admin/outbox/dead-letters", ({ request }) => {
    const ok = platform(request, "admin.outbox.deadLetters", "admin.outbox.manage");
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("state");
    return json(w().consumptions.filter((c) => !wanted || c.state === wanted));
  }),
  http.post("*/v1/admin/outbox/dead-letters/:deadLetterId/actions/replay", ({ request, params }) => {
    const op = "admin.outbox.replayDeadLetter";
    const ok = platform(request, op, "admin.outbox.manage");
    if (ok instanceof Response) return ok;
    const consumption = w().consumptions.find((c) => c.id === params.deadLetterId);
    if (!consumption) return notFound(op);
    record(op, request, {});
    if (consumption.state === "processed") return problem(op, "outbox.not_replayable");
    consumption.state = "processed";
    consumption.attempts += 1;
    consumption.lastError = null;
    consumption.replayedAt = now();
    audit(ok, "outbox.dead_letter_replayed", { type: "platform.event_consumption", id: consumption.id });
    return json(consumption);
  }),
];

const userHandlers: HttpHandler[] = [
  http.get("*/v1/admin/platform-users", ({ request }) => {
    const ok = platform(request, "admin.platformUsers.list", "admin.user.manage");
    if (ok instanceof Response) return ok;
    return json(w().platformUsers);
  }),
  http.post("*/v1/admin/platform-users", ({ request }) => {
    const op = "admin.platformUsers.create";
    const ok = platform(request, op, "admin.user.manage");
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["PlatformUserCreateDto"];
      if (!/^[^@\s]+@[^@\s]+$/.test(payload.email ?? "")) return validation(op, "email", "an email address");
      if ((payload.temporaryPassword ?? "").length < 12) return problem(op, "auth.weak_password");
      if (w().platformUsers.some((u) => u.email === payload.email)) return problem(op, "http.conflict");
      const user: Schemas["PlatformUserDto"] = {
        id: crypto.randomUUID(),
        displayName: payload.displayName,
        email: payload.email,
        roles: payload.roles.map((role) => ({ role, expiresAt: null })),
        status: "active",
        totpEnabled: false,
        lastLoginAt: null,
      };
      w().platformUsers.push(user);
      audit(ok, "platform_user.created", { type: "core.user_account", id: user.id });
      return { status: 201, body: user };
    });
  }),
  http.post("*/v1/admin/platform-users/:userId/roles", async ({ request, params }) => {
    const op = "admin.platformUsers.grantRole";
    const ok = platform(request, op, "admin.user.manage");
    if (ok instanceof Response) return ok;
    const user = w().platformUsers.find((u) => u.id === params.userId);
    if (!user) return notFound(op);
    const input = await body<Schemas["RoleGrantDto"]>(request);
    if (!user.roles.some((r) => r.role === input.role))
      user.roles.push({ role: input.role, expiresAt: input.expiresAt ?? null });
    return noContent();
  }),
  http.delete("*/v1/admin/platform-users/:userId/roles/:role", ({ request, params }) => {
    const op = "admin.platformUsers.revokeRole";
    const ok = platform(request, op, "admin.user.manage");
    if (ok instanceof Response) return ok;
    const user = w().platformUsers.find((u) => u.id === params.userId);
    if (!user) return notFound(op);
    user.roles = user.roles.filter((r) => r.role !== params.role);
    return noContent();
  }),
];

export const operationHandlers: HttpHandler[] = [
  ...tariffHandlers,
  ...settingHandlers,
  ...templateHandlers,
  ...privacyHandlers,
  ...userHandlers,
];

export { charge, structureProblems };
