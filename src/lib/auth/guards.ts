import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/auth";

import { getOperatorActor, getPlatformActor, type OperatorActor, type PlatformActor } from "./actor";

import { PATH_HEADER } from "./guards-shared";

async function loginWithReturn(loginHref: string): Promise<never> {
  const back = safeNextPath((await headers()).get(PATH_HEADER) ?? undefined);
  redirect(back ? `${loginHref}?next=${encodeURIComponent(back)}` : loginHref);
}

/**
 * Route guard of the operator consoles (owner, staff): signed in on this host, and working in a
 * tenant — operators of several tenants without a choice go to the picker. The API stays the
 * enforcement point; this only decides which page to render.
 */
export async function requireOperator(
  zone: "owner" | "staff",
  hrefs: { login: string; selectTenant: string },
): Promise<OperatorActor & { me: { currentTenant: NonNullable<OperatorActor["me"]["currentTenant"]> } }> {
  const actor = await getOperatorActor(zone);
  if (!actor) return loginWithReturn(hrefs.login);
  if (!actor.me.currentTenant) redirect(hrefs.selectTenant);
  return actor as OperatorActor & { me: { currentTenant: NonNullable<OperatorActor["me"]["currentTenant"]> } };
}

/** Route guard of the admin console: a platform session on the admin host. */
export async function requirePlatform(loginHref: string): Promise<PlatformActor> {
  const actor = await getPlatformActor();
  if (!actor) return loginWithReturn(loginHref);
  return actor;
}
