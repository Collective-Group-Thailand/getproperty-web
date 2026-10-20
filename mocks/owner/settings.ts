import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS, tenantPermissions } from "../fixtures";
import { emit } from "../handlers/realtime";
import { pilotKpis } from "../platform/business";
import { charge } from "../platform/operations";
import { state } from "../state";
import {
  LEGAL_REF,
  body,
  documentDownload,
  etagged,
  idempotent,
  json,
  mutating,
  needsAcknowledgement,
  noContent,
  notFound,
  owner,
  problem,
  query,
  record,
  stale,
  validation,
  type Ok,
} from "./support";
import { day, iso } from "./world";

type Schemas = components["schemas"];

/**
 * F2 2.6 on the owner surface: company data (ETag), settings at tenant and property scope (effective-
 * dated, never backdated), receiving bank accounts with the SMS OTP step (fake code 123456), rate plans
 * with the D-021a cap check against the platform's published tariff (`utility-tariffs/current`),
 * members and invitations, resident notification routing, the operator's consents, the DSR inbox,
 * support grants (shared with the admin world), the tenant audit log, asset grants, and the
 * subscription read from the platform world (plan, usage, platform invoices with QR and PDF, hardware,
 * site surveys, upgrade). The owner tenant and its platform records are one: what the admin changes
 * in `state.platform`, the owner reads here.
 */

const w = () => state.owner;
const p = () => state.platform;
const OTP_CODE = "123456";

function roleOf(ok: Ok): Schemas["TenantRole"] | null {
  const membership = ok.persona.memberships.find((m) => TENANTS[m.tenant].profile.id === ok.tenantId);
  return membership?.role ?? null;
}

function allowed(ok: Ok, op: string, permission: string): Response | null {
  const role = roleOf(ok);
  return role && tenantPermissions(role).includes(permission) ? null : problem(op, "auth.forbidden");
}

const tenantProfile = (tenantId: string) => p().tenants.find((tenant) => tenant.id === tenantId) ?? null;

// ---------------------------------------------------------------------------------------------------
// Company data & settings

const companyHandlers: HttpHandler[] = [
  http.get("*/v1/owner/tenant", ({ request }) => {
    const ok = owner(request, "owner.tenant.get");
    if (ok instanceof Response) return ok;
    const profile = tenantProfile(ok.tenantId);
    return profile ? etagged(profile) : notFound("owner.tenant.get");
  }),
  http.patch("*/v1/owner/tenant", async ({ request }) => {
    const op = "owner.tenant.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.update");
    if (forbidden) return forbidden;
    const profile = tenantProfile(ok.tenantId);
    if (!profile) return notFound(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (request.headers.get("if-match") !== "*" && stale(request, profile)) return problem(op, "concurrency.stale");
    const input = await body<Schemas["TenantUpdateDto"]>(request);
    record(op, request, input);
    if (input.taxId && !/^\d{13}$/.test(input.taxId)) return validation(op, "taxId", "13 digits");
    if (input.displayName !== undefined && !input.displayName.trim()) return validation(op, "displayName", "required");
    Object.assign(profile, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)));
    profile.version += 1;
    return etagged(profile);
  }),
];

function settingsAt(propertyId: string | null): Schemas["SettingDto"][] {
  const overrides = propertyId ? (w().propertySettings[propertyId] ?? {}) : {};
  return w().settings.map((setting) => {
    const own = overrides[setting.key];
    return own
      ? { ...setting, value: own.value, scope: "property" as const, effectiveFrom: own.effectiveFrom }
      : setting;
  });
}

function checkValue(setting: Schemas["SettingDto"], value: unknown): boolean {
  switch (setting.valueType) {
    case "int":
      return Number.isInteger(value);
    case "bool":
      return typeof value === "boolean";
    case "decimal":
    case "money":
      return typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value);
    case "string":
      return setting.key === "billing.estimate_policy"
        ? value === "allow" || value === "block"
        : typeof value === "string";
    default:
      return value !== undefined && value !== null;
  }
}

