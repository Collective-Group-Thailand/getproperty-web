import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { add, baht, satang } from "../owner/money";
import { buildingOf, unitOf } from "../staff-world";
import { state } from "../state";
import {
  hours,
  categoryRef,
  slaBreachedOf,
  summaryOf,
  type MockMessage,
  type MockRequest,
  type MockWorkOrder,
} from "./world";
import {
  idempotent,
  json,
  MONEY,
  notFound,
  omit,
  paged,
  problem,
  QTY,
  query,
  r2,
  read,
  reader,
  record,
  type R2Ok,
  type Surface,
  validation,
  visible,
  writer,
} from "./support";

type Schemas = components["schemas"];

/**
 * Service requests, work orders, categories and maintenance plans (B5.1, D-072, D-159, D-210) for the owner
 * and the staff surfaces. The request's lifecycle follows the API's workflow definition `service_request`
 * (triage only from `new`, close / reopen only from `done`, cancel before `done`); work-order actions follow
 * `workOrderActions(…, "operator")`; completing needs an after photo; verification is the owner's.
 */

const OPEN: Schemas["ServiceRequestStatus"][] = ["new", "triaged", "assigned", "in_progress", "waiting_parts"];
const ACTIVE: Schemas["WorkOrderStatus"][] = ["open", "assigned", "accepted", "in_progress"];

function srActions(sr: MockRequest): string[] {
  const out: string[] = [];
  if (sr.status === "new") out.push("triage");
  if (OPEN.includes(sr.status) && !sr.inWarranty) out.push("create-work-order");
  if (sr.status === "done") out.push("close", "reopen");
  if (OPEN.includes(sr.status)) out.push("cancel");
  if (sr.status === "done") out.push("rate");
  return out;
}

/** A landlord's request belongs to its tenant; the rest to the sample apartment (with the Staff building limit). */
export function canSee(ok: R2Ok, sr: MockRequest): boolean {
  if (sr.tenantId) return ok.tenantId === sr.tenantId;
  return visible(ok, sr.buildingId);
}

function srDto(sr: MockRequest): Schemas["ServiceRequestDto"] {
  const dto: Partial<MockRequest> = omit(sr, "timeline");
  delete dto.tenantId;
  delete dto.repair;
  return {
    ...(dto as Schemas["ServiceRequestDto"]),
    slaBreached: slaBreachedOf(sr),
    nextActions: srActions(sr),
    workOrders: r2()
      .workOrders.filter((wo) => wo.serviceRequestId === sr.id)
      .map(summaryOf),
  };
}

function waitingParts(wo: MockWorkOrder): boolean {
  return r2().requests.find((sr) => sr.id === wo.serviceRequestId)?.status === "waiting_parts" || wo.waitingParts;
}

function woActions(wo: MockWorkOrder): string[] {
  switch (wo.status) {
    case "open":
      return ["assign", "cancel"];
    case "assigned":
    case "accepted":
      return ["assign", "check-in", "complete", "cancel"];
    case "in_progress":
      return [waitingParts(wo) ? "resume" : "wait-parts", "complete", "cancel"];
    case "done":
      return ["verify"];
    default:
      return [];
  }
}

function woDto(wo: MockWorkOrder): Schemas["WorkOrderDto"] {
  return { ...omit(wo, "access", "waitingParts"), nextActions: woActions(wo) };
}

/** The request follows its work orders (workflow events assign / start / wait_parts / complete / unassign). */
function moveRequest(wo: MockWorkOrder, event: string, to: Schemas["ServiceRequestStatus"]) {
  const sr = r2().requests.find((candidate) => candidate.id === wo.serviceRequestId);
  if (!sr || sr.status === to) return;
  if (
    to === "done" &&
    r2().workOrders.some((other) => other.serviceRequestId === sr.id && ACTIVE.includes(other.status))
  )
    return;
  sr.timeline.push({ at: new Date().toISOString(), event, from: sr.status, to });
  sr.status = to;
  if (to === "done") {
    sr.doneAt = new Date().toISOString();
    sr.slaDueAt = null;
  }
  sr.version += 1;
}

function assigneeOf(input: { assigneeUserId?: string | null; assigneePartyId?: string | null }, ok: R2Ok) {
  if (input.assigneeUserId) {
    const member = (state.platform.members[ok.tenantId] ?? []).find(
      (candidate) => candidate.userId === input.assigneeUserId && candidate.status === "active",
    );
    if (!member || member.role === "accountant") return "invalid";
    return { id: member.userId, type: "user" as const, displayName: member.displayName };
  }
  if (input.assigneePartyId) {
    const party = state.owner.parties.find((candidate) => candidate.id === input.assigneePartyId);
    if (!party) return "invalid";
    return { id: party.id, type: "party" as const, displayName: party.displayName };
  }
  return null;
}

