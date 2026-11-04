import "server-only";

import { getTranslations } from "next-intl/server";

import { messageKey } from "@/i18n/keys";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { can, type AdminContext } from "../shared/server";

type Translator = Awaited<ReturnType<typeof getTranslations<"admin.operations.audit">>>;

/**
 * An audit action in words (redesign G8: "ใช้สิทธิ์ซัพพอร์ต", never `support_grant.used`): the action's own name when the
 * message files know it, else its area ("สิทธิ์ซัพพอร์ต · การกระทำอื่น"), else null — the caller then shows the code,
 * muted, as the only honest label.
 */
export function auditActionLabel(t: Translator, action: string): string | null {
  const key = `actionName.${messageKey(action)}`;
  if (t.has(key)) return t(key as Parameters<Translator>[0]);
  const parts = action.split(".");
  for (let length = parts.length - 1; length > 0; length -= 1) {
    const domain = `domainName.${parts.slice(0, length).join("_")}`;
    if (t.has(domain)) return t("otherAction", { domain: t(domain as Parameters<Translator>[0]) });
  }
  return null;
}

/** The kind of thing an audit row is about, in words, or null. */
export function auditSubjectLabel(t: Translator, subjectType: string | null): string | null {
  if (!subjectType) return null;
  const key = `subjectType.${messageKey(subjectType)}`;
  return t.has(key) ? t(key as Parameters<Translator>[0]) : null;
}

/** Platform users by id (for "who did it"), when the reader may list them; else an empty map. */
export async function platformUserNames(context: AdminContext): Promise<Map<string, string>> {
  if (!can(context.me, "admin.user.manage")) return new Map([[context.me.user.id, context.me.user.displayName]]);
  try {
    const users = await unwrap(context.api.GET("/v1/admin/platform-users"));
    return new Map(users.map((user) => [user.id, user.displayName]));
  } catch {
    return new Map([[context.me.user.id, context.me.user.displayName]]);
  }
}

/** Who acted: a platform user's name when known, else "platform user" / "system" — never a raw id. */
export function auditActorLabel(t: Translator, actor: Schemas["AuditEntryDto"]["actor"], users: Map<string, string>) {
  const id = typeof actor.id === "string" ? actor.id : null;
  if (id && users.has(id)) return users.get(id)!;
  const audience = typeof actor.audience === "string" ? actor.audience : null;
  return audience === "platform" ? t("platformActor") : t("systemActor");
}

type OpsTranslator = Awaited<ReturnType<typeof getTranslations<"admin.operations">>>;

/**
 * A domain event's name in words (outbox, integration events): its own name when known ("ออกใบแจ้งหนี้"), else its
 * area ("ใบแจ้งหนี้"), else null — the code is always shown under it, muted.
 */
export function eventTypeLabel(t: OpsTranslator, type: string): string | null {
  const key = `eventName.${messageKey(type)}`;
  if (t.has(key)) return t(key as Parameters<OpsTranslator>[0]);
  const domain = `eventDomain.${type.split(".")[0] ?? ""}`;
  return t.has(domain) ? t(domain as Parameters<OpsTranslator>[0]) : null;
}