function saveSetting(request: Request, op: string, scope: "tenant" | "property", propertyId: string | null) {
  return async ({ params }: { params: Record<string, string | readonly string[] | undefined> }) => {
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const setting = w().settings.find((candidate) => candidate.key === params.key);
    if (!setting) return problem(op, "settings.unknown_key");
    if (!setting.editable || !setting.scopeAllowed.includes(scope)) return problem(op, "settings.not_editable");
    const input = await body<Schemas["SettingUpdateDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "required");
    if (input.effectiveFrom && new Date(input.effectiveFrom).getTime() < Date.now() - 60_000)
      return problem(op, "settings.backdated");
    if (!checkValue(setting, input.value)) return problem(op, "settings.invalid_value");
    const effectiveFrom = input.effectiveFrom ?? new Date().toISOString();
    const scheduled = new Date(effectiveFrom).getTime() > Date.now() + 60_000;
    // A version scheduled for later does not change what is in force now (the API keeps both).
    if (!scheduled) {
      if (scope === "tenant") Object.assign(setting, { value: input.value, scope: "tenant", effectiveFrom });
      else (w().propertySettings[propertyId!] ??= {})[setting.key] = { value: input.value, effectiveFrom };
    }
    return json({
      key: setting.key,
      scope,
      effectiveFrom,
      versionId: crypto.randomUUID(),
    } satisfies Schemas["SettingVersionDto"]);
  };
}

const settingHandlers: HttpHandler[] = [
  http.get("*/v1/owner/settings", ({ request }) => {
    const ok = owner(request, "owner.settings.list");
    if (ok instanceof Response) return ok;
    const propertyId = query(request).get("propertyId");
    if (propertyId && !w().properties.some((property) => property.id === propertyId))
      return notFound("owner.settings.list");
    return json(settingsAt(propertyId));
  }),
  http.put("*/v1/owner/settings/:key", (info) =>
    saveSetting(info.request, "owner.settings.update", "tenant", null)(info),
  ),
  http.put("*/v1/owner/properties/:propertyId/settings/:key", async (info): Promise<Response> => {
    const propertyId = String(info.params.propertyId);
    if (!w().properties.some((property) => property.id === propertyId))
      return notFound("owner.propertySettings.update");
    return saveSetting(info.request, "owner.propertySettings.update", "property", propertyId)(info);
  }),
];

// ---------------------------------------------------------------------------------------------------
// Bank accounts (D-042: OTP to the owner's phone)

const bankActions = (account: Schemas["BankAccountDto"]) =>
  account.state === "pending_otp" ? ["confirm", "resend-otp", "remove"] : account.state === "active" ? ["remove"] : [];

function challenge(accountId: string): Schemas["OtpChallengeDto"] {
  const otp = { challengeId: crypto.randomUUID(), expiresAt: iso(5 / 1440), resendAvailableAt: iso(30 / 86_400) };
  w().bankOtps.set(accountId, otp);
  return otp;
}

const mask = (accountNo: string) =>
  `xxx-x-x${accountNo.slice(-4, -1)}${accountNo.slice(-1)}-x`.replace(/-x$/, `-${accountNo.slice(-1)}`);

const bankHandlers: HttpHandler[] = [
  http.get("*/v1/owner/bank-accounts", ({ request }) => {
    const ok = owner(request, "owner.bankAccounts.list");
    if (ok instanceof Response) return ok;
    return json(ok.own ? w().bankAccounts : []);
  }),
  http.post("*/v1/owner/bank-accounts", async ({ request }) => {
    const op = "owner.bankAccounts.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.bank_account.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["BankAccountCreateDto"];
      if (!/^\d{10,15}$/.test(input.accountNo ?? "")) return validation(op, "accountNo", "10–15 digits");
      if (!input.accountName?.trim()) return validation(op, "accountName", "required");
      if (!/^\d{3}$/.test(input.bankCode ?? "")) return validation(op, "bankCode", "a bank code");
      const account: Schemas["BankAccountDto"] = {
        id: crypto.randomUUID(),
        bankCode: input.bankCode,
        bankNameTh: input.bankNameTh,
        accountNoMasked: mask(input.accountNo),
        accountName: input.accountName,
        branch: input.branch ?? null,
        buildingIds: input.buildingIds ?? [],
        isDefault: input.isDefault,
        paymentProvider: input.paymentProvider ?? "none",
        state: "pending_otp",
        confirmedAt: null,
        createdAt: iso(),
        nextActions: [],
      };
      account.nextActions = bankActions(account);
      w().bankAccounts.push(account);
      return {
        status: 201,
        body: { account, otp: challenge(account.id) } satisfies Schemas["BankAccountRequestedDto"],
      };
    });
  }),
  http.post("*/v1/owner/bank-accounts/:accountId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    const ops: Record<string, string> = {
      confirm: "owner.bankAccounts.confirm",
      "resend-otp": "owner.bankAccounts.resendOtp",
      remove: "owner.bankAccounts.remove",
    };
    const op = ops[action];
    if (!op) return notFound("owner.bankAccounts.list");
    const ok = action === "resend-otp" ? owner(request, op) : mutating(request, op);
    if (ok instanceof Response) return ok;
    const account = ok.own ? w().bankAccounts.find((candidate) => candidate.id === params.accountId) : undefined;
    if (!account) return notFound(op);
    const input = await body<Schemas["OtpVerifyDto"]>(request);
    record(op, request, input);
    if (!account.nextActions.includes(action)) return problem(op, "bank_account.invalid_state");
    if (action === "resend-otp") return json(challenge(account.id));
    if (action === "confirm") {
      const open = w().bankOtps.get(account.id);
      if (!open || open.challengeId !== input.challengeId) return problem(op, "auth.otp_expired");
      if (input.code !== OTP_CODE) return problem(op, "auth.otp_invalid");
      w().bankOtps.delete(account.id);
      if (account.isDefault)
        for (const other of w().bankAccounts)
          if (other !== account && other.state === "active") other.isDefault = false;
      account.state = "active";
      account.confirmedAt = iso();
    } else {
      account.state = "removed";
    }
    account.nextActions = bankActions(account);
    return json(account);
  }),
];

