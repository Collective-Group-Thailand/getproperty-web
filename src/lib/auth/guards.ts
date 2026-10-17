import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/safe-next";

import { getOperatorActor, getPlatformActor, type OperatorActor, type OperatorZone, type PlatformActor } from "./actor";

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
export async function requireOperator<Z extends OperatorZone>(
  zone: Z,
  hrefs: { login: string; selectTenant: string },
): Promise<OperatorActor<Z> & { me: { currentTenant: NonNullable<OperatorActor<Z>["me"]["currentTenant"]> } }> {
  const actor = await getOperatorActor(zone);
  if (!actor) return loginWithReturn(hrefs.login);
  if (!actor.me.currentTenant) redirect(hrefs.selectTenant);
  return actor as OperatorActor<Z> & {
    me: { currentTenant: NonNullable<OperatorActor<Z>["me"]["currentTenant"]> };
  };
}

/** Route guard of the admin console: a platform session on the admin host. */
export async function requirePlatform(loginHref: string): Promise<PlatformActor> {
  const actor = await getPlatformActor();
  if (!actor) return loginWithReturn(loginHref);
  return actor;
}
