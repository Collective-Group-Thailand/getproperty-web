"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Schemas } from "@/lib/api/types";

import {
  guardFetch,
  type GuardHardware,
  type GuardIncident,
  type GuardMe,
  type GuardResult,
  type GuardVisit,
  type IncidentKind,
  type PlateDetection,
  type VisitCreate,
  type VisitCreated,
} from "./api";
import { formatPlate } from "./plate";
import {
  discardGateEntry,
  enqueueGate,
  listGateQueue,
  replayGateQueue,
  retryGateEntry,
  type GateQueueEntry,
  type GateQueueLabel,
  type GateSend,
} from "./queue";
import { connectGateStream, type GateStreamEvent, type StreamStatus } from "./stream";

/**
 * The desk's data (JW4): the gate's lists, hardware, LPR reads and incidents, kept fresh by the stream, with the
 * offline queue in front of every visit the tablet records. No query library (180 KB budget): each list is refetched
 * whole when an event names it — they are short (one gate, today).
 */

export type Network = "online" | "offline";

export interface DeskState {
  waiting: GuardVisit[];
  inside: GuardVisit[];
  hardware: GuardHardware[];
  detections: PlateDetection[];
  incidents: GuardIncident[];
  queue: GateQueueEntry[];
  /** Visits the API told this tablet were open too long (`gate.visit.overstayed`). */
  overstayed: string[];
  network: Network;
  stream: StreamStatus;
  lastSync: number | null;
  loaded: boolean;
}

const INITIAL: DeskState = {
  waiting: [],
  inside: [],
  hardware: [],
  detections: [],
  incidents: [],
  queue: [],
  overstayed: [],
  network: "online",
  stream: "connecting",
  lastSync: null,
  loaded: false,
};

type Part = "visits" | "hardware" | "detections" | "incidents";
const ALL: Part[] = ["visits", "hardware", "detections", "incidents"];

/** Which lists a stream event makes stale. */
export function partsFor(type: string): Part[] {
  if (type.startsWith("gate.visit.") || type === "gate.open_requested") return ["visits"];
  if (type.startsWith("gate.incident.")) return ["incidents"];
  if (type.startsWith("gate.plate_detect")) return ["detections", "visits"];
  if (type === "gate.barrier_state" || type === "device.command_finished" || type.startsWith("gate.edge_device")) {
    return ["hardware"];
  }
  return [];
}

export interface RecordInput {
  kind: Schemas["VisitKind"];
  unitId?: string;
  unitNo?: string | null;
  plate?: Schemas["PlateDto"];
  visitorName?: string;
  idLast4?: string;
  photo?: { contentBase64: string; mimeType: "image/jpeg" };
}

export type RecordOutcome =
  | { kind: "sent"; visit: Pick<VisitCreated, "id" | "state" | "replayed" | "entryBasis" | "decisionReason"> }
  | { kind: "queued" }
  | { kind: "conflict"; entry: GateQueueEntry };