// ---------------------------------------------------------------------------------------------------
// Utility tariffs in force (from the platform's published versions) and rate plans with the cap check

interface TariffStructure {
  kind?: string;
  unit?: string;
  tiers?: { fromUnits: string; toUnits: string | null; pricePerUnit: string }[] | null;
  flatPricePerUnit?: string | null;
  ft?: { pricePerUnit: string; period: string } | null;
  serviceCharge?: { amount: string } | null;
  minimumCharge?: { amount: string } | null;
}

function tariffsInForce(
  utility: string,
  provider: string,
  tariffCode: string | null,
  units: number | null,
): Schemas["CurrentTariffDto"][] {
  const today = day();
  return p()
    .tariffs.filter(
      (tariff) =>
        tariff.utility === utility && tariff.provider === provider && (!tariffCode || tariff.tariffCode === tariffCode),
    )
    .flatMap((tariff) => {
      const version = tariff.versions.find(
        (v) => v.state === "published" && v.effectiveFrom <= today && (!v.effectiveTo || v.effectiveTo > today),
      );
      if (!version) return [];
      return [
        {
          tariffId: tariff.id,
          utility: tariff.utility,
          provider: tariff.provider,
          tariffCode: tariff.tariffCode,
          nameTh: tariff.nameTh,
          versionId: version.id,
          effectiveFrom: version.effectiveFrom,
          effectiveTo: version.effectiveTo,
          state: version.state,
          sourceUrl: version.sourceUrl,
          ceilingPerUnit: version.ceilingPerUnit,
          capBasis: "effective_average_rate",
          structure: version.structure,
          charge: units === null ? null : charge(version.structure as TariffStructure, units),
        } satisfies Schemas["CurrentTariffDto"],
      ];
    });
}

/** The representative consumption of `compliance.tariff_cap.representative_units` (D-194). */
function representative(utility: "electric" | "water"): number {
  const value = w().settings.find((s) => s.key === "compliance.tariff_cap.representative_units")?.value as
    Record<string, string> | undefined;
  return Number(value?.[utility] ?? (utility === "electric" ? 150 : 10));
}

function ratePrice(tiers: Record<string, unknown>, units: number): number | null {
  if (tiers.kind === "flat") return Number(tiers.pricePerUnit);
  if (tiers.kind === "tiered" && Array.isArray(tiers.tiers)) {
    let total = 0;
    for (const tier of tiers.tiers as { fromUnits: string; toUnits: string | null; pricePerUnit: string }[]) {
      const inTier = Math.max(
        0,
        Math.min(units, tier.toUnits === null ? Infinity : Number(tier.toUnits)) - Number(tier.fromUnits),
      );
      total += inTier * Number(tier.pricePerUnit);
    }
    return units > 0 ? total / units : null;
  }
  return null;
}

const ratePlanEtag = (plan: Schemas["RatePlanDto"]) => `"v${plan.version}-${plan.id.slice(-6)}"`;

