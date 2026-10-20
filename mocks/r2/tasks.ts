import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { BUILDING_A, FLOORS, UNITS } from "../staff-world";
import { state } from "../state";
import {
  idempotent,
  json,
  notFound,
  problem,
  query,
  r2,
  reader,
  validation,
  visible,
  writer,
  type R2Ok,
} from "./support";

type Schemas = components["schemas"];

/**
 * The staff member's day (B5.4, D-213): `GET /v1/staff/tasks` over the open reading requests, scheduled /
 * in-progress inspections, install orders, active work orders and parcels waiting at the desk — grouped by
 * type, then floor (building-wide first), most urgent first; an overdue task's priority is at least `high`.
 * `complete` goes through each source's own rule (after photo, PIN, signatures); install orders are
 * read-only (`staff_task.not_completable`).
 */

const ORDER: Schemas["StaffTaskType"][] = ["work_order", "inspection", "reading", "parcel", "install"];
const RANK: Record<Schemas["ServicePriority"], number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const ACTIVE: Schemas["WorkOrderStatus"][] = ["open", "assigned", "accepted", "in_progress"];
const INSTALL_ORDER = "0d000000-0000-4000-8000-000000000001";

type Task = Schemas["StaffTaskDto"];

function floorOf(unitId: string | null) {
  const unit = Object.values(UNITS).find((candidate) => candidate.id === unitId);
  return unit ? unit.floor : null;
}

function task(partial: Omit<Task, "overdue" | "priority"> & { priority?: Schemas["ServicePriority"] }): Task {
  const overdue = partial.dueAt !== null && partial.dueAt < new Date().toISOString();
  const priority = partial.priority ?? "normal";
  return { ...partial, overdue, priority: overdue && RANK[priority] > RANK.high ? "high" : priority };
}

function allTasks(ok: R2Ok, mine: boolean): Task[] {
  const tasks: Task[] = [];
  for (const wo of r2().workOrders) {
    if (!ACTIVE.includes(wo.status) || !visible(ok, wo.buildingId)) continue;
    const assignee = wo.assignee?.type === "user" ? wo.assignee.id : null;
    if (wo.assignee?.type === "party") continue;
    if (mine && assignee && assignee !== ok.userId) continue;
    tasks.push(
      task({
        id: wo.id,
        type: "work_order",
        subject: wo.title,
        buildingId: wo.buildingId,
        unitId: wo.unitId,
        unitNo: wo.unitNo,
        assetItemId: wo.assetItemId,
        assigneeUserId: assignee,
        dueAt: wo.scheduledAt,
        priority: wo.priority,
        sourceStatus: wo.status,
        completable: true,
        createdAt: wo.createdAt,
      }),
    );
  }
  for (const inspection of state.staff.inspections) {
    if (!["scheduled", "in_progress"].includes(inspection.status)) continue;
    tasks.push(
      task({
        id: inspection.id,
        type: "inspection",
        subject: `${inspection.type === "move_out" ? "Move-out" : "Move-in"} inspection ${inspection.unitNo}`,
        buildingId: BUILDING_A,
        unitId: inspection.unitId,
        unitNo: inspection.unitNo,
        assetItemId: null,
        assigneeUserId: null,
        dueAt: inspection.scheduledFor,
        sourceStatus: inspection.status,
        completable: true,
        createdAt: inspection.scheduledFor ?? new Date().toISOString(),
      }),
    );
  }
  for (const [assetItemId, assignee] of Object.entries(state.owner.readingRequests)) {
    const meter = state.staff.meters.find((candidate) => candidate.assetItemId === assetItemId);
    if (!meter || state.staff.readings.some((reading) => reading.assetItemId === assetItemId)) continue;
    if (mine && assignee && assignee.userId !== ok.userId) continue;
    const unit = meter.unit ? UNITS[meter.unit] : null;
    tasks.push(
      task({
        id: assetItemId,
        type: "reading",
        subject: meter.code,
        buildingId: unit?.floor.buildingId ?? BUILDING_A,
        unitId: unit?.id ?? null,
        unitNo: unit?.no ?? null,
        assetItemId,
        assigneeUserId: assignee?.userId ?? null,
        dueAt: null,
        sourceStatus: "open",
        completable: true,
        createdAt: new Date().toISOString(),
      }),
    );
  }
  for (const parcel of r2().parcels) {
    if (!["received", "notified"].includes(parcel.status) || !visible(ok, parcel.buildingId)) continue;
    tasks.push(
      task({
        id: parcel.id,
        type: "parcel",
        subject: [parcel.carrier, parcel.trackingNo].filter(Boolean).join(" ") || parcel.unitNo,
        buildingId: parcel.buildingId,
        unitId: parcel.unitId,
        unitNo: parcel.unitNo,
        assetItemId: null,
        assigneeUserId: null,
        dueAt: null,
        sourceStatus: parcel.status,
        completable: true,
        createdAt: parcel.receivedAt,
      }),
    );
  }
  if (
    visible(ok, BUILDING_A) &&
    state.staff.devices.some((d) => d.buildingId === BUILDING_A && d.status === "assigned")
  )
    tasks.push(
      task({
        id: INSTALL_ORDER,
        type: "install",
        subject: "Smart meter install",
        buildingId: BUILDING_A,
        unitId: null,
        unitNo: null,
        assetItemId: null,
        assigneeUserId: null,
        dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        sourceStatus: "open",
        completable: false,
        createdAt: new Date().toISOString(),
      }),
    );
  return tasks;
}