/** A time-boxed code on the building door for the assignee's visit (D-211: window, else 4 h from the visit). */
function issueVisitCode(wo: MockWorkOrder) {
  const door = r2().locks.find((lock) => lock.buildingId === wo.buildingId && lock.scope === "building_door");
  for (const lock of r2().locks)
    for (const credential of lock.credentials)
      if (credential.workOrderId === wo.id && credential.status === "active") {
        credential.status = "revoked";
        credential.revokedAt = new Date().toISOString();
        credential.revokeReason = "work order re-assigned";
      }
  wo.access = [];
  if (!door || !wo.assignee) return;
  const from = wo.scheduledAt ?? new Date().toISOString();
  const credential: Schemas["CredentialDto"] = {
    id: crypto.randomUUID(),
    lockId: door.id,
    lockName: door.name,
    holderKind: wo.assignee.type === "user" ? "staff" : "technician",
    holderName: wo.assignee.displayName,
    holderPartyId: wo.assignee.type === "party" ? wo.assignee.id : null,
    holderUserId: wo.assignee.type === "user" ? wo.assignee.id : null,
    leaseId: null,
    workOrderId: wo.id,
    unitId: null,
    unitNo: null,
    status: "active",
    type: "pin",
    createdAt: new Date().toISOString(),
    validFrom: from,
    validTo: wo.scheduledUntil ?? new Date(new Date(from).getTime() + 4 * 3_600_000).toISOString(),
    revokedAt: null,
    revokeReason: null,
    vendorError: null,
  };
  door.credentials.push(credential);
  wo.access = [{ ...credential, pin: String(100000 + Math.floor(Math.random() * 899999)) }];
}

function endVisitCodes(wo: MockWorkOrder) {
  for (const lock of r2().locks)
    for (const credential of lock.credentials)
      if (credential.workOrderId === wo.id && credential.status === "active") {
        credential.status = "expired";
        credential.validTo = new Date().toISOString();
      }
  wo.access = wo.access.map((code) => ({ ...code, status: "expired" }));
}

function newWorkOrder(
  op: string,
  input: Schemas["WorkOrderCreateDto"],
  ok: R2Ok,
  sr: MockRequest | null,
): MockWorkOrder | Response {
  if (!input.title?.trim()) return validation(op, "title", "a title");
  if (input.kind === "preventive" && !input.assetItemId)
    return validation(op, "assetItemId", "preventive work needs an asset item");
  if (sr && !OPEN.includes(sr.status)) return problem(op, "service_request.invalid_state");
  const assignee = assigneeOf(input, ok);
  if (assignee === "invalid")
    return validation(op, "assigneeUserId", "a member who handles service requests or a technician party");
  const wo: MockWorkOrder = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    kind: input.kind,
    status: assignee ? "assigned" : "open",
    priority: input.priority ?? sr?.priority ?? "normal",
    serviceRequestId: sr?.id ?? null,
    buildingId: sr?.buildingId ?? input.buildingId ?? "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c",
    unitId: sr?.unitId ?? input.unitId ?? null,
    unitNo: sr?.unitNo ?? null,
    assetItemId: sr?.assetItemId ?? input.assetItemId ?? null,
    description: input.description ?? sr?.description ?? null,
    assignee,
    assignedAt: assignee ? new Date().toISOString() : null,
    acceptedAt: null,
    checkedInAt: null,
    completedAt: null,
    completionNote: null,
    verifiedAt: null,
    cancelledAt: null,
    cancelReason: null,
    scheduledAt: input.scheduledAt ?? null,
    scheduledUntil: input.scheduledUntil ?? null,
    beforePhotoIds: [],
    afterPhotoIds: [],
    costLines: [],
    costTotal: "0.00",
    createdAt: new Date().toISOString(),
    maintenancePlanId: null,
    version: 1,
    access: [],
    waitingParts: false,
  };
  r2().workOrders.unshift(wo);
  if (assignee) {
    issueVisitCode(wo);
    moveRequest(wo, "assign", "assigned");
  }
  emit("work_order.assigned", { aggregateType: "work_order", aggregateId: wo.id }, "staff");
  return wo;
}

const MESSAGE_MAX = 2000;

/** The thread a work order writes into: its request's, else its own (D-218). */
function threadOf(target: { sr: MockRequest } | { wo: MockWorkOrder }): MockMessage[] {
  if ("sr" in target) return r2().messages.filter((message) => message.serviceRequestId === target.sr.id);
  const { wo } = target;
  return wo.serviceRequestId
    ? r2().messages.filter((message) => message.serviceRequestId === wo.serviceRequestId)
    : r2().messages.filter((message) => message.workOrderId === wo.id && message.serviceRequestId === null);
}

const messageDto = (message: MockMessage, ok: R2Ok): Schemas["ServiceMessageDto"] => ({
  ...omit(message, "serviceRequestId", "workOrderId", "authorUserId"),
  mine: message.authorUserId === ok.userId,
});