const tariffHandlers: HttpHandler[] = [
  http.get("*/v1/owner/utility-tariffs/current", ({ request }) => {
    const op = "owner.utilityTariffs.current";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const utility = params.get("utility");
    const provider = params.get("provider");
    if (!utility || !provider) return validation(op, utility ? "provider" : "utility", "required");
    const units = params.get("units");
    if (units !== null && !/^\d{1,6}(\.\d{1,3})?$/.test(units)) return validation(op, "units", "a decimal string");
    const rows = tariffsInForce(utility, provider, params.get("tariffCode"), units === null ? null : Number(units));
    return rows.length ? json(rows) : problem(op, "tariff.not_found");
  }),
  http.get("*/v1/owner/rate-plans", ({ request }) => {
    const ok = owner(request, "owner.ratePlans.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    return json(
      (ok.own ? w().ratePlans : []).filter(
        (plan) =>
          (!params.get("kind") || plan.kind === params.get("kind")) &&
          (!params.get("buildingId") || plan.buildingId === params.get("buildingId")),
      ),
    );
  }),
  http.post("*/v1/owner/rate-plans", async ({ request }) => {
    const op = "owner.ratePlans.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "rate_plan.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["RatePlanCreateDto"]>(request);
    record(op, request, input);
    if (!input.name?.trim()) return validation(op, "name", "required");
    const plan: Schemas["RatePlanDto"] = {
      id: crypto.randomUUID(),
      kind: input.kind,
      name: input.name.trim(),
      buildingId: input.buildingId ?? null,
      isDefault: input.isDefault ?? false,
      version: 1,
      versions: [],
    };
    w().ratePlans.push(plan);
    return json(plan, 201, { etag: ratePlanEtag(plan) });
  }),
  http.get("*/v1/owner/rate-plans/:planId", ({ request, params }) => {
    const ok = owner(request, "owner.ratePlans.get");
    if (ok instanceof Response) return ok;
    const plan = ok.own ? w().ratePlans.find((candidate) => candidate.id === params.planId) : undefined;
    return plan ? json(plan, 200, { etag: ratePlanEtag(plan) }) : notFound("owner.ratePlans.get");
  }),
  http.patch("*/v1/owner/rate-plans/:planId", async ({ request, params }) => {
    const op = "owner.ratePlans.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const plan = ok.own ? w().ratePlans.find((candidate) => candidate.id === params.planId) : undefined;
    if (!plan) return notFound(op);
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) return problem(op, "concurrency.precondition_required");
    if (ifMatch !== "*" && ifMatch !== ratePlanEtag(plan)) return problem(op, "concurrency.stale");
    const input = await body<Schemas["RatePlanUpdateDto"]>(request);
    record(op, request, input);
    if (input.name !== undefined) plan.name = input.name.trim();
    if (input.isDefault !== undefined) {
      if (input.isDefault)
        for (const other of w().ratePlans) if (other.kind === plan.kind && other !== plan) other.isDefault = false;
      plan.isDefault = input.isDefault;
    }
    plan.version += 1;
    return json(plan, 200, { etag: ratePlanEtag(plan) });
  }),
  http.delete("*/v1/owner/rate-plans/:planId", ({ request, params }) => {
    const op = "owner.ratePlans.remove";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const index = ok.own ? w().ratePlans.findIndex((candidate) => candidate.id === params.planId) : -1;
    if (index < 0) return notFound(op);
    if (w().ratePlans[index]!.versions.some((version) => version.inForce)) return problem(op, "rate_plan.in_use");
    w().ratePlans.splice(index, 1);
    return noContent();
  }),
  http.post("*/v1/owner/rate-plans/:planId/versions", async ({ request, params }) => {
    const op = "owner.ratePlans.saveVersion";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "rate_plan.manage");
    if (forbidden) return forbidden;
    const plan = ok.own ? w().ratePlans.find((candidate) => candidate.id === params.planId) : undefined;
    if (!plan) return notFound(op);
    const input = await body<Schemas["RatePlanVersionCreateDto"]>(request);
    record(op, request, input);
    const effectiveFrom = input.effectiveFrom ?? day();
    if (effectiveFrom < day()) return problem(op, "rate_plan.backdated");
    const tiers = input.tiers as Record<string, unknown>;
    if (!tiers || typeof tiers.kind !== "string") return validation(op, "tiers", "tiers with a kind");
    let capCheck: Record<string, unknown> | null = null;
    let aboveCap = false;
    let acknowledgementId: string | null = null;
    if (plan.kind === "power" || plan.kind === "water") {
      const utility = plan.kind === "power" ? "electric" : "water";
      const units = representative(utility);
      const tenantRate = ratePrice(tiers, units);
      const reference = tariffsInForce(utility, utility === "electric" ? "mea" : "mwa", null, units)[0];
      const utilityRate = reference?.charge?.effectiveAverageRate ?? null;
      if (tenantRate !== null && utilityRate !== null) {
        aboveCap = tenantRate > Number(utilityRate);
        capCheck = {
          aboveCap,
          effectiveAverageRate: utilityRate,
          provider: reference!.provider,
          representativeUnits: units.toFixed(3),
          tariffCode: reference!.tariffCode,
          tenantRate: tenantRate.toFixed(4),
          utilityTariffVersionId: reference!.versionId,
        };
        if (aboveCap) {
          const warning = needsAcknowledgement(
            op,
            "compliance.tariff_cap",
            {
              tenantRate: tenantRate.toFixed(4),
              effectiveAverageRate: utilityRate,
              representativeUnits: String(units),
            },
            input.acknowledgementIds,
            LEGAL_REF.tariffCap,
          );
          if (warning) return warning;
          acknowledgementId =
            w().acknowledgements.find(
              (ack) => ack.ruleId === "compliance.tariff_cap" && input.acknowledgementIds?.includes(ack.id),
            )?.id ?? null;
        }
      }
    }
    if (plan.kind === "water" && input.minimumCharge && Number(input.minimumCharge) > 150)
      return problem(op, "compliance.water_minimum", { legalRef: LEGAL_REF.tariffCap });
    if (plan.versions.some((version) => version.inForce && version.effectiveFrom === effectiveFrom))
      return problem(op, "rate_plan.version_in_force");
    plan.versions = plan.versions.filter((version) => version.effectiveFrom !== effectiveFrom);
    const today = effectiveFrom <= day();
    if (today)
      for (const version of plan.versions)
        if (version.inForce) Object.assign(version, { inForce: false, effectiveTo: effectiveFrom });
    plan.versions.unshift({
      id: crypto.randomUUID(),
      basis: input.basis,
      tiers: tiers as Record<string, never>,
      minimumCharge: input.minimumCharge ?? null,
      note: input.note ?? null,
      effectiveFrom,
      effectiveTo: null,
      inForce: today,
      aboveCap,
      capCheck: capCheck as Record<string, never> | null,
      complianceAcknowledgementId: acknowledgementId,
    });
    plan.version += 1;
    return json(plan, 201, { etag: ratePlanEtag(plan) });
  }),
];

// ---------------------------------------------------------------------------------------------------
// Members & invitations