function grouped(tasks: Task[]): Schemas["StaffTaskGroupDto"][] {
  return ORDER.map((type) => {
    const ofType = tasks.filter((one) => one.type === type);
    const floors = new Map<string, Schemas["StaffTaskFloorDto"]>();
    for (const one of ofType) {
      const floor = floorOf(one.unitId);
      const key = floor?.floorId ?? "none";
      if (!floors.has(key))
        floors.set(key, {
          floorId: floor?.floorId ?? null,
          floorName: floor?.floorName ?? null,
          floorLevel: floor?.level ?? null,
          tasks: [],
        });
      floors.get(key)!.tasks.push(one);
    }
    const sorted = [...floors.values()].sort((a, b) => (a.floorLevel ?? -1) - (b.floorLevel ?? -1));
    for (const floor of sorted)
      floor.tasks.sort(
        (a, b) =>
          Number(b.overdue) - Number(a.overdue) ||
          RANK[a.priority] - RANK[b.priority] ||
          (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"),
      );
    return { type, count: ofType.length, floors: sorted };
  }).filter((group) => group.count > 0);
}

export const tasksR2Handlers: HttpHandler[] = [
  http.get("*/v1/staff/tasks", ({ request }) => {
    const op = "staff.tasks.day";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const building = params.get("building");
    if (building && !visible(ok, building)) return notFound(op);
    const date = params.get("date") ?? new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const tasks = ok.own
      ? allTasks(ok, params.get("mine") === "true").filter((one) => !building || one.buildingId === building)
      : [];
    return json({
      buildingId: building,
      date,
      total: tasks.length,
      groups: grouped(tasks),
    } satisfies Schemas["StaffTaskDayDto"]);
  }),
  http.get("*/v1/staff/tasks/:type/:taskId", ({ request, params }) => {
    const op = "staff.tasks.get";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const found = allTasks(ok, false).find((one) => one.type === params.type && one.id === params.taskId);
    return found ? json(found) : notFound(op);
  }),
  http.post("*/v1/staff/tasks/:type/:taskId/actions/complete", async ({ request, params }) => {
    const op = "staff.tasks.complete";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const found = allTasks(ok, false).find((one) => one.type === params.type && one.id === params.taskId);
    if (!found) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["StaffTaskCompleteDto"];
      const done = (sourceStatus: string) => ({
        status: 200,
        body: { id: found.id, type: found.type, sourceStatus } satisfies Schemas["StaffTaskResultDto"],
      });
      switch (found.type) {
        case "install":
          return problem(op, "staff_task.not_completable");
        case "work_order": {
          const wo = r2().workOrders.find((candidate) => candidate.id === found.id)!;
          if (!["assigned", "accepted", "in_progress"].includes(wo.status))
            return problem(op, "work_order.invalid_state");
          if (wo.afterPhotoIds.length === 0) return problem(op, "work_order.photo_required");
          wo.status = "done";
          wo.completedAt = new Date().toISOString();
          wo.checkedInAt ??= wo.completedAt;
          if (input.note?.trim()) wo.completionNote = input.note.trim();
          wo.version += 1;
          const sr = r2().requests.find((candidate) => candidate.id === wo.serviceRequestId);
          if (sr && !r2().workOrders.some((o) => o.serviceRequestId === sr.id && ACTIVE.includes(o.status))) {
            sr.timeline.push({ at: wo.completedAt, event: "complete", from: sr.status, to: "done" });
            sr.status = "done";
            sr.doneAt = wo.completedAt;
            sr.slaDueAt = null;
          }
          return done("done");
        }
        case "parcel": {
          const parcel = r2().parcels.find((candidate) => candidate.id === found.id)!;
          if (!input.pin && !input.staffConfirmed)
            return validation(op, "pin", "the resident's PIN or a staff confirmation");
          if (input.pin && input.pin !== r2().pins[parcel.id]) return problem(op, "parcel.pin_mismatch");
          parcel.status = "picked_up";
          parcel.pickedUpAt = new Date().toISOString();
          parcel.pickupConfirmedBy = input.pin ? "resident_pin" : "staff";
          return done("picked_up");
        }
        case "reading":
          if (!input.photoDocumentId) return problem(op, "reading.photo_required");
          delete state.owner.readingRequests[found.id];
          return done("fulfilled");
        case "inspection": {
          const inspection = state.staff.inspections.find((candidate) => candidate.id === found.id)!;
          if (!input.staffSignaturePng) return validation(op, "staffSignaturePng", "the inspector's signature");
          inspection.status = input.residentSignaturePng ? "signed" : "completed";
          return done(inspection.status);
        }
      }
    });
  }),
];

export { FLOORS };