function serviceHandlers(surface: Surface): HttpHandler[] {
  const base = `*/v1/${surface}`;
  const op = (name: string) => `${surface}.${name}`;
  const findSr = (ok: R2Ok, id: unknown) => r2().requests.find((sr) => sr.id === id && canSee(ok, sr)) ?? null;
  const findWo = (ok: R2Ok, id: unknown) =>
    r2().workOrders.find((wo) => wo.id === id && visible(ok, wo.buildingId)) ?? null;

  /** One work-order step (`…/actions/{name}`) with its allowed-state check. */
  const step = (
    name: string,
    opName: string,
    apply: (wo: MockWorkOrder, input: Record<string, unknown>, ok: R2Ok) => Response | void,
  ) =>
    http.post(`${base}/work-orders/:workOrderId/actions/${name}`, async ({ request, params }) => {
      const id = op(opName);
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const wo = findWo(ok, params.workOrderId);
      if (!wo) return notFound(id);
      if (!woActions(wo).includes(name)) return problem(id, "work_order.invalid_state");
      const input = await read<Record<string, unknown>>(request);
      const refused = apply(wo, input, ok);
      if (refused) return refused;
      wo.version += 1;
      record(id, request, input);
      emit(
        "work_order.changed",
        { aggregateType: "work_order", aggregateId: wo.id },
        surface === "owner" ? "staff" : "owner",
      );
      return json(woDto(wo));
    });

  const srAction = (
    name: string,
    opName: string,
    apply: (sr: MockRequest, input: Record<string, unknown>) => Response | void,
  ) =>
    http.post(`${base}/service-requests/:serviceRequestId/actions/${name}`, async ({ request, params }) => {
      const id = op(opName);
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const sr = findSr(ok, params.serviceRequestId);
      if (!sr) return notFound(id);
      if (!srActions(sr).includes(name)) return problem(id, "workflow.invalid_transition");
      const input = await read<Record<string, unknown>>(request);
      const refused = apply(sr, input);
      if (refused) return refused;
      sr.version += 1;
      record(id, request, input);
      return json(srDto(sr));
    });

  /** `GET|POST …/messages` of a request or a work order (409 once the request ended / the order was cancelled). */
  const threadHandlers = (kind: "service-requests" | "work-orders"): HttpHandler[] => {
    const param = kind === "service-requests" ? "serviceRequestId" : "workOrderId";
    const opBase = kind === "service-requests" ? "serviceRequests" : "workOrders";
    const target = (ok: R2Ok, value: unknown): { sr: MockRequest } | { wo: MockWorkOrder } | null => {
      if (kind === "service-requests") {
        const sr = findSr(ok, value);
        return sr ? { sr } : null;
      }
      const wo = findWo(ok, value);
      return wo ? { wo } : null;
    };
    return [
      http.get(`${base}/${kind}/:${param}/messages`, ({ request, params }) => {
        const id = op(`${opBase}.messages`);
        const ok = reader(request, id);
        if (ok instanceof Response) return ok;
        const found = target(ok, params[param]);
        if (!found) return notFound(id);
        const data = threadOf(found)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((message) => messageDto(message, ok));
        return json({ data } satisfies Schemas["ServiceMessagesDto"]);
      }),
      http.post(`${base}/${kind}/:${param}/messages`, async ({ request, params }) => {
        const id = op(`${opBase}.postMessage`);
        const ok = writer(request, id);
        if (ok instanceof Response) return ok;
        const found = target(ok, params[param]);
        if (!found) return notFound(id);
        return idempotent(
          request,
          id,
          (payload) => {
            const body = typeof payload.body === "string" ? payload.body.trim() : "";
            if (!body || body.length > MESSAGE_MAX)
              return validation(id, "body", `1–${MESSAGE_MAX} characters`, "length");
            const sr =
              "sr" in found
                ? found.sr
                : found.wo.serviceRequestId
                  ? (r2().requests.find((candidate) => candidate.id === found.wo.serviceRequestId) ?? null)
                  : null;
            if (sr && (sr.status === "closed" || sr.status === "cancelled"))
              return problem(id, "service_request.invalid_state");
            if (!sr && "wo" in found && found.wo.status === "cancelled") return problem(id, "work_order.invalid_state");
            const message: MockMessage = {
              id: crypto.randomUUID(),
              serviceRequestId: sr?.id ?? null,
              workOrderId: "wo" in found ? found.wo.id : null,
              author: "office",
              authorName: ok.persona.user.displayName,
              authorUserId: ok.userId,
              body,
              createdAt: new Date().toISOString(),
            };
            r2().messages.push(message);
            emit("service_request.message", {
              aggregateType: sr ? "service_request" : "work_order",
              aggregateId: sr?.id ?? message.workOrderId!,
              messageId: message.id,
            });
            return { status: 201, body: messageDto(message, ok) };
          },
          true,
        );
      }),
    ];
  };

  const reasonOf = (id: string, input: Record<string, unknown>) =>
    typeof input.reason === "string" && input.reason.trim()
      ? input.reason.trim()
      : validation(id, "reason", "a reason");

  return [
    ...threadHandlers("service-requests"),
    ...threadHandlers("work-orders"),
    http.get(`${base}/service-requests`, ({ request }) => {
      const id = op("serviceRequests.list");
      const ok = reader(request, id);
      if (ok instanceof Response) return ok;
      const params = query(request);
      const q = params.get("q")?.toLowerCase();
      const list = r2()
        .requests.filter((sr) => canSee(ok, sr))
        .filter((sr) => !params.get("buildingId") || sr.buildingId === params.get("buildingId"))
        .filter((sr) => !params.get("unitId") || sr.unitId === params.get("unitId"))
        .filter((sr) => !params.get("status") || sr.status === params.get("status"))
        .filter((sr) => !params.get("categoryId") || sr.category.id === params.get("categoryId"))
        .filter((sr) => params.get("open") !== "true" || OPEN.includes(sr.status))
        .filter((sr) => !params.has("slaBreached") || slaBreachedOf(sr) === (params.get("slaBreached") === "true"))
        .filter((sr) => params.get("inWarranty") !== "true" || sr.inWarranty)
        .filter(
          (sr) =>
            !q ||
            sr.ref.toLowerCase().includes(q) ||
            sr.description.toLowerCase().includes(q) ||
            (sr.unitNo ?? "").toLowerCase().includes(q),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(srDto);
      return json(paged(list, request));
    }),
    http.post(`${base}/service-requests`, async ({ request }) => {
      const id = op("serviceRequests.create");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      if (!ok.own) return notFound(id);
      return idempotent(
        request,
        id,
        (payload) => {
          const input = payload as unknown as Schemas["ServiceRequestCreateDto"];
          const unit = input.unitId ? state.owner.units.find((candidate) => candidate.id === input.unitId) : null;
          if (input.unitId && !unit) return notFound(id);
          const buildingId = unit?.buildingId ?? input.buildingId;
          if (!buildingId) return validation(id, "unitId", "a unit or a building");
          if (!visible(ok, buildingId)) return notFound(id);
          const category = r2().categories.find((candidate) => candidate.id === input.categoryId && candidate.isActive);
          if (!category) return validation(id, "categoryId", "an active category");
          if (!input.description?.trim()) return validation(id, "description", "what is wrong");
          if ((input.photoDocumentIds?.length ?? 0) > 10)
            return validation(id, "photoDocumentIds", "at most 10 photos");
          const now = new Date().toISOString();
          const sr: MockRequest = {
            id: crypto.randomUUID(),
            ref: `SR-${now.slice(2, 4)}${now.slice(5, 7)}-${String(r2().requests.length + 1).padStart(4, "0")}`,
            decision: null,
            status: "new",
            category: categoryRef(category.id, r2().categories),
            priority: input.priority ?? "normal",
            description: input.description.trim(),
            buildingId,
            unitId: unit?.id ?? null,
            unitNo: unit?.unitNo ?? null,
            assetItemId: input.assetItemId ?? null,
            reporterKind: surface === "staff" ? "staff" : "owner",
            requesterName: null,
            requesterPartyId: input.requesterPartyId ?? null,
            autoReason: null,
            photoIds: input.photoDocumentIds ?? [],
            createdAt: now,
            triagedAt: null,
            doneAt: null,
            closedAt: null,
            cancelledAt: null,
            cancelReason: null,
            inWarranty: false,
            warrantyResolution: null,
            rating: null,
            ratingComment: null,
            slaHours: category.slaHours,
            slaDueAt: hours(category.slaHours),
            slaBreached: false,
            preferredVisit: input.preferredVisit ?? null,
            visitConfirmedAt: null,
            version: 1,
            nextActions: [],
            workOrders: [],
            timeline: [{ at: now, event: "reported", from: null, to: "new" }],
          };
          r2().requests.unshift(sr);
          return { status: 201, body: srDto(sr) };
        },
        true,
      );
    }),
    http.get(`${base}/service-requests/:serviceRequestId`, ({ request, params }) => {
      const id = op("serviceRequests.get");
      const ok = reader(request, id);
      if (ok instanceof Response) return ok;
      const sr = findSr(ok, params.serviceRequestId);
      return sr ? json(srDto(sr), 200, { etag: `"v${sr.version}-${sr.id.slice(-6)}"` }) : notFound(id);
    }),
    http.get(`${base}/service-requests/:serviceRequestId/timeline`, ({ request, params }) => {
      const id = op("serviceRequests.timeline");
      const ok = reader(request, id);
      if (ok instanceof Response) return ok;
      const sr = findSr(ok, params.serviceRequestId);
      return sr ? json({ data: [...sr.timeline] } satisfies Schemas["ServiceTimelineDto"]) : notFound(id);
    }),
    srAction("triage", "serviceRequests.triage", (sr, input) => {
      const triage = input as Schemas["ServiceTriageDto"];
      if (triage.categoryId) {
        const category = r2().categories.find((candidate) => candidate.id === triage.categoryId);
        if (!category) return validation(op("serviceRequests.triage"), "categoryId", "a category");
        sr.category = categoryRef(category.id, r2().categories);
      }
      if (triage.priority) sr.priority = triage.priority;
      sr.timeline.push({ at: new Date().toISOString(), event: "triage", from: sr.status, to: "triaged" });
      sr.status = "triaged";
      sr.triagedAt = new Date().toISOString();
    }),
    srAction("close", "serviceRequests.close", (sr) => {
      sr.timeline.push({ at: new Date().toISOString(), event: "close", from: sr.status, to: "closed" });
      sr.status = "closed";
      sr.closedAt = new Date().toISOString();
    }),
    srAction("reopen", "serviceRequests.reopen", (sr, input) => {
      const reason = reasonOf(op("serviceRequests.reopen"), input);
      if (reason instanceof Response) return reason;
      sr.timeline.push({ at: new Date().toISOString(), event: "reopen", from: sr.status, to: "triaged" });
      sr.status = "triaged";
      sr.doneAt = null;
      sr.slaDueAt = hours(sr.slaHours);
    }),
    srAction("cancel", "serviceRequests.cancel", (sr, input) => {
      const reason = reasonOf(op("serviceRequests.cancel"), input);
      if (reason instanceof Response) return reason;
      sr.timeline.push({ at: new Date().toISOString(), event: "cancel", from: sr.status, to: "cancelled" });
      sr.status = "cancelled";
      sr.cancelledAt = new Date().toISOString();
      sr.cancelReason = reason;
      sr.slaDueAt = null;
      for (const wo of r2().workOrders)
        if (wo.serviceRequestId === sr.id && ACTIVE.includes(wo.status)) {
          wo.status = "cancelled";
          wo.cancelledAt = new Date().toISOString();
          wo.cancelReason = reason;
          endVisitCodes(wo);
        }
    }),
    http.post(`${base}/service-requests/:serviceRequestId/work-orders`, async ({ request, params }) => {
      const id = op("serviceRequests.createWorkOrder");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const sr = findSr(ok, params.serviceRequestId);
      if (!sr) return notFound(id);
      if (sr.inWarranty) return problem(id, "service_request.in_warranty");
      return idempotent(
        request,
        id,
        (payload) => {
          const wo = newWorkOrder(id, payload as unknown as Schemas["WorkOrderCreateDto"], ok, sr);
          return wo instanceof Response ? wo : { status: 201, body: woDto(wo) };
        },
        true,
      );
    }),

    http.get(`${base}/work-orders`, ({ request }) => {
      const id = op("workOrders.list");
      const ok = reader(request, id);
      if (ok instanceof Response) return ok;
      const params = query(request);
      const q = params.get("q")?.toLowerCase();
      const list = r2()
        .workOrders.filter((wo) => visible(ok, wo.buildingId))
        .filter((wo) => !params.get("buildingId") || wo.buildingId === params.get("buildingId"))
        .filter((wo) => !params.get("status") || wo.status === params.get("status"))
        .filter((wo) => !params.get("kind") || wo.kind === params.get("kind"))
        .filter((wo) => !params.get("serviceRequestId") || wo.serviceRequestId === params.get("serviceRequestId"))
        .filter((wo) => params.get("active") !== "true" || ACTIVE.includes(wo.status))
        .filter((wo) => params.get("mine") !== "true" || (wo.assignee?.type === "user" && wo.assignee.id === ok.userId))
        .filter((wo) => !q || wo.title.toLowerCase().includes(q) || (wo.unitNo ?? "").toLowerCase().includes(q))
        .sort((a, b) => (a.scheduledAt ?? a.createdAt).localeCompare(b.scheduledAt ?? b.createdAt))
        .map(woDto);
      return json(paged(list, request));
    }),
    http.post(`${base}/work-orders`, async ({ request }) => {
      const id = op("workOrders.create");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      if (!ok.own) return notFound(id);
      return idempotent(
        request,
        id,
        (payload) => {
          const input = payload as unknown as Schemas["WorkOrderCreateDto"];
          const sr = input.serviceRequestId ? findSr(ok, input.serviceRequestId) : null;
          if (input.serviceRequestId && !sr) return notFound(id);
          if (input.buildingId && !visible(ok, input.buildingId)) return notFound(id);
          const wo = newWorkOrder(id, input, ok, sr);
          return wo instanceof Response ? wo : { status: 201, body: woDto(wo) };
        },
        true,
      );
    }),
    http.get(`${base}/work-orders/:workOrderId`, ({ request, params }) => {
      const id = op("workOrders.get");
      const ok = reader(request, id);
      if (ok instanceof Response) return ok;
      const wo = findWo(ok, params.workOrderId);
      return wo ? json(woDto(wo), 200, { etag: `"v${wo.version}-${wo.id.slice(-6)}"` }) : notFound(id);
    }),
    step("assign", "workOrders.assign", (wo, input, ok) => {
      const body = input as Schemas["WorkOrderAssignDto"];
      const assignee = assigneeOf(body, ok);
      if (!assignee || assignee === "invalid")
        return validation(op("workOrders.assign"), "assigneeUserId", "a member or a technician party");
      wo.assignee = assignee;
      wo.assignedAt = new Date().toISOString();
      wo.acceptedAt = null;
      wo.status = "assigned";
      if (body.scheduledAt !== undefined) wo.scheduledAt = body.scheduledAt ?? null;
      if (body.scheduledUntil !== undefined) wo.scheduledUntil = body.scheduledUntil ?? null;
      issueVisitCode(wo);
      moveRequest(wo, "assign", "assigned");
    }),
    step("check-in", "workOrders.checkIn", (wo) => {
      wo.status = "in_progress";
      wo.checkedInAt = new Date().toISOString();
      wo.acceptedAt ??= wo.checkedInAt;
      moveRequest(wo, "start", "in_progress");
    }),
    step("wait-parts", "workOrders.waitParts", (wo, input) => {
      wo.waitingParts = true;
      if (typeof input.note === "string" && input.note.trim()) wo.completionNote = input.note.trim();
      moveRequest(wo, "wait_parts", "waiting_parts");
    }),
    step("resume", "workOrders.resume", (wo) => {
      wo.waitingParts = false;
      moveRequest(wo, "start", "in_progress");
    }),
    step("complete", "workOrders.complete", (wo, input) => {
      if (wo.afterPhotoIds.length === 0) return problem(op("workOrders.complete"), "work_order.photo_required");
      wo.status = "done";
      wo.waitingParts = false;
      wo.completedAt = new Date().toISOString();
      wo.checkedInAt ??= wo.completedAt;
      if (typeof input.note === "string" && input.note.trim()) wo.completionNote = input.note.trim();
      endVisitCodes(wo);
      moveRequest(wo, "complete", "done");
    }),
    step("cancel", "workOrders.cancel", (wo, input) => {
      const reason = reasonOf(op("workOrders.cancel"), input);
      if (reason instanceof Response) return reason;
      wo.status = "cancelled";
      wo.cancelledAt = new Date().toISOString();
      wo.cancelReason = reason;
      endVisitCodes(wo);
      const sr = r2().requests.find((candidate) => candidate.id === wo.serviceRequestId);
      if (
        sr &&
        OPEN.includes(sr.status) &&
        !r2().workOrders.some((o) => o.serviceRequestId === sr.id && ACTIVE.includes(o.status))
      )
        moveRequest(wo, "unassign", "triaged");
    }),
    ...(surface === "owner"
      ? [
          step("verify", "workOrders.verify", (wo) => {
            wo.status = "verified";
            wo.verifiedAt = new Date().toISOString();
          }),
        ]
      : []),
    http.post(`${base}/work-orders/:workOrderId/photos`, async ({ request, params }) => {
      const id = op("workOrders.attachPhoto");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const wo = findWo(ok, params.workOrderId);
      if (!wo) return notFound(id);
      if (!["assigned", "accepted", "in_progress", "done"].includes(wo.status))
        return problem(id, "work_order.invalid_state");
      const input = await read<Schemas["WorkOrderPhotoAttachDto"]>(request);
      if (!input.documentId) return validation(id, "documentId", "an uploaded service_photo");
      const list = input.role === "after" ? wo.afterPhotoIds : wo.beforePhotoIds;
      if (list.length >= 10) return validation(id, "documentId", "at most 10 photos per role");
      if (!list.includes(input.documentId)) list.push(input.documentId);
      wo.version += 1;
      record(id, request, input);
      return json(woDto(wo));
    }),
    http.post(`${base}/work-orders/:workOrderId/cost-lines`, async ({ request, params }) => {
      const id = op("workOrders.addCost");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const wo = findWo(ok, params.workOrderId);
      if (!wo) return notFound(id);
      if (["verified", "cancelled"].includes(wo.status)) return problem(id, "work_order.invalid_state");
      const input = await read<Schemas["CostLineCreateDto"]>(request);
      if (!input.description?.trim()) return validation(id, "description", "what was paid for");
      if (!MONEY.test(input.unitPrice ?? "")) return validation(id, "unitPrice", "an amount like 450.00");
      const quantity = input.quantity ?? "1";
      if (!QTY.test(quantity)) return validation(id, "quantity", "a quantity like 1 or 2.5");
      const [whole = "0", fraction = ""] = quantity.split(".");
      const milli = Number(whole) * 1000 + Number((fraction + "000").slice(0, 3));
      const amount = baht(Math.round((satang(input.unitPrice) * milli) / 1000));
      wo.costLines.push({
        id: crypto.randomUUID(),
        kind: input.kind ?? "part",
        description: input.description.trim(),
        quantity,
        unitPrice: input.unitPrice,
        amount,
        receiptDocumentId: input.receiptDocumentId ?? null,
        vendorPartyId: input.vendorPartyId ?? null,
      });
      wo.costTotal = add(...wo.costLines.map((line) => line.amount));
      wo.version += 1;
      record(id, request, input);
      return json(woDto(wo), 201);
    }),
    http.delete(`${base}/work-orders/:workOrderId/cost-lines/:costLineId`, ({ request, params }) => {
      const id = op("workOrders.removeCost");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const wo = findWo(ok, params.workOrderId);
      if (!wo) return notFound(id);
      if (["verified", "cancelled"].includes(wo.status)) return problem(id, "work_order.invalid_state");
      const before = wo.costLines.length;
      wo.costLines = wo.costLines.filter((line) => line.id !== params.costLineId);
      if (wo.costLines.length === before) return notFound(id);
      wo.costTotal = add(...wo.costLines.map((line) => line.amount));
      wo.version += 1;
      return json(woDto(wo));
    }),
    ...(surface === "staff"
      ? [
          http.get(`${base}/work-orders/:workOrderId/access`, ({ request, params }) => {
            const id = op("workOrders.access");
            const ok = reader(request, id);
            if (ok instanceof Response) return ok;
            const wo = findWo(ok, params.workOrderId);
            if (!wo) return notFound(id);
            // Only the assignee's own codes are revealed (D-211).
            const mine = wo.assignee?.type === "user" && wo.assignee.id === ok.userId;
            return json({ data: mine ? wo.access : [] } satisfies Schemas["RevealedCredentialsDto"]);
          }),
        ]
      : []),
  ];
}

/** Categories (platform defaults with tenant overrides) and maintenance plans — owner only. */
const settingsHandlers: HttpHandler[] = [
  http.get("*/v1/owner/service-categories", ({ request }) => {
    const id = "owner.serviceCategories.list";
    const ok = reader(request, id);
    if (ok instanceof Response) return ok;
    const all = query(request).get("includeInactive") === "true";
    return json({
      data: ok.own ? r2().categories.filter((category) => all || category.isActive) : [],
    } satisfies Schemas["ServiceCategoriesDto"]);
  }),
  http.put("*/v1/owner/service-categories/:key", async ({ request, params }) => {
    const id = "owner.serviceCategories.put";
    const ok = writer(request, id);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(id);
    const input = await read<Schemas["ServiceCategoryPutDto"]>(request);
    const key = String(params.key);
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(key)) return validation(id, "key", "a lower-case key");
    if (!Number.isInteger(input.slaHours) || input.slaHours < 1 || input.slaHours > 720)
      return validation(id, "slaHours", "between 1 and 720 hours");
    let category = r2().categories.find((candidate) => candidate.key === key);
    if (!category) {
      if (!input.nameTh?.trim() || !input.nameEn?.trim()) return validation(id, "nameTh", "names in Thai and English");
      category = {
        id: crypto.randomUUID(),
        key,
        nameTh: input.nameTh.trim(),
        nameEn: input.nameEn.trim(),
        slaHours: input.slaHours,
        sortOrder: input.sortOrder ?? r2().categories.length + 1,
        isActive: input.isActive ?? true,
        source: "tenant",
      };
      r2().categories.push(category);
    } else {
      Object.assign(category, {
        nameTh: input.nameTh?.trim() || category.nameTh,
        nameEn: input.nameEn?.trim() || category.nameEn,
        slaHours: input.slaHours,
        sortOrder: input.sortOrder ?? category.sortOrder,
        isActive: input.isActive ?? category.isActive,
        source: "tenant",
      });
    }
    record(id, request, input);
    return json(category);
  }),
  http.delete("*/v1/owner/service-categories/:key", ({ request, params }) => {
    const id = "owner.serviceCategories.remove";
    const ok = writer(request, id);
    if (ok instanceof Response) return ok;
    const index = ok.own ? r2().categories.findIndex((candidate) => candidate.key === params.key) : -1;
    const category = r2().categories[index];
    if (!category || category.source !== "tenant") return notFound(id);
    // Removing the tenant's override goes back to the platform default; a tenant's own key disappears.
    const fallback = [
      ["electrical", 24],
      ["plumbing", 24],
      ["aircon", 48],
      ["appliance", 72],
      ["structure", 120],
      ["pest", 72],
      ["cleaning", 48],
      ["other", 72],
    ].find(([key]) => key === category.key);
    if (fallback) Object.assign(category, { slaHours: fallback[1], source: "platform", isActive: true });
    else r2().categories.splice(index, 1);
    return new Response(null, { status: 204 });
  }),

  http.get("*/v1/owner/maintenance-plans", ({ request }) => {
    const id = "owner.maintenancePlans.list";
    const ok = reader(request, id);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const data = r2()
      .plans.filter((plan) => visible(ok, plan.buildingId))
      .filter((plan) => !params.get("buildingId") || plan.buildingId === params.get("buildingId"))
      .filter((plan) => !params.get("assetItemId") || plan.assetItemId === params.get("assetItemId"))
      .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn));
    return json({ data } satisfies Schemas["MaintenancePlansDto"]);
  }),
  http.get("*/v1/owner/maintenance-plans/:planId", ({ request, params }) => {
    const id = "owner.maintenancePlans.get";
    const ok = reader(request, id);
    if (ok instanceof Response) return ok;
    const plan = r2().plans.find((candidate) => candidate.id === params.planId && visible(ok, candidate.buildingId));
    return plan ? json(plan, 200, { etag: `"v${plan.version}-${plan.id.slice(-6)}"` }) : notFound(id);
  }),
  http.post("*/v1/owner/maintenance-plans", async ({ request }) => {
    const id = "owner.maintenancePlans.create";
    const ok = writer(request, id);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(id);
    const input = await read<Schemas["MaintenancePlanCreateDto"]>(request);
    const asset = assetName(input.assetItemId);
    if (!asset) return notFound(id);
    if (!input.title?.trim()) return validation(id, "title", "a title");
    if (!input.intervalDays || input.intervalDays < 1) return validation(id, "intervalDays", "at least 1 day");
    if (!input.nextDueOn) return validation(id, "nextDueOn", "the first due date");
    const plan: Schemas["MaintenancePlanDto"] = {
      id: crypto.randomUUID(),
      assetItemId: input.assetItemId,
      assetItemName: asset.name,
      buildingId: asset.buildingId,
      title: input.title.trim(),
      description: input.description ?? null,
      intervalDays: input.intervalDays,
      leadDays: input.leadDays ?? 7,
      nextDueOn: input.nextDueOn,
      isActive: input.isActive ?? true,
      categoryId: input.categoryId ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
      assigneePartyId: input.assigneePartyId ?? null,
      lastWorkOrderId: null,
      version: 1,
    };
    r2().plans.push(plan);
    record(id, request, input);
    return json(plan, 201, { etag: `"v1-${plan.id.slice(-6)}"` });
  }),
  http.patch("*/v1/owner/maintenance-plans/:planId", async ({ request, params }) => {
    const id = "owner.maintenancePlans.update";
    const ok = writer(request, id);
    if (ok instanceof Response) return ok;
    const plan = r2().plans.find((candidate) => candidate.id === params.planId && visible(ok, candidate.buildingId));
    if (!plan) return notFound(id);
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) return problem(id, "concurrency.precondition_required");
    if (ifMatch !== `"v${plan.version}-${plan.id.slice(-6)}"`) return problem(id, "concurrency.stale");
    const input = await read<Schemas["MaintenancePlanUpdateDto"]>(request);
    if (input.intervalDays !== undefined && input.intervalDays < 1)
      return validation(id, "intervalDays", "at least 1 day");
    Object.assign(plan, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)));
    plan.version += 1;
    record(id, request, input);
    return json(plan, 200, { etag: `"v${plan.version}-${plan.id.slice(-6)}"` });
  }),
  http.get("*/v1/owner/buildings/:buildingId/asset-items", ({ request, params }) => {
    const id = "owner.assetItems.listForBuilding";
    const ok = reader(request, id);
    if (ok instanceof Response) return ok;
    if (!ok.own || !state.owner.buildings.some((building) => building.id === params.buildingId)) return notFound(id);
    const params_ = query(request);
    const data = buildingAssetItems(String(params.buildingId))
      .filter((item) => !params_.get("category") || item.category === params_.get("category"))
      .filter((item) => !params_.get("status") || item.status === params_.get("status"))
      .filter((item) => !params_.get("unitId") || item.unitId === params_.get("unitId"));
    return json({ data } satisfies Schemas["BuildingAssetItemsDto"]);
  }),
  http.get("*/v1/owner/units/:unitId/asset-items", ({ request, params }) => {
    const id = "owner.assetItems.list";
    const ok = reader(request, id);
    if (ok instanceof Response) return ok;
    if (!ok.own || !state.owner.units.some((unit) => unit.id === params.unitId)) return notFound(id);
    return json(r2().amenities.filter((amenity) => amenity.unitId === params.unitId));
  }),
];

