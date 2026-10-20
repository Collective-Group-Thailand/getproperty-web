import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { state } from "../state";
import {
  audit,
  body,
  documentDownload,
  idempotent,
  json,
  matches,
  notFound,
  paged,
  platform,
  problem,
  query,
  record,
  validation,
} from "./support";
import { ADMIN_ONLY } from "./world";

type Schemas = components["schemas"];

/**
 * B6.1 / B6.4 on the admin surface (F5 5.1): tenants and their health, subscriptions (change plan,
 * suspend with the typed slug, reinstate, cancel), price plans, platform invoices with payments and
 * maker-checker credit notes, the HaaS register, install orders, site surveys, pilot agreements with
 * their KPIs, AI usage, feature flags per tenant, support grants and the reads they allow.
 */

const w = () => state.platform;
const money = (value: number) => value.toFixed(2);
const now = () => new Date().toISOString();

function tenantOf(id: string) {
  return w().tenants.find((tenant) => tenant.id === id);
}

function subscriptionOf(tenantId: string) {
  return w().subscriptions.find((sub) => sub.tenantId === tenantId && sub.state !== "cancelled");
}

function subscriptionEvent(subscriptionId: string, type: string, data: Record<string, unknown>) {
  const list = (w().subscriptionEvents[subscriptionId] ??= []);
  list.push({ id: crypto.randomUUID(), type, occurredAt: now(), data: data as Record<string, never> });
}

function subscriptionActions(sub: Schemas["SubscriptionDto"]): string[] {
  switch (sub.state) {
    case "trial":
    case "active":
    case "past_due":
      return ["change-plan", "suspend", "cancel"];
    case "suspended":
      return ["reinstate", "cancel"];
    default:
      return [];
  }
}

function planRef(key: string): Schemas["PlanRefDto"] | null {
  const plan = w().plans.find((candidate) => candidate.key === key);
  const version = plan?.versions.find((v) => v.state === "published");
  if (!plan || !version) return null;
  return { key: plan.key, nameTh: plan.nameTh, version: version.version, versionId: version.id };
}

function invoiceActions(invoice: Schemas["PlatformInvoiceDto"]): string[] {
  const open = ["issued", "overdue", "partially_paid"].includes(invoice.state);
  return open ? ["record-payment", "request-credit-note"] : invoice.state === "paid" ? ["request-credit-note"] : [];
}

function refreshInvoice(invoice: Schemas["PlatformInvoiceDto"]) {
  const credited = invoice.creditNotes
    .filter((note) => note.state === "issued")
    .reduce((s, n) => s + Number(n.amount), 0);
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const open = Math.max(0, Number(invoice.total) - credited - paid);
  invoice.creditedTotal = money(credited);
  invoice.paidTotal = money(paid);
  invoice.openAmount = money(open);
  if (open === 0) invoice.state = credited > 0 && paid === 0 ? "credited" : "paid";
  else if (paid > 0) invoice.state = "partially_paid";
  if (open === 0) invoice.qr = null;
  invoice.nextActions = invoiceActions(invoice);
  for (const note of invoice.creditNotes) note.nextActions = note.state === "requested" ? ["approve", "reject"] : [];
}

function healthOf(tenantId: string): Schemas["TenantHealthDto"] | null {
  const tenant = tenantOf(tenantId);
  const base = w().health[tenantId];
  if (!tenant || !base) return null;
  const sub = subscriptionOf(tenantId);
  return {
    ...base,
    tenantId,
    status: tenant.status,
    planKey: sub?.plan.key ?? null,
    subscriptionState: sub?.state ?? null,
  };
}

/** A Support user reads a tenant's data only through an active grant (D-090); a platform admin bypasses it. */
function grantGuard(ok: Exclude<ReturnType<typeof platform>, Response>, op: string, tenantId: string, path: string) {
  if (ok.persona.roles.includes("platform_admin")) {
    audit(ok, "support_grant.bypassed", { type: "core.tenant", id: tenantId }, { tenantId });
    return null;
  }
  const grant = w().grants.find(
    (candidate) =>
      candidate.tenantId === tenantId &&
      candidate.state === "active" &&
      candidate.validTo !== null &&
      Date.parse(candidate.validTo) > Date.now(),
  );
  if (!grant) {
    audit(ok, "support_grant.used", { type: "core.tenant", id: tenantId }, { tenantId, outcome: "denied" });
    return problem(op, "support.grant_required");
  }
  w().audit.unshift({
    id: crypto.randomUUID(),
    action: "support_grant.used",
    actor: { type: "user", audience: "platform", id: ok.userId, supportGrantId: grant.id },
    outcome: "success",
    occurredAt: now(),
    subjectType: "core.tenant",
    subjectId: tenantId,
    buildingId: null,
    ip: "127.0.0.1",
    before: null,
    after: null,
    metadata: { method: "GET", path },
    supportGrantId: grant.id,
  });
  return null;
}