const memberHandlers: HttpHandler[] = [
  http.get("*/v1/owner/members", ({ request }) => {
    const ok = owner(request, "owner.members.list");
    if (ok instanceof Response) return ok;
    return json(p().members[ok.tenantId] ?? []);
  }),
  http.patch("*/v1/owner/members/:membershipId", async ({ request, params }) => {
    const op = "owner.members.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.member.manage");
    if (forbidden) return forbidden;
    const members = p().members[ok.tenantId] ?? [];
    const member = members.find((candidate) => candidate.id === params.membershipId);
    if (!member) return notFound(op);
    const input = await body<Schemas["MemberUpdateDto"]>(request);
    record(op, request, input);
    if (
      member.role === "owner" &&
      input.role &&
      input.role !== "owner" &&
      members.filter((m) => m.role === "owner" && m.status === "active").length < 2
    )
      return problem(op, "membership.last_owner");
    if (input.role) member.role = input.role;
    if (input.status) member.status = input.status;
    if (input.buildingIds !== undefined) member.buildingIds = input.buildingIds;
    return json(member);
  }),
  http.delete("*/v1/owner/members/:membershipId", ({ request, params }) => {
    const op = "owner.members.remove";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.member.manage");
    if (forbidden) return forbidden;
    const members = p().members[ok.tenantId] ?? [];
    const member = members.find((candidate) => candidate.id === params.membershipId);
    if (!member) return notFound(op);
    record(op, request, {});
    if (member.role === "owner" && members.filter((m) => m.role === "owner" && m.status === "active").length < 2)
      return problem(op, "membership.last_owner");
    member.status = "removed";
    return noContent();
  }),
  http.get("*/v1/owner/invitations", ({ request }) => {
    const ok = owner(request, "owner.invitations.list");
    if (ok instanceof Response) return ok;
    return json(ok.own ? w().invitations : []);
  }),
  http.post("*/v1/owner/invitations", async ({ request }) => {
    const op = "owner.invitations.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.member.invite");
    if (forbidden) return forbidden;
    const input = await body<Schemas["InvitationCreateDto"]>(request);
    record(op, request, input);
    if (input.channel === "sms" && !/^\+66\d{9}$/.test(input.phone ?? ""))
      return validation(op, "phone", "a Thai mobile number");
    if (input.channel === "email" && !/^[^@\s]+@[^@\s]+$/.test(input.email ?? ""))
      return validation(op, "email", "an email address");
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const invitation: Schemas["InvitationCreatedDto"] = {
      id: crypto.randomUUID(),
      role: input.role,
      channel: input.channel,
      phoneMasked: input.phone ? `${input.phone.slice(0, 4)} xx-xxx-${input.phone.slice(-4)}` : null,
      email: input.email ?? null,
      buildingIds: input.buildingIds ?? [],
      state: "pending",
      createdAt: iso(),
      expiresAt: iso(7),
      acceptedAt: null,
      nextActions: ["revoke"],
      code,
      inviteUrl: `${new URL(request.url).origin.replace(/:\d+$/, "")}/join?code=${code}`,
    };
    const { code: _code, inviteUrl: _url, ...stored } = invitation;
    void _code;
    void _url;
    w().invitations.unshift(stored);
    return json(invitation, 201);
  }),
  http.post("*/v1/owner/invitations/:invitationId/actions/revoke", ({ request, params }) => {
    const op = "owner.invitations.revoke";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const invitation = ok.own ? w().invitations.find((candidate) => candidate.id === params.invitationId) : undefined;
    if (!invitation) return notFound(op);
    record(op, request, {});
    if (invitation.state !== "pending") return problem(op, "invitation.not_pending");
    invitation.state = "revoked";
    invitation.nextActions = [];
    return json(invitation);
  }),
];

// ---------------------------------------------------------------------------------------------------
// Notification routes, consents, DSRs, support grants, audit log, asset grants

const dsrActions = (state: Schemas["DsrState"]): string[] =>
  state === "received"
    ? ["verify", "start", "reject"]
    : state === "verifying"
      ? ["start", "reject"]
      : state === "in_progress"
        ? ["fulfil", "reject"]
        : [];

const supportActions = (grant: Schemas["SupportGrantDto"]): string[] =>
  grant.state === "requested"
    ? ["approve", "deny"]
    : grant.state === "approved" || grant.state === "active"
      ? ["revoke"]
      : [];

function ownerAudit(ok: Ok, action: string, subject: { type: string; id: string }) {
  p().audit.unshift({
    id: crypto.randomUUID(),
    action,
    actor: { type: "user", audience: "operator", id: ok.persona.user.id, displayName: ok.persona.user.displayName },
    subjectType: subject.type,
    subjectId: subject.id,
    outcome: "success",
    occurredAt: iso(),
    ip: "127.0.0.1",
    before: null,
    after: null,
    buildingId: null,
    supportGrantId: null,
    metadata: { tenantId: ok.tenantId },
  });
}

