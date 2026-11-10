import "server-only";

import { cookies, headers } from "next/headers";

import { GUARD_ACCESS_COOKIE, GUARD_DEVICE_COOKIE, GUARD_LOCK_COOKIE, readDevice } from "@/lib/auth/guard-cookies";
import { serverEnv } from "@/lib/env/server";

import type { GuardHardware, GuardIncident, GuardMe, GuardVisit, PlateDetection } from "./lib/api";

/** The desk's lists as the API had them when the page was rendered (no layout shift while they load). */
export interface GateSnapshot {
  waiting: GuardVisit[];
  inside: GuardVisit[];
  hardware: GuardHardware[];
  detections: PlateDetection[];
  incidents: GuardIncident[];
}

/**
 * What the `/gate` page knows before the first paint (JW4): whether this browser holds an enrolled device, and — when
 * its guard access cookie is still good — the shift's `me`, so the desk renders at once. An expired access token is
 * left to the client: its first call through the guard BFF refreshes (the proxy refreshes operator cookies only).
 * `locked`: the desk was locked to the PIN pad (httpOnly lock cookie, review W1) — a reload renders the lock screen.
 */
export async function readGateSession(): Promise<{
  enrolled: boolean;
  locked: boolean;
  me: GuardMe | null;
  snapshot: GateSnapshot | null;
}> {
  const jar = await cookies();
  const enrolled = readDevice(jar.get(GUARD_DEVICE_COOKIE)?.value) !== null;
  const locked = enrolled && !!jar.get(GUARD_LOCK_COOKIE)?.value;
  const access = jar.get(GUARD_ACCESS_COOKIE)?.value;
  if (!enrolled || !access) return { enrolled, locked, me: null, snapshot: null };
  const language = (await headers()).get("accept-language");
  const get = async <T>(path: string): Promise<T | null> => {
    const response = await fetch(`${serverEnv().API_INTERNAL_URL}${path}`, {
      headers: {
        authorization: `Bearer ${access}`,
        accept: "application/json",
        ...(language ? { "accept-language": language } : {}),
      },
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as T) : null;
  };
  try {
    const [me, waiting, inside, hardware, detections, incidents] = await Promise.all([
      get<GuardMe>("/v1/guard/me"),
      get<GuardVisit[]>("/v1/guard/visits?view=waiting"),
      get<GuardVisit[]>("/v1/guard/visits?view=inside"),
      get<GuardHardware[]>("/v1/guard/hardware"),
      get<PlateDetection[]>("/v1/guard/plate-detections?view=recent"),
      get<GuardIncident[]>("/v1/guard/incidents?view=active"),
    ]);
    const snapshot =
      me && waiting && inside && hardware && detections && incidents
        ? { waiting, inside, hardware, detections, incidents }
        : null;
    return { enrolled, locked, me, snapshot };
  } catch {
    return { enrolled, locked, me: null, snapshot: null };
  }
}