const tenantHandlers: HttpHandler[] = [
  http.get("*/v1/admin/tenants", ({ request }) => {
    const ok = platform(request, "admin.tenants.list", "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const q = query(request).get("q");
    return json(
      paged(
        w().tenants.filter((t) => matches(q, t.displayName, t.slug, t.legalName)),
        request,
      ),
    );
  }),
  http.post("*/v1/admin/tenants", ({ request }) => {
    const op = "admin.tenants.create";
    const ok = platform(request, op, "admin.tenant.manage");
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["TenantCreateDto"];
      if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(payload.slug ?? ""))
        return validation(op, "slug", "lowercase letters, digits and -");
      if (!payload.owner?.phone || !/^\+66\d{8,9}$/.test(payload.owner.phone))
        return validation(op, "owner.phone", "a Thai mobile number in E.164");
      if (w().tenants.some((tenant) => tenant.slug === payload.slug)) return problem(op, "http.conflict");
      const profile: Schemas["TenantProfileDto"] = {
        id: crypto.randomUUID(),
        slug: payload.slug,
        displayName: payload.displayName,
        legalName: payload.legalName,
        legalForm: payload.legalForm,
        type: payload.type,
        status: "active",
        plan: payload.plan ?? null,
        taxId: payload.taxId ?? null,
        vatRegistered: payload.vatRegistered ?? false,
        defaultLanguage: payload.defaultLanguage ?? "th",
        address: payload.address ?? null,
        logoDocumentId: null,
        version: 1,
      };
      w().tenants.push(profile);
      ADMIN_ONLY.add(profile.id);
      w().health[profile.id] = {
        buildings: 0,
        units: 0,
        gateways: { total: 0, online: 0 },
        lastBillingCycle: null,
        openPlatformInvoices: 0,
        overduePlatformAmount: "0.00",
        signals: [],
        trialEndsAt: null,
      };
      audit(
        ok,
        "tenant.created",
        { type: "core.tenant", id: profile.id },
        { tenantId: profile.id, after: { slug: profile.slug } },
      );
      const code = `INV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const invitation: Schemas["InvitationCreatedDto"] = {
        id: crypto.randomUUID(),
        role: "owner",
        channel: "sms",
        state: "pending",
        code,
        inviteUrl: `http://localhost:3000/join?code=${code}`,
        phoneMasked: `${payload.owner.phone.slice(0, 5)}xxx${payload.owner.phone.slice(-3)}`,
        email: null,
        buildingIds: [],
        createdAt: now(),
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        acceptedAt: null,
        nextActions: ["revoke"],
      };
      return { status: 201, body: { tenant: profile, invitation } satisfies Schemas["TenantCreatedDto"] };
    });
  }),
  http.get("*/v1/admin/tenants/:tenantId", ({ request, params }) => {
    const ok = platform(request, "admin.tenants.get", "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const tenant = tenantOf(String(params.tenantId));
    return tenant ? json(tenant) : notFound("admin.tenants.get");
  }),
  http.get("*/v1/admin/tenants/:tenantId/health", ({ request, params }) => {
    const ok = platform(request, "admin.tenants.health", "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const health = healthOf(String(params.tenantId));
    return health ? json(health) : notFound("admin.tenants.health");
  }),
  http.get("*/v1/admin/tenants/:tenantId/members", ({ request, params }) => {
    const op = "admin.tenants.members";
    const ok = platform(request, op, "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantOf(tenantId)) return notFound(op);
    const refused = grantGuard(ok, op, tenantId, new URL(request.url).pathname);
    return refused ?? json(w().members[tenantId] ?? []);
  }),
  http.get("*/v1/admin/tenants/:tenantId/audit-log", ({ request, params }) => {
    const op = "admin.tenants.auditLog";
    const ok = platform(request, op, "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantOf(tenantId)) return notFound(op);
    const refused = grantGuard(ok, op, tenantId, new URL(request.url).pathname);
    if (refused) return refused;
    const action = query(request).get("action");
    const rows = w().audit.filter(
      (row) =>
        (row.subjectId === tenantId || (row.metadata as { tenantId?: string }).tenantId === tenantId) &&
        (!action || (action.endsWith("*") ? row.action.startsWith(action.slice(0, -1)) : row.action === action)),
    );
    return json({ data: rows.slice(0, Number(query(request).get("limit")) || 50), meta: { nextCursor: null } });
  }),
  http.get("*/v1/admin/tenants/:tenantId/feature-flags", ({ request, params }) => {
    const ok = platform(request, "admin.tenants.featureFlags", "admin.tenant.read");
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantOf(tenantId)) return notFound("admin.tenants.featureFlags");
    const flags = Object.fromEntries(
      w().flags.map((flag) => {
        const override = flag.overrides.find((o) => o.tenantId === tenantId);
        return [flag.key, override ? override.enabled : flag.defaultEnabled];
      }),
    );
    return json({ tenantId, flags } satisfies Schemas["TenantFeatureFlagsDto"]);
  }),
  http.put("*/v1/admin/tenants/:tenantId/settings/:key", async ({ request, params }) => {
    const op = "admin.tenants.updateSetting";
    const ok = platform(request, op, "admin.setting.manage");
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantOf(tenantId)) return notFound(op);
    const definition = w().settings.find((s) => s.key === params.key);
    if (!definition) return problem(op, "settings.unknown_key");
    const input = await body<Schemas["SettingUpdateDto"]>(request);
    const effectiveFrom = input.effectiveFrom ?? now();
    if (Date.parse(effectiveFrom) < Date.now() - 60_000) return problem(op, "settings.backdated");
    w().tenantSettings.push({ tenantId, key: definition.key, value: input.value, effectiveFrom, reason: input.reason });
    return json({
      key: definition.key,
      scope: "tenant",
      effectiveFrom,
      versionId: crypto.randomUUID(),
    } satisfies Schemas["SettingVersionDto"]);
  }),
];

const subscriptionHandlers: HttpHandler[] = [
  http.get("*/v1/admin/price-plans", ({ request }) => {
    const ok = platform(request, "admin.pricePlans.list", ["admin.subscription.manage", "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    return json(w().plans);
  }),
  http.get("*/v1/admin/subscriptions", ({ request }) => {
    const ok = platform(request, "admin.subscriptions.list", ["admin.subscription.manage", "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = w().subscriptions.filter(
      (sub) =>
        (!params.get("tenantId") || sub.tenantId === params.get("tenantId")) &&
        (!params.get("state") || sub.state === params.get("state")) &&
        matches(params.get("q"), sub.tenantName, sub.plan.key),
    );
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/subscriptions", ({ request }) => {
    const op = "admin.subscriptions.create";
    const ok = platform(request, op, "admin.subscription.manage");
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["SubscriptionCreateDto"];
      const tenant = tenantOf(payload.tenantId);
      if (!tenant) return notFound(op);
      if (subscriptionOf(tenant.id)) return problem(op, "subscription.exists");
      const plan = w().plans.find((p) => p.key === payload.planKey);
      if (!plan) return problem(op, "price_plan.not_found");
      if (!plan.isActive) return problem(op, "price_plan.not_sold");
      if (plan.tenantType && plan.tenantType !== tenant.type) return problem(op, "subscription.plan_mismatch");
      const ref = planRef(plan.key)!;
      const sub: Schemas["SubscriptionDto"] = {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        tenantName: tenant.displayName,
        plan: ref,
        addons: (payload.addonKeys ?? [])
          .map((key) => planRef(key))
          .filter((r): r is Schemas["PlanRefDto"] => r !== null),
        billingPeriod: payload.billingPeriod ?? "monthly",
        state: "trial",
        readOnly: false,
        startedAt: now(),
        trialEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        activatedAt: null,
        pastDueSince: null,
        suspendedAt: null,
        cancelledAt: null,
        cancelEffectiveDate: null,
        cancelReason: null,
        discountPct: "0.00",
        discountReason: null,
        pilotAgreementId: null,
        nextActions: [],
      };
      sub.nextActions = subscriptionActions(sub);
      w().subscriptions.push(sub);
      tenant.plan = plan.key;
      subscriptionEvent(sub.id, "subscription.created", { plan: plan.key });
      audit(ok, "subscription.created", { type: "platform.subscription", id: sub.id }, { tenantId: tenant.id });
      emit("subscription.state_changed", { subscriptionId: sub.id, tenantId: tenant.id }, "admin");
      return { status: 201, body: sub };
    });
  }),
  http.get("*/v1/admin/subscriptions/:subscriptionId", ({ request, params }) => {
    const ok = platform(request, "admin.subscriptions.get", ["admin.subscription.manage", "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const sub = w().subscriptions.find((s) => s.id === params.subscriptionId);
    return sub ? json(sub) : notFound("admin.subscriptions.get");
  }),
  http.get("*/v1/admin/subscriptions/:subscriptionId/events", ({ request, params }) => {
    const ok = platform(request, "admin.subscriptions.events", ["admin.subscription.manage", "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const sub = w().subscriptions.find((s) => s.id === params.subscriptionId);
    if (!sub) return notFound("admin.subscriptions.events");
    return json([...(w().subscriptionEvents[sub.id] ?? [])].reverse());
  }),
  http.post("*/v1/admin/subscriptions/:subscriptionId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    const op = `admin.subscriptions.${action === "change-plan" ? "changePlan" : action}`;
    if (!["change-plan", "suspend", "reinstate", "cancel"].includes(action)) return notFound("admin.subscriptions.get");
    const ok = platform(request, op, "admin.subscription.manage");
    if (ok instanceof Response) return ok;
    const sub = w().subscriptions.find((s) => s.id === params.subscriptionId);
    if (!sub) return notFound(op);
    const tenant = tenantOf(sub.tenantId)!;
    const apply = (input: Record<string, unknown>): { status: number; body: unknown } | Response => {
      if (!sub.nextActions.includes(action)) return problem(op, "subscription.invalid_state");
      const before = sub.state;
      switch (action) {
        case "change-plan": {
          const ref = planRef(String(input.planKey));
          const plan = w().plans.find((p) => p.key === input.planKey);
          if (!ref || !plan) return problem(op, "price_plan.not_found");
          if (!plan.isActive) return problem(op, "price_plan.not_sold");
          if (plan.tenantType && plan.tenantType !== tenant.type) return problem(op, "subscription.plan_mismatch");
          sub.plan = ref;
          sub.addons = ((input.addonKeys as string[] | undefined) ?? [])
            .map((key) => planRef(key))
            .filter((r): r is Schemas["PlanRefDto"] => r !== null);
          tenant.plan = ref.key;
          subscriptionEvent(sub.id, "subscription.plan_changed", { plan: ref.key, reason: input.reason ?? null });
          break;
        }
        case "suspend":
          if (input.confirm !== tenant.slug) return problem(op, "subscription.confirmation_mismatch");
          if (!String(input.reason ?? "").trim()) return validation(op, "reason", "required");
          sub.state = "suspended";
          sub.readOnly = true;
          sub.suspendedAt = now();
          tenant.status = "read_only";
          break;
        case "reinstate":
          if (!String(input.reason ?? "").trim()) return validation(op, "reason", "required");
          sub.state = "active";
          sub.readOnly = false;
          sub.suspendedAt = null;
          sub.pastDueSince = null;
          tenant.status = "active";
          break;
        case "cancel": {
          if (!String(input.reason ?? "").trim()) return validation(op, "reason", "required");
          const end = new Date();
          sub.cancelEffectiveDate =
            (input.effectiveDate as string | undefined) ??
            new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
          sub.cancelReason = String(input.reason);
          sub.cancelledAt = now();
          sub.state = "cancelled";
          sub.readOnly = true;
          tenant.status = "read_only";
          break;
        }
      }
      if (before !== sub.state)
        subscriptionEvent(sub.id, "subscription.state_changed", { from: before, to: sub.state });
      sub.nextActions = subscriptionActions(sub);
      audit(
        ok,
        `subscription.${action.replace("-", "_")}`,
        { type: "platform.subscription", id: sub.id },
        {
          tenantId: sub.tenantId,
          before: { state: before },
          after: { state: sub.state },
        },
      );
      emit("subscription.state_changed", { subscriptionId: sub.id, tenantId: sub.tenantId }, "admin");
      return { status: 200, body: sub };
    };
    if (action === "cancel") return idempotent(request, op, apply);
    const input = await body<Record<string, unknown>>(request);
    record(op, request, input);
    const answer = apply(input);
    return answer instanceof Response ? answer : json(answer.body, answer.status);
  }),
];

const invoiceHandlers: HttpHandler[] = [
  http.get("*/v1/admin/platform-invoices", ({ request }) => {
    const ok = platform(request, "admin.platformInvoices.list", [
      "admin.platform_invoice.issue",
      "admin.subscription.manage",
    ]);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = w()
      .invoices.filter(
        (inv) =>
          (!params.get("tenantId") || inv.tenantId === params.get("tenantId")) &&
          (!params.get("state") || inv.state === params.get("state")) &&
          matches(params.get("q"), inv.number, inv.tenantName),
      )
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return json(paged(rows, request));
  }),
  http.get("*/v1/admin/platform-invoices/:invoiceId", ({ request, params }) => {
    const ok = platform(request, "admin.platformInvoices.get", [
      "admin.platform_invoice.issue",
      "admin.subscription.manage",
    ]);
    if (ok instanceof Response) return ok;
    const invoice = w().invoices.find((inv) => inv.id === params.invoiceId);
    return invoice ? json(invoice) : notFound("admin.platformInvoices.get");
  }),
  http.get("*/v1/admin/platform-invoices/:invoiceId/pdf", ({ request, params }) => {
    const ok = platform(request, "admin.platformInvoices.pdf", [
      "admin.platform_invoice.issue",
      "admin.subscription.manage",
    ]);
    if (ok instanceof Response) return ok;
    const invoice = w().invoices.find((inv) => inv.id === params.invoiceId);
    if (!invoice) return notFound("admin.platformInvoices.pdf");
    if (!invoice.documentId) return problem("admin.platformInvoices.pdf", "platform_invoice.invalid_state");
    return json(documentDownload(request, invoice.documentId, invoice.number));
  }),
  http.post("*/v1/admin/platform-invoices/:invoiceId/payments", ({ request, params }) => {
    const op = "admin.platformInvoices.recordPayment";
    const ok = platform(request, op, "admin.platform_invoice.issue");
    if (ok instanceof Response) return ok;
    const invoice = w().invoices.find((inv) => inv.id === params.invoiceId);
    if (!invoice) return notFound(op);
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["PlatformPaymentCreateDto"];
      if (!invoice.nextActions.includes("record-payment")) return problem(op, "platform_invoice.invalid_state");
      if (!/^\d+(\.\d{1,2})?$/.test(payload.amount ?? "")) return validation(op, "amount", "a decimal amount");
      if (Number(payload.amount) > Number(invoice.openAmount))
        return problem(op, "platform_invoice.amount_exceeds_open");
      if (!payload.reference?.trim()) return validation(op, "reference", "required");
      invoice.payments.push({
        id: crypto.randomUUID(),
        amount: money(Number(payload.amount)),
        method: payload.method,
        paidAt: payload.paidAt,
        provider: null,
        providerRef: payload.reference,
        receiptDocumentId: crypto.randomUUID(),
        receiptNumber: `PRC-2026-${String(Math.floor(Math.random() * 900000) + 100000)}`,
      });
      refreshInvoice(invoice);
      audit(
        ok,
        "platform_payment.recorded",
        { type: "platform.platform_invoice", id: invoice.id },
        { tenantId: invoice.tenantId },
      );
      emit("platform_payment.confirmed", { invoiceId: invoice.id, tenantId: invoice.tenantId }, "admin");
      return { status: 201, body: invoice };
    });
  }),
  http.post("*/v1/admin/platform-invoices/:invoiceId/credit-notes", ({ request, params }) => {
    const op = "admin.platformInvoices.requestCreditNote";
    const ok = platform(request, op, "admin.platform_invoice.issue");
    if (ok instanceof Response) return ok;
    const invoice = w().invoices.find((inv) => inv.id === params.invoiceId);
    if (!invoice) return notFound(op);
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["PlatformCreditNoteRequestDto"];
      if (!invoice.nextActions.includes("request-credit-note")) return problem(op, "platform_invoice.invalid_state");
      if (!/^\d+(\.\d{1,2})?$/.test(payload.amount ?? "") || Number(payload.amount) <= 0)
        return validation(op, "amount", "a positive decimal amount");
      if (Number(payload.amount) > Number(invoice.total) - Number(invoice.creditedTotal))
        return problem(op, "platform_invoice.amount_exceeds_open");
      if (!payload.reason?.trim()) return validation(op, "reason", "required");
      const note: Schemas["PlatformCreditNoteDto"] = {
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        number: null,
        amount: money(Number(payload.amount)),
        reason: payload.reason,
        state: "requested",
        requestedBy: ok.userId,
        approvedBy: null,
        issuedAt: null,
        nextActions: ["approve", "reject"],
      };
      invoice.creditNotes.push(note);
      audit(
        ok,
        "platform_credit_note.requested",
        { type: "platform.platform_credit_note", id: note.id },
        { tenantId: invoice.tenantId },
      );
      return { status: 201, body: note };
    });
  }),
  http.post("*/v1/admin/platform-invoices/credit-notes/:creditNoteId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    if (action !== "approve" && action !== "reject") return notFound("admin.platformInvoices.get");
    const op =
      action === "approve" ? "admin.platformInvoices.approveCreditNote" : "admin.platformInvoices.rejectCreditNote";
    const ok = platform(request, op, "admin.platform_credit_note.approve");
    if (ok instanceof Response) return ok;
    const invoice = w().invoices.find((inv) => inv.creditNotes.some((n) => n.id === params.creditNoteId));
    const note = invoice?.creditNotes.find((n) => n.id === params.creditNoteId);
    if (!invoice || !note) return notFound(op);
    const decide = (): { status: number; body: unknown } | Response => {
      if (note.state !== "requested") return problem(op, "platform_invoice.invalid_state");
      // Maker-checker (D-091): the person who asked cannot decide.
      if (note.requestedBy === ok.userId) return problem(op, "platform_credit_note.same_approver");
      if (action === "approve") {
        note.state = "issued";
        note.approvedBy = ok.userId;
        note.issuedAt = now();
        note.number = `PCN-2026-${String(invoice.creditNotes.filter((n) => n.number).length + 1).padStart(6, "0")}`;
        emit("platform_credit_note.issued", { invoiceId: invoice.id, tenantId: invoice.tenantId }, "admin");
      } else {
        note.state = "rejected";
        note.approvedBy = ok.userId;
      }
      refreshInvoice(invoice);
      audit(
        ok,
        `platform_credit_note.${action === "approve" ? "issued" : "rejected"}`,
        { type: "platform.platform_credit_note", id: note.id },
        { tenantId: invoice.tenantId },
      );
      return { status: 200, body: note };
    };
    if (action === "approve") return idempotent(request, op, decide);
    record(op, request, {});
    const answer = decide();
    return answer instanceof Response ? answer : json(answer.body, answer.status);
  }),
];