const privacyHandlers: HttpHandler[] = [
  http.get("*/v1/owner/notification-routes", ({ request }) => {
    const ok = owner(request, "owner.notificationRoutes.list");
    if (ok instanceof Response) return ok;
    return json(w().routes);
  }),
  http.put("*/v1/owner/notification-routes", async ({ request }) => {
    const op = "owner.notificationRoutes.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["NotificationRouteUpdateDto"]>(request);
    record(op, request, input);
    const route = w().routes.find(
      (r) => r.eventType === input.eventType && r.channel === input.channel && r.audience === input.audience,
    );
    if (!route) return validation(op, "eventType", "an event with this channel");
    // An urgent message keeps at least one channel (D-063).
    if (
      !input.enabled &&
      route.urgent &&
      w().routes.filter((r) => r.eventType === route.eventType && r.enabled && r !== route).length === 0
    )
      return validation(op, "enabled", "an urgent message keeps at least one channel");
    route.enabled = input.enabled;
    route.overridden = true;
    return json(route);
  }),
  http.get("*/v1/owner/consents", ({ request }) => {
    const ok = owner(request, "owner.consents.list");
    if (ok instanceof Response) return ok;
    return json(w().consents);
  }),
  http.post("*/v1/owner/consents", async ({ request }) => {
    const op = "owner.consents.capture";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["ConsentCaptureDto"]>(request);
    record(op, request, input);
    for (const item of input.items ?? []) {
      const purpose = w().consents.find((c) => c.key === item.purposeKey);
      if (!purpose) return problem(op, "consent.unknown_purpose");
      purpose.granted = item.granted;
      purpose.grantedVersion = item.version;
      purpose.capturedAt = iso();
    }
    return json({ recorded: input.items?.length ?? 0, purposes: w().consents } satisfies Schemas["ConsentCapturedDto"]);
  }),
  http.get("*/v1/owner/data-subject-requests", ({ request }) => {
    const ok = owner(request, "owner.dataSubjectRequests.list");
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("state");
    const manage = roleOf(ok) ? tenantPermissions(roleOf(ok)!).includes("privacy.manage") : false;
    return json(
      p()
        .dsrs.filter((dsr) => dsr.tenantId === ok.tenantId && (!wanted || dsr.state === wanted))
        .map((dsr) => ({ ...dsr, nextActions: manage ? dsrActions(dsr.state) : [] })),
    );
  }),
  http.post("*/v1/owner/data-subject-requests/:requestId/actions/:action", async ({ request, params }) => {
    const op = "owner.dataSubjectRequests.transition";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "privacy.manage");
    if (forbidden) return forbidden;
    const dsr = p().dsrs.find((candidate) => candidate.id === params.requestId && candidate.tenantId === ok.tenantId);
    if (!dsr) return notFound(op);
    const action = String(params.action);
    const input = await body<Schemas["DsrActionDto"]>(request);
    record(op, request, { action, ...input });
    if (!dsrActions(dsr.state).includes(action)) return problem(op, "workflow.invalid_transition");
    if (action === "reject" && !input.notes?.trim()) return problem(op, "workflow.guard_failed");
    dsr.state =
      action === "verify"
        ? "verifying"
        : action === "start"
          ? "in_progress"
          : action === "fulfil"
            ? "fulfilled"
            : "rejected";
    if (input.notes) dsr.notes = input.notes;
    if (action === "fulfil") {
      dsr.fulfilledAt = iso();
      if (dsr.kind === "access" || dsr.kind === "portability") dsr.exportDocumentId = crypto.randomUUID();
    }
    dsr.nextActions = dsrActions(dsr.state);
    ownerAudit(ok, `dsr.${action}`, { type: "core.dsr", id: dsr.id });
    return json(dsr);
  }),
  http.get("*/v1/owner/support-grants", ({ request }) => {
    const ok = owner(request, "owner.supportGrants.list");
    if (ok instanceof Response) return ok;
    const approve = roleOf(ok) ? tenantPermissions(roleOf(ok)!).includes("tenant.support_grant.approve") : false;
    return json(
      p()
        .grants.filter((grant) => grant.tenantId === ok.tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((grant) => ({ ...grant, nextActions: approve ? supportActions(grant) : [] })),
    );
  }),
  http.post("*/v1/owner/support-grants/:grantId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    const op = `owner.supportGrants.${action}`;
    if (!["approve", "deny", "revoke"].includes(action)) return notFound("owner.supportGrants.list");
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.support_grant.approve");
    if (forbidden) return forbidden;
    const grant = p().grants.find((candidate) => candidate.id === params.grantId && candidate.tenantId === ok.tenantId);
    if (!grant) return notFound(op);
    const input = action === "approve" ? await body<Schemas["SupportGrantApproveDto"]>(request) : {};
    record(op, request, input);
    if (!supportActions(grant).includes(action)) return problem(op, "support.invalid_transition");
    if (action === "approve") {
      const hours = Math.min(72, Math.max(1, Number((input as Schemas["SupportGrantApproveDto"]).hours) || 4));
      Object.assign(grant, { state: "active", approvedVia: "in_app", validFrom: iso(), validTo: iso(hours / 24) });
    } else if (action === "deny") grant.state = "denied";
    else Object.assign(grant, { state: "revoked", validTo: iso() });
    grant.nextActions =
      grant.state === "requested" ? ["approve-incident", "revoke"] : grant.state === "active" ? ["revoke"] : [];
    ownerAudit(ok, `support_grant.${action === "approve" ? "approved" : action === "deny" ? "denied" : "revoked"}`, {
      type: "core.support_grant",
      id: grant.id,
    });
    emit("support_grant.changed", { supportGrantId: grant.id, tenantId: grant.tenantId }, "admin");
    return json({ ...grant, nextActions: supportActions(grant) });
  }),
  http.get("*/v1/owner/audit-log", ({ request }) => {
    const op = "owner.auditLog.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const action = params.get("action");
    const from = params.get("from");
    const to = params.get("to");
    const rows = p().audit.filter((row) => {
      const tenant = row.subjectId === ok.tenantId || (row.metadata as { tenantId?: string }).tenantId === ok.tenantId;
      if (!tenant) return false;
      if (action && (action.endsWith("*") ? !row.action.startsWith(action.slice(0, -1)) : row.action !== action))
        return false;
      if (from && row.occurredAt < from) return false;
      if (to && row.occurredAt > to) return false;
      return true;
    });
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 50));
    const start = Number(params.get("cursor") ?? 0) || 0;
    return json({
      data: rows.slice(start, start + limit),
      meta: { nextCursor: start + limit < rows.length ? String(start + limit) : null },
    });
  }),
  http.get("*/v1/owner/asset-grants", ({ request }) => {
    const ok = owner(request, "owner.assetGrants.list");
    if (ok instanceof Response) return ok;
    return json(ok.own ? w().assetGrants : []);
  }),
  http.post("*/v1/owner/asset-grants", async ({ request }) => {
    const op = "owner.assetGrants.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.grant.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["AssetGrantCreateDto"];
      if (!w().buildings.some((building) => building.id === input.buildingId)) return notFound(op);
      if (!/^[0-9a-f-]{36}$/i.test(input.granteeTenantId ?? ""))
        return validation(op, "granteeTenantId", "a tenant id");
      if (input.granteeTenantId === ok.tenantId) return problem(op, "grant.not_allowed");
      const grant: Schemas["AssetGrantDto"] = {
        id: crypto.randomUUID(),
        tenantId: ok.tenantId,
        granteeTenantId: input.granteeTenantId,
        buildingId: input.buildingId,
        unitId: input.unitId ?? null,
        scope: input.unitId ? "unit" : "building",
        access: input.access,
        modules: input.modules ?? [],
        reason: input.reason,
        validFrom: input.validFrom ?? iso(),
        validTo: input.validTo ?? null,
        revokedAt: null,
      };
      w().assetGrants.push(grant);
      return { status: 201, body: grant };
    });
  }),
  http.post("*/v1/owner/asset-grants/:grantId/actions/revoke", async ({ request, params }) => {
    const op = "owner.assetGrants.revoke";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const grant = w().assetGrants.find((candidate) => candidate.id === params.grantId);
    if (!grant) return notFound(op);
    const input = await body<Schemas["ReasonDto"]>(request);
    record(op, request, input);
    if (!input.reason?.trim()) return validation(op, "reason", "required");
    if (grant.revokedAt) return problem(op, "http.conflict");
    grant.revokedAt = iso();
    return json(grant);
  }),
];