export function useDesk(
  me: GuardMe,
  onUnauthorised: () => void,
  snapshot?: Pick<DeskState, "waiting" | "inside" | "hardware" | "detections" | "incidents"> | null,
) {
  const [state, setState] = useState<DeskState>(() =>
    snapshot ? { ...INITIAL, ...snapshot, loaded: true, lastSync: Date.now() } : INITIAL,
  );
  const stateRef = useRef(state);
  const unauthorised = useRef(onUnauthorised);
  useEffect(() => {
    stateRef.current = state;
    unauthorised.current = onUnauthorised;
  });
  const gateId = me.gateId;

  const patch = useCallback((next: Partial<DeskState> | ((current: DeskState) => Partial<DeskState>)) => {
    setState((current) => ({ ...current, ...(typeof next === "function" ? next(current) : next) }));
  }, []);

  /** Every answer tells us whether the network is there; a 401 ends the session. */
  const note = useCallback(
    <T>(result: GuardResult<T>): GuardResult<T> => {
      if (result.ok) patch({ network: "online" });
      else if (result.offline) patch({ network: "offline" });
      else if (result.status === 401) unauthorised.current();
      return result;
    },
    [patch],
  );

  const get = useCallback(<T>(path: string) => guardFetch<T>(path).then(note), [note]);

  const refresh = useCallback(
    async (parts: Part[] = ALL) => {
      const tasks: Promise<void>[] = [];
      if (parts.includes("visits")) {
        tasks.push(
          Promise.all([
            get<GuardVisit[]>("/v1/guard/visits?view=waiting"),
            get<GuardVisit[]>("/v1/guard/visits?view=inside"),
          ]).then(([waiting, inside]) => {
            if (waiting.ok && inside.ok) {
              patch({ waiting: waiting.data, inside: inside.data, lastSync: Date.now() });
            }
          }),
        );
      }
      if (parts.includes("hardware")) {
        tasks.push(
          get<GuardHardware[]>("/v1/guard/hardware").then((result) => {
            if (result.ok) patch({ hardware: result.data });
          }),
        );
      }
      if (parts.includes("detections")) {
        tasks.push(
          get<PlateDetection[]>("/v1/guard/plate-detections?view=recent").then((result) => {
            if (result.ok) patch({ detections: result.data });
          }),
        );
      }
      if (parts.includes("incidents")) {
        tasks.push(
          get<GuardIncident[]>("/v1/guard/incidents?view=active").then((result) => {
            if (result.ok) patch({ incidents: result.data });
          }),
        );
      }
      await Promise.all(tasks);
      patch({ loaded: true });
    },
    [get, patch],
  );

  const reloadQueue = useCallback(async () => {
    try {
      patch({ queue: await listGateQueue(gateId) });
    } catch {
      // IndexedDB unavailable (private mode): the queue simply stays empty and calls go straight through.
    }
  }, [gateId, patch]);

  const replay = useCallback(async () => {
    const send = ((path: string, init: Parameters<GateSend>[1]) => guardFetch(path, init).then(note)) as GateSend;
    const outcome = await replayGateQueue(gateId, send).catch(() => "offline" as const);
    await reloadQueue();
    if (outcome === "done") void refresh(["visits"]);
    return outcome;
  }, [gateId, note, refresh, reloadQueue]);

  // Debounced refetch for bursts of stream events.
  const pending = useRef(new Set<Part>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schedule = useCallback(
    (parts: Part[]) => {
      parts.forEach((part) => pending.current.add(part));
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        const due = [...pending.current];
        pending.current.clear();
        void refresh(due);
      }, 250);
    },
    [refresh],
  );

  const onEvent = useCallback(
    (event: GateStreamEvent) => {
      if (event.type === "gate.visit.overstayed" && event.ids.visitId) {
        const id = event.ids.visitId;
        patch((current) => ({
          overstayed: current.overstayed.includes(id) ? current.overstayed : [...current.overstayed, id],
        }));
      }
      const parts = partsFor(event.type);
      if (parts.length) schedule(parts);
    },
    [patch, schedule],
  );

  // First load, the stream, the queue.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lists arrive from the API after this effect
    void refresh();
    void reloadQueue().then(() => replay());
    const stream = connectGateStream({
      onEvent,
      onStatus: (status) => {
        patch({ stream: status });
        if (status === "unauthorised") unauthorised.current();
      },
      onReconnect: () => void refresh(),
    });
    return () => stream.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one stream per signed-in desk
  }, [gateId]);

  // The network: browser events, and a replay whenever it comes back.
  useEffect(() => {
    const goOnline = () => {
      patch({ network: "online" });
      void replay();
      void refresh();
    };
    const goOffline = () => patch({ network: "offline" });
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) goOffline();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [patch, refresh, replay]);

  // While the stream is down: poll the changes feed (visits) and the incidents, and keep replaying the queue.
  useEffect(() => {
    if (state.stream === "open") return;
    const id = setInterval(async () => {
      const since = stateRef.current.lastSync;
      const after = since ? `?after=${encodeURIComponent(new Date(since).toISOString())}` : "";
      const changes = await get<Schemas["VisitChangeDto"][]>(`/v1/guard/visits/changes${after}`);
      if (changes.ok && changes.data.length > 0) void refresh(["visits"]);
      void refresh(["incidents"]);
      if (stateRef.current.queue.some((entry) => entry.state === "pending")) void replay();
    }, 10_000);
    return () => clearInterval(id);
  }, [state.stream, get, refresh, replay]);

  // ── actions ────────────────────────────────────────────────────────────────────────────────────────────────────

  const record = useCallback(
    async (input: RecordInput, offline: boolean): Promise<RecordOutcome> => {
      const clientRef = crypto.randomUUID();
      const body: VisitCreate = {
        clientRef,
        kind: input.kind,
        ...(input.unitId ? { unitId: input.unitId } : {}),
        ...(input.plate ? { plate: input.plate } : {}),
        ...(input.visitorName ? { visitorName: input.visitorName } : {}),
        ...(input.idLast4 ? { idLast4: input.idLast4 } : {}),
        // Offline the house cannot be asked: the guard lets the visitor in and the API stores it as recorded (D-327).
        ...(offline ? { recordedAt: new Date().toISOString(), enteredOffline: true } : {}),
      };
      const label: GateQueueLabel = {
        plate: input.plate ? formatPlate(input.plate) : null,
        unitNo: input.unitNo ?? null,
        kind: input.kind,
      };
      await enqueueGate({
        id: clientRef,
        gateId,
        kind: "visit",
        idempotencyKey: crypto.randomUUID(),
        body,
        label,
        ...(input.photo ? { photo: { contentBase64: input.photo.contentBase64, mimeType: input.photo.mimeType } } : {}),
      }).catch(() => undefined);
      await replay();
      const entry = (await listGateQueue(gateId).catch(() => [])).find((candidate) => candidate.id === clientRef);
      if (!entry) {
        // No IndexedDB: send directly once.
        const result = await guardFetch<VisitCreated>("/v1/guard/visits", {
          method: "POST",
          body,
          idempotencyKey: clientRef,
        }).then(note);
        if (result.ok) {
          void refresh(["visits"]);
          return { kind: "sent", visit: result.data };
        }
        return { kind: "queued" };
      }
      if (entry.result) {
        return { kind: "sent", visit: entry.result };
      }
      if (entry.state === "conflict") return { kind: "conflict", entry };
      return { kind: "queued" };
    },
    [gateId, note, refresh, replay],
  );

  const scan = useCallback(
    async (token: string, plate?: Schemas["PlateDto"]): Promise<GuardResult<VisitCreated> | { queued: true }> => {
      const clientRef = crypto.randomUUID();
      const body = { clientRef, token, ...(plate ? { plate } : {}) };
      const result = await guardFetch<VisitCreated>("/v1/guard/invites/actions/scan", {
        method: "POST",
        body,
        idempotencyKey: crypto.randomUUID(),
      }).then(note);
      if (!result.ok && result.offline) {
        await enqueueGate({
          id: clientRef,
          gateId,
          kind: "scan",
          idempotencyKey: crypto.randomUUID(),
          body,
          label: { plate: plate ? formatPlate(plate) : null, unitNo: null, kind: "invite" },
        }).catch(() => undefined);
        await reloadQueue();
        return { queued: true };
      }
      if (result.ok) void refresh(["visits"]);
      return result;
    },
    [gateId, note, refresh, reloadQueue],
  );

  const act = useCallback(
    async <T>(path: string, body: unknown, parts: Part[]) => {
      const result = await guardFetch<T>(path, { method: "POST", body, idempotencyKey: crypto.randomUUID() }).then(
        note,
      );
      if (result.ok) void refresh(parts);
      return result;
    },
    [note, refresh],
  );

  const actions = useMemo(
    () => ({
      record,
      scan,
      replay,
      refresh,
      enter: (visitId: string, reason?: string) =>
        act<GuardVisit>(`/v1/guard/visits/${visitId}/actions/enter`, reason ? { reason } : {}, ["visits"]),
      exit: (visitId: string) => act<GuardVisit>(`/v1/guard/visits/${visitId}/actions/exit`, undefined, ["visits"]),
      cancel: (visitId: string, reason?: string) =>
        act<GuardVisit>(`/v1/guard/visits/${visitId}/actions/cancel`, reason ? { reason } : {}, ["visits"]),
      open: (body: Schemas["GuardGateOpenDto"]) =>
        act<Schemas["GateOpenResultDto"]>(`/v1/guard/gates/${gateId}/actions/open`, body, ["hardware"]),
      claim: (id: string) =>
        act<PlateDetection>(`/v1/guard/plate-detections/${id}/actions/claim`, undefined, ["detections"]),
      dismiss: (id: string) =>
        act<PlateDetection>(`/v1/guard/plate-detections/${id}/actions/dismiss`, undefined, ["detections"]),
      acknowledge: (id: string, noteText?: string) =>
        act<GuardIncident>(`/v1/guard/incidents/${id}/actions/acknowledge`, noteText ? { note: noteText } : {}, [
          "incidents",
        ]),
      resolve: (id: string, noteText?: string) =>
        act<GuardIncident>(`/v1/guard/incidents/${id}/actions/resolve`, noteText ? { note: noteText } : {}, [
          "incidents",
        ]),
      raise: (kind: IncidentKind, noteText?: string) =>
        act<GuardIncident>("/v1/guard/incidents", { kind, ...(noteText ? { note: noteText } : {}) }, ["incidents"]),
      retryEntry: async (id: string) => {
        await retryGateEntry(id);
        await replay();
      },
      discardEntry: async (id: string) => {
        await discardGateEntry(id);
        await reloadQueue();
      },
    }),
    [act, gateId, record, refresh, reloadQueue, replay, scan],
  );

  return { state, actions };
}

export type DeskActions = ReturnType<typeof useDesk>["actions"];