function haasActions(asset: Schemas["HaasAssetDto"]): string[] {
  switch (asset.state) {
    case "allocated":
      return ["install", "write-off"];
    case "installed":
      return ["in-service", "deinstall", "write-off"];
    case "in_service":
      return ["replace", "deinstall", "write-off"];
    default:
      return [];
  }
}

function installActions(order: Schemas["InstallOrderDto"]): string[] {
  switch (order.state) {
    case "open":
      return ["assign", "start", "cancel"];
    case "in_progress":
      return ["assign", "complete-items", "complete", "cancel"];
    default:
      return [];
  }
}

const fieldHandlers: HttpHandler[] = [
  http.get("*/v1/admin/haas-assets", ({ request }) => {
    const ok = platform(request, "admin.haas.list", ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = w().haas.filter(
      (asset) =>
        (!params.get("tenantId") || asset.tenantId === params.get("tenantId")) &&
        (!params.get("state") || asset.state === params.get("state")) &&
        matches(params.get("q"), asset.serial),
    );
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/haas-assets", ({ request }) => {
    const op = "admin.haas.register";
    const ok = platform(request, op, ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["HaasAssetCreateDto"];
      const device = w().devices.find((d) => d.id === payload.deviceId);
      if (!device || !tenantOf(payload.tenantId)) return notFound(op);
      if (device.ownership !== "platform_haas") return problem(op, "haas.not_platform_owned");
      if (device.tenantId && device.tenantId !== payload.tenantId) return problem(op, "haas.tenant_mismatch");
      if (
        w().haas.some(
          (asset) => asset.deviceId === device.id && !["replaced", "deinstalled", "written_off"].includes(asset.state),
        )
      )
        return problem(op, "http.conflict");
      const asset: Schemas["HaasAssetDto"] = {
        id: crypto.randomUUID(),
        tenantId: payload.tenantId,
        deviceId: device.id,
        serial: device.serial,
        kind: device.kind,
        buildingId: payload.buildingId ?? device.buildingId,
        state: "allocated",
        installedOn: null,
        termMonths: payload.termMonths,
        termEnd: null,
        acquisitionCost: payload.acquisitionCost,
        monthlyValue: payload.monthlyValue,
        bookValue: payload.acquisitionCost,
        replacedByAssetId: null,
        deinstallOrderId: null,
        events: [{ type: "allocated", occurredAt: now(), data: {} }],
        nextActions: ["install", "write-off"],
      };
      w().haas.push(asset);
      audit(ok, "haas_asset.registered", { type: "platform.haas_asset", id: asset.id }, { tenantId: asset.tenantId });
      return { status: 201, body: asset };
    });
  }),
  http.get("*/v1/admin/haas-assets/:assetId", ({ request, params }) => {
    const ok = platform(request, "admin.haas.get", ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const asset = w().haas.find((a) => a.id === params.assetId);
    return asset ? json(asset) : notFound("admin.haas.get");
  }),
  http.post("*/v1/admin/haas-assets/:assetId/actions/:action", async ({ request, params }) => {
    const op = "admin.haas.transition";
    const ok = platform(request, op, ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const asset = w().haas.find((a) => a.id === params.assetId);
    if (!asset) return notFound(op);
    const action = String(params.action);
    const input = await body<Schemas["HaasTransitionDto"]>(request);
    record(op, request, input);
    if (!asset.nextActions.includes(action)) return problem(op, "haas.invalid_transition");
    const next: Record<string, Schemas["HaasState"]> = {
      install: "installed",
      "in-service": "in_service",
      replace: "replaced",
      deinstall: "deinstalled",
      "write-off": "written_off",
    };
    asset.state = next[action]!;
    if (action === "install") asset.installedOn = input.date ?? now().slice(0, 10);
    asset.events.push({
      type: asset.state,
      occurredAt: now(),
      data: (input.note ? { note: input.note } : {}) as Record<string, never>,
    });
    asset.nextActions = haasActions(asset);
    emit("haas_asset.changed", { assetId: asset.id, tenantId: asset.tenantId }, "admin");
    return json(asset);
  }),
  http.get("*/v1/admin/install-orders", ({ request }) => {
    const ok = platform(request, "admin.installOrders.list", ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = w().installOrders.filter(
      (order) =>
        (!params.get("tenantId") || order.tenantId === params.get("tenantId")) &&
        (!params.get("state") || order.state === params.get("state")) &&
        (!params.get("kind") || order.kind === params.get("kind")) &&
        matches(params.get("q"), order.buildingName),
    );
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/install-orders", ({ request }) => {
    const op = "admin.installOrders.create";
    const ok = platform(request, op, ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["InstallOrderCreateDto"];
      if (!tenantOf(payload.tenantId)) return notFound(op);
      const order: Schemas["InstallOrderDto"] = {
        id: crypto.randomUUID(),
        tenantId: payload.tenantId,
        buildingId: payload.buildingId,
        buildingName: "อาคาร",
        kind: payload.kind,
        state: "open",
        assignedTo: null,
        dueAt: payload.dueAt ?? null,
        completedAt: null,
        notes: payload.notes ?? null,
        items: payload.items ?? [],
        nextActions: [],
      };
      order.nextActions = installActions(order);
      w().installOrders.push(order);
      return { status: 201, body: order };
    });
  }),
  http.get("*/v1/admin/install-orders/:orderId", ({ request, params }) => {
    const ok = platform(request, "admin.installOrders.get", ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const order = w().installOrders.find((o) => o.id === params.orderId);
    return order ? json(order) : notFound("admin.installOrders.get");
  }),
  http.post("*/v1/admin/install-orders/:orderId/actions/:action", async ({ request, params }) => {
    const op = "admin.installOrders.act";
    const ok = platform(request, op, ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const order = w().installOrders.find((o) => o.id === params.orderId);
    if (!order) return notFound(op);
    const action = String(params.action);
    const input = await body<Schemas["InstallOrderActionDto"]>(request);
    record(op, request, input);
    if (!order.nextActions.includes(action)) return problem(op, "install_order.invalid_transition");
    switch (action) {
      case "assign": {
        const engineer = w().platformUsers.find(
          (user) =>
            user.id === input.assignedTo &&
            user.roles.some((r) => r.role === "field_engineer" || r.role === "platform_admin"),
        );
        if (!engineer) return problem(op, "install_order.assignee_invalid");
        order.assignedTo = engineer.id;
        break;
      }
      case "start":
        order.state = "in_progress";
        break;
      case "complete-items":
        for (const index of input.itemIndexes ?? []) if (order.items[index]) order.items[index]!.done = true;
        break;
      case "complete":
        if (order.items.some((item) => !item.done)) return problem(op, "install_order.items_open");
        order.state = "done";
        order.completedAt = now();
        break;
      case "cancel":
        order.state = "cancelled";
        break;
    }
    order.nextActions = installActions(order);
    emit("install_order.changed", { orderId: order.id, tenantId: order.tenantId }, "admin");
    return json(order);
  }),
  http.get("*/v1/admin/site-surveys", ({ request }) => {
    const ok = platform(request, "admin.siteSurveys.list", ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const params = query(request);
    return json(
      w().surveys.filter(
        (survey) =>
          (!params.get("tenantId") || survey.tenantId === params.get("tenantId")) &&
          (!params.get("state") || survey.state === params.get("state")),
      ),
    );
  }),
  http.post("*/v1/admin/site-surveys/:surveyId/actions/:action", async ({ request, params }) => {
    const op = "admin.siteSurveys.act";
    const ok = platform(request, op, ["admin.device.manage", "admin.subscription.manage"]);
    if (ok instanceof Response) return ok;
    const survey = w().surveys.find((s) => s.id === params.surveyId);
    if (!survey) return notFound(op);
    const action = String(params.action);
    const input = await body<Schemas["SiteSurveyActionDto"]>(request);
    record(op, request, input);
    const allowed: Record<string, Schemas["SiteSurveyState"][]> = {
      schedule: ["requested", "scheduled"],
      complete: ["requested", "scheduled"],
      cancel: ["requested", "scheduled"],
    };
    if (!allowed[action]?.includes(survey.state)) return problem(op, "install_order.invalid_transition");
    if (action === "schedule") {
      survey.state = "scheduled";
      survey.scheduledFor = input.scheduledFor ?? null;
      survey.assignedTo = input.assignedTo ?? survey.assignedTo;
    } else if (action === "cancel") {
      survey.state = "cancelled";
    } else {
      survey.state = "done";
      survey.findings = (input.findings ?? {}) as Record<string, never>;
      if (input.install !== false) {
        const order: Schemas["InstallOrderDto"] = {
          id: crypto.randomUUID(),
          tenantId: survey.tenantId,
          buildingId: survey.buildingId,
          buildingName: "อาคาร B",
          kind: "install",
          state: "open",
          assignedTo: null,
          dueAt: null,
          completedAt: null,
          notes: input.notes ?? null,
          items: [{ deviceKind: "gateway", deviceId: null, assetItemId: null, unitId: null, done: false }],
          nextActions: ["assign", "start", "cancel"],
        };
        w().installOrders.push(order);
        survey.installOrderId = order.id;
      }
    }
    if (input.notes !== undefined) survey.notes = input.notes;
    return json(survey);
  }),
];

const pilotHandlers: HttpHandler[] = [
  http.get("*/v1/admin/tenants/:tenantId/pilot-agreement", ({ request, params }) => {
    const ok = platform(request, "admin.pilots.get", ["admin.subscription.manage", "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const pilot = w().pilots[String(params.tenantId)];
    return pilot ? json(pilot) : notFound("admin.pilots.get");
  }),
  http.put("*/v1/admin/tenants/:tenantId/pilot-agreement", async ({ request, params }) => {
    const op = "admin.pilots.upsert";
    const ok = platform(request, op, "admin.subscription.manage");
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantOf(tenantId)) return notFound(op);
    const input = await body<Schemas["PilotAgreementUpsertDto"]>(request);
    record(op, request, input);
    const pct = Number(input.discountPct);
    if (!(pct >= 0 && pct < 100)) return validation(op, "discountPct", "a paid pilot: 0 ≤ discount < 100 (D-083)");
    if (!input.signedOn) return validation(op, "signedOn", "required");
    const previous = w().pilots[tenantId];
    const signed = new Date(`${input.signedOn}T00:00:00Z`);
    const pilot: Schemas["PilotAgreementDto"] = {
      id: previous?.id ?? crypto.randomUUID(),
      tenantId,
      signedOn: input.signedOn,
      termMonths: input.termMonths,
      discountPct: pct.toFixed(2),
      referenceSiteRights: input.referenceSiteRights ?? previous?.referenceSiteRights ?? false,
      anonymisedDataUse: input.anonymisedDataUse ?? previous?.anonymisedDataUse ?? false,
      feedbackCadence: input.feedbackCadence ?? previous?.feedbackCadence ?? "biweekly",
      kpiReviewOn: input.kpiReviewOn ?? new Date(signed.getTime() + 90 * 86_400_000).toISOString().slice(0, 10),
      baseline: (input.baseline ?? previous?.baseline ?? {}) as Record<string, never>,
      kpiTargets: (input.kpiTargets ?? previous?.kpiTargets ?? {}) as Record<string, never>,
      agreementDocumentId: input.agreementDocumentId ?? null,
      notes: input.notes ?? null,
    };
    w().pilots[tenantId] = pilot;
    const sub = subscriptionOf(tenantId);
    if (sub) {
      sub.discountPct = pilot.discountPct;
      sub.discountReason = "Pilot (D-083)";
      sub.pilotAgreementId = pilot.id;
    }
    audit(ok, "pilot_agreement.saved", { type: "platform.pilot_agreement", id: pilot.id }, { tenantId });
    return json(pilot);
  }),
  http.get("*/v1/admin/tenants/:tenantId/pilot-kpis", ({ request, params }) => {
    const op = "admin.pilots.kpis";
    const ok = platform(request, op, ["admin.subscription.manage", "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    const window = (query(request).get("window") as Schemas["KpiWindow"] | null) ?? "90d";
    const kpis = tenantOf(tenantId) ? pilotKpis(tenantId, window) : null;
    return kpis ? json(kpis) : notFound(op);
  }),
  http.get("*/v1/admin/tenants/:tenantId/ai-usage", ({ request, params }) => {
    const ok = platform(request, "admin.aiUsage.get", "admin.ai_usage.read");
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantOf(tenantId)) return notFound("admin.aiUsage.get");
    return json({ tenantId, months: w().aiUsage[tenantId] ?? [] } satisfies Schemas["AiUsageDto"]);
  }),
];

function grantActions(grant: Schemas["SupportGrantDto"]): string[] {
  if (grant.state === "requested") return ["approve-incident", "revoke"];
  if (grant.state === "active" || grant.state === "approved") return ["revoke"];
  return [];
}

const supportHandlers: HttpHandler[] = [
  http.get("*/v1/admin/support-grants", ({ request }) => {
    const ok = platform(request, "admin.supportGrants.list", [
      "admin.support_grant.request",
      "admin.support_grant.approve_incident",
    ]);
    if (ok instanceof Response) return ok;
    return json([...w().grants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }),
  http.post("*/v1/admin/tenants/:tenantId/support-grants", async ({ request, params }) => {
    const op = "admin.tenants.requestSupportGrant";
    const ok = platform(request, op, "admin.support_grant.request");
    if (ok instanceof Response) return ok;
    const tenantId = String(params.tenantId);
    if (!tenantOf(tenantId)) return notFound(op);
    const input = await body<Schemas["SupportGrantRequestDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "required");
    const grant: Schemas["SupportGrantDto"] = {
      id: crypto.randomUUID(),
      tenantId,
      state: "requested",
      reason: input.reason,
      ticketRef: input.ticketRef ?? null,
      approvedVia: null,
      validFrom: null,
      validTo: null,
      createdAt: now(),
      nextActions: ["approve-incident", "revoke"],
    };
    w().grants.push(grant);
    audit(ok, "support_grant.requested", { type: "core.support_grant", id: grant.id }, { tenantId });
    return json(grant, 201);
  }),
  http.post("*/v1/admin/support-grants/:grantId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    if (action !== "approve-incident" && action !== "revoke") return notFound("admin.supportGrants.revoke");
    const op = action === "revoke" ? "admin.supportGrants.revoke" : "admin.supportGrants.approveIncident";
    const ok = platform(
      request,
      op,
      action === "revoke"
        ? ["admin.support_grant.request", "admin.support_grant.approve_incident"]
        : "admin.support_grant.approve_incident",
    );
    if (ok instanceof Response) return ok;
    const grant = w().grants.find((g) => g.id === params.grantId);
    if (!grant) return notFound(op);
    const input = action === "revoke" ? {} : await body<Schemas["SupportGrantApproveDto"]>(request);
    record(op, request, input);
    if (!grant.nextActions.includes(action)) return problem(op, "support.invalid_transition");
    if (action === "revoke") {
      grant.state = "revoked";
      grant.validTo = now();
    } else {
      const hours = Math.min(24, Math.max(1, Number((input as Schemas["SupportGrantApproveDto"]).hours) || 24));
      grant.state = "active";
      grant.approvedVia = "platform_admin_incident";
      grant.validFrom = now();
      grant.validTo = new Date(Date.now() + hours * 3_600_000).toISOString();
    }
    grant.nextActions = grantActions(grant);
    audit(
      ok,
      `support_grant.${action === "revoke" ? "revoked" : "approved"}`,
      { type: "core.support_grant", id: grant.id },
      { tenantId: grant.tenantId },
    );
    emit("support_grant.changed", { supportGrantId: grant.id, tenantId: grant.tenantId }, "admin");
    return json(grant);
  }),
];

const flagHandlers: HttpHandler[] = [
  http.get("*/v1/admin/feature-flags", ({ request }) => {
    const ok = platform(request, "admin.featureFlags.list", ["admin.feature_flag.manage", "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    return json(w().flags);
  }),
  http.put("*/v1/admin/feature-flags/:key", async ({ request, params }) => {
    const op = "admin.featureFlags.update";
    const ok = platform(request, op, "admin.feature_flag.manage");
    if (ok instanceof Response) return ok;
    const flag = w().flags.find((f) => f.key === params.key);
    if (!flag) return notFound(op);
    const input = await body<Schemas["FeatureFlagChangeDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "required");
    if (input.tenantId) {
      if (!tenantOf(input.tenantId)) return notFound(op);
      flag.overrides = flag.overrides.filter((o) => o.tenantId !== input.tenantId);
      if (input.enabled !== null && input.enabled !== undefined)
        flag.overrides.push({ tenantId: input.tenantId, enabled: input.enabled, reason: input.reason });
    } else {
      if (input.defaultEnabled !== undefined) flag.defaultEnabled = input.defaultEnabled;
      if (input.rolloutPct !== undefined) {
        if (!(input.rolloutPct >= 0 && input.rolloutPct <= 100)) return validation(op, "rolloutPct", "0–100");
        flag.rolloutPct = input.rolloutPct;
      }
    }
    audit(
      ok,
      "feature_flag.changed",
      { type: "platform.feature_flag", id: flag.key },
      { tenantId: input.tenantId ?? null },
    );
    return json(flag);
  }),
];

export const businessHandlers: HttpHandler[] = [
  ...tenantHandlers,
  ...subscriptionHandlers,
  ...invoiceHandlers,
  ...fieldHandlers,
  ...pilotHandlers,
  ...supportHandlers,
  ...flagHandlers,
];

export { healthOf, refreshInvoice, subscriptionOf };

/** A tenant's pilot KPIs over a window (the API's `PilotKpiService`), or `null` without a pilot agreement. */
export function pilotKpis(tenantId: string, window: Schemas["KpiWindow"]): Schemas["PilotKpisDto"] | null {
  const pilot = w().pilots[tenantId];
  if (!pilot) return null;
  const base = pilot.baseline as Schemas["PilotBaselineDto"];
  const current: Schemas["KpiValuesDto"] = {
    timeToBillHours: window === "30d" ? "0.20" : "0.25",
    invoiceCorrectionRatePct: "0.62",
    onTimePaymentPct: "81.25",
    autoReconciledPct: "93.40",
    lossIdentified: true,
    latestLossPct: "2.2706",
    meterUptimePct: "99.71",
    csat: null,
  };
  const kpis: Schemas["KpiResultDto"][] = [
    {
      kpi: "time_to_bill",
      baseline: base.timeToBillHours ?? null,
      current: current.timeToBillHours,
      target: "-80%",
      met: true,
    },
    {
      kpi: "invoice_correction_rate",
      baseline: base.invoiceCorrectionRatePct ?? null,
      current: current.invoiceCorrectionRatePct,
      target: "<1%",
      met: true,
    },
    {
      kpi: "on_time_payment",
      baseline: base.onTimePaymentPct ?? null,
      current: current.onTimePaymentPct,
      target: "+10pts",
      met: true,
    },
    {
      kpi: "auto_reconciled",
      baseline: base.autoReconciledPct ?? null,
      current: current.autoReconciledPct,
      target: ">=90%",
      met: true,
    },
    { kpi: "loss_identified", baseline: false, current: true, target: true, met: true },
    {
      kpi: "meter_uptime",
      baseline: base.meterUptimePct ?? null,
      current: current.meterUptimePct,
      target: ">=99.5%",
      met: true,
    },
    { kpi: "csat", baseline: base.csat ?? null, current: null, target: ">=4.3", met: null },
  ];
  return {
    tenantId,
    window,
    from: new Date(Date.now() - (window === "30d" ? 30 : 90) * 86_400_000).toISOString(),
    to: now(),
    kpiReviewOn: pilot.kpiReviewOn,
    current,
    kpis,
    acceptance: {
      buildingsBillingAutomatically: 1,
      firstFullCycleWithin1h: true,
      paidByQrPct: "72.00",
      serviceRequestsViaLinePct: null,
    },
  };
}