// ---------------------------------------------------------------------------------------------------
// Subscription (read from the platform world) and the tenant's insights

function subscriptionOf(tenantId: string) {
  return p().subscriptions.find((sub) => sub.tenantId === tenantId && sub.state !== "cancelled") ?? null;
}

const subscriptionHandlers: HttpHandler[] = [
  http.get("*/v1/owner/subscription", ({ request }) => {
    const ok = owner(request, "owner.subscription.get");
    if (ok instanceof Response) return ok;
    const sub = subscriptionOf(ok.tenantId);
    if (!sub)
      return json({
        subscription: null,
        usageToday: null,
        estimate: null,
        openInvoices: 0,
        nextActions: [],
      } satisfies Schemas["OwnerSubscriptionDto"]);
    const open = p().invoices.filter(
      (invoice) => invoice.tenantId === ok.tenantId && ["issued", "partially_paid", "overdue"].includes(invoice.state),
    ).length;
    const units = ok.own ? w().units.filter((unit) => unit.status === "occupied").length : 0;
    return json({
      subscription: { ...sub, nextActions: [] },
      usageToday: { units, meterPoints: units * 2, buildings: ok.own ? w().buildings.length : 0, ocrImages: 18 },
      estimate: {
        lines: [
          {
            kind: "subscription",
            description: `${sub.plan.nameTh} × ${units} ห้อง`,
            quantity: `${units}.000`,
            unitPrice: "25.0000",
            amount: `${units * 25}.00`,
          },
        ],
        subtotal: `${units * 25}.00`,
        discount: "0.00",
        vatAmount: ((units * 25 * 7) / 100).toFixed(2),
        total: ((units * 25 * 107) / 100).toFixed(2),
      },
      openInvoices: open,
      nextActions:
        sub.plan.key === "apartment_starter" && ["trial", "active", "past_due"].includes(sub.state) ? ["upgrade"] : [],
    } satisfies Schemas["OwnerSubscriptionDto"]);
  }),
  http.get("*/v1/owner/subscription/usage", ({ request }) => {
    const ok = owner(request, "owner.subscription.usage");
    if (ok instanceof Response) return ok;
    const months = [1, 2].map((back) => {
      const date = new Date();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() - back);
      return date.toISOString().slice(0, 7);
    });
    return json(
      months.map((month) => ({
        month: `${month}-01`,
        unitsCounted: 40,
        meterPointsCounted: 80,
        ocrImages: 120,
        unitsByBuilding: {},
        amountComputed: "1000.00",
        lines: [
          {
            kind: "subscription",
            description: "Apartment Starter × 40 ห้อง",
            quantity: "40.000",
            unitPrice: "25.0000",
            amount: "1000.00",
          },
        ],
      })) satisfies Schemas["SubscriptionUsageDto"][],
    );
  }),
  http.get("*/v1/owner/subscription/invoices", ({ request }) => {
    const ok = owner(request, "owner.subscription.invoices");
    if (ok instanceof Response) return ok;
    return json(
      p()
        .invoices.filter((invoice) => invoice.tenantId === ok.tenantId && invoice.state !== "draft")
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    );
  }),
  http.get("*/v1/owner/subscription/invoices/:invoiceId", ({ request, params }) => {
    const ok = owner(request, "owner.subscription.invoice");
    if (ok instanceof Response) return ok;
    const invoice = p().invoices.find(
      (candidate) => candidate.id === params.invoiceId && candidate.tenantId === ok.tenantId,
    );
    return invoice ? json(invoice) : notFound("owner.subscription.invoice");
  }),
  http.get("*/v1/owner/subscription/invoices/:invoiceId/pdf", ({ request, params }) => {
    const op = "owner.subscription.invoicePdf";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const invoice = p().invoices.find(
      (candidate) => candidate.id === params.invoiceId && candidate.tenantId === ok.tenantId,
    );
    if (!invoice) return notFound(op);
    if (!invoice.documentId) return problem(op, "platform_invoice.invalid_state");
    return json(documentDownload(request, invoice.documentId, invoice.number));
  }),
  http.get("*/v1/owner/subscription/hardware", ({ request }) => {
    const ok = owner(request, "owner.subscription.hardware");
    if (ok instanceof Response) return ok;
    return json(
      p()
        .haas.filter((asset) => asset.tenantId === ok.tenantId)
        .map((asset) => ({ ...asset, nextActions: [] })),
    );
  }),
  http.get("*/v1/owner/subscription/site-surveys", ({ request }) => {
    const ok = owner(request, "owner.subscription.siteSurveys");
    if (ok instanceof Response) return ok;
    return json(p().surveys.filter((survey) => survey.tenantId === ok.tenantId));
  }),
  http.post("*/v1/owner/subscription/upgrade", async ({ request }) => {
    const op = "owner.subscription.upgrade";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.subscription.manage");
    if (forbidden) return forbidden;
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["UpgradeRequestDto"];
      const sub = subscriptionOf(ok.tenantId);
      if (!sub) return problem(op, "subscription.not_found");
      if (sub.plan.key !== "apartment_starter") return problem(op, "subscription.invalid_state");
      if (!w().buildings.some((building) => building.id === input.buildingId)) return notFound(op);
      const survey: Schemas["SiteSurveyDto"] = {
        id: crypto.randomUUID(),
        tenantId: ok.tenantId,
        buildingId: input.buildingId,
        targetPlanKey: "apartment_smart",
        state: "requested",
        scheduledFor: null,
        assignedTo: null,
        notes: input.notes ?? null,
        findings: {},
        installOrderId: null,
        createdAt: iso(),
      };
      p().surveys.push(survey);
      emit("site_survey.requested", { surveyId: survey.id, tenantId: ok.tenantId }, "admin");
      return { status: 201, body: survey };
    });
  }),
  // CONTRACT-REQUEST: `GET /v1/owner/pilot-kpis?window=` — the tenant's own pilot KPIs (B6.3 insights,
  // docs/contract-requests.md). Answers the admin's `PilotKpisDto` for the tenant; 404 without a pilot.
  http.get("*/v1/owner/pilot-kpis", ({ request }) => {
    const ok = owner(request, "owner.subscription.get");
    if (ok instanceof Response) return ok;
    const window = query(request).get("window") === "90d" ? "90d" : "30d";
    const kpis = pilotKpis(ok.tenantId, window);
    return kpis ? json(kpis) : notFound("owner.subscription.get");
  }),
];

export const settingsHandlers: HttpHandler[] = [
  ...companyHandlers,
  ...settingHandlers,
  ...bankHandlers,
  ...tariffHandlers,
  ...memberHandlers,
  ...privacyHandlers,
  ...subscriptionHandlers,
];