/**
 * The asset items of a building (`GET /v1/owner/buildings/{id}/asset-items`): its equipment, the locks, the
 * meters and the units' amenities — what the API lists from `core.asset_item`.
 */
function buildingAssetItems(buildingId: string): Schemas["BuildingAssetItemDto"][] {
  const unitsOf = state.owner.units.filter((unit) => unit.buildingId === buildingId);
  const floorOf = (unitId: string | null) => unitsOf.find((unit) => unit.id === unitId)?.floorId ?? null;
  const blank = { manufacturer: null, model: null, serial: null, installDate: null, warrantyUntil: null };
  const items: Schemas["BuildingAssetItemDto"][] = [
    ...r2()
      .equipment.filter((item) => item.buildingId === buildingId)
      .map((item) => omit(item, "buildingId")),
    ...r2()
      .locks.filter((lock) => lock.buildingId === buildingId)
      .map((lock) => ({
        ...blank,
        id: lock.assetItemId,
        category: "lock" as const,
        name: lock.name,
        unitId: lock.unitId,
        floorId: floorOf(lock.unitId),
        location: null,
        serial: lock.serial,
        status: lock.isActive ? ("active" as const) : ("inactive" as const),
      })),
    ...state.staff.meters
      .filter((meter) => !meter.retired && buildingOf(meter) === buildingId)
      .map((meter) => {
        const unit = unitOf(meter);
        return {
          ...blank,
          id: meter.assetItemId,
          category: meter.utility === "water" ? ("meter_water" as const) : ("meter_electric" as const),
          name: meter.name,
          unitId: unit?.id ?? null,
          floorId: unit?.floor.floorId ?? null,
          location: null,
          serial: meter.serial,
          status: "active" as const,
        };
      }),
    ...r2()
      .amenities.filter((amenity) => unitsOf.some((unit) => unit.id === amenity.unitId))
      .map((amenity) => ({
        id: amenity.id,
        category: amenity.category,
        name: amenity.name,
        unitId: amenity.unitId,
        floorId: floorOf(amenity.unitId),
        location: amenity.location,
        manufacturer: amenity.manufacturer,
        model: amenity.model,
        serial: amenity.serial,
        installDate: amenity.installDate,
        warrantyUntil: amenity.warrantyUntil,
        status: amenity.status,
      })),
  ];
  return items;
}

/** An asset item the mock knows: equipment, a lock, a meter or a unit amenity. */
function assetName(assetItemId: string): { name: string; buildingId: string } | null {
  const equipment = r2().equipment.find((candidate) => candidate.id === assetItemId);
  if (equipment) return { name: equipment.name, buildingId: equipment.buildingId };
  const lock = r2().locks.find((candidate) => candidate.assetItemId === assetItemId);
  if (lock) return { name: lock.name, buildingId: lock.buildingId };
  const meter = state.staff.meters.find((candidate) => candidate.assetItemId === assetItemId);
  if (meter) return { name: meter.name, buildingId: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c" };
  const amenity = r2().amenities.find((candidate) => candidate.id === assetItemId);
  if (amenity) {
    const unit = state.owner.units.find((candidate) => candidate.id === amenity.unitId);
    return unit ? { name: amenity.name, buildingId: unit.buildingId } : null;
  }
  return null;
}

export const serviceR2Handlers: HttpHandler[] = [
  ...serviceHandlers("owner"),
  ...serviceHandlers("staff"),
  ...settingsHandlers,
];

export { woDto, srDto };
