import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** A login the owner can hand field work to (a reading request, a work order, a staff code). */
export interface FieldMember {
  userId: string;
  displayName: string;
  role: Schemas["TenantRole"];
}

/** Roles offered for a staff door code, where no permission decides (the API takes any member). */
const FIELD_ROLES = new Set<Schemas["TenantRole"]>(["staff", "manager", "owner"]);

/**
 * Active members who may do field work (D-090), as the API answers
 * `GET /v1/owner/members?permission=&buildingId=`: their role holds `permission` (`service_request.handle` for
 * work orders and maintenance plans, `reading.capture` for reading requests) and their membership is not limited
 * to other buildings. Without a permission (a staff door code) the field roles are offered. Only a choice list —
 * the API checks the assignee again and refuses anyone else (422). An empty list when the members cannot be read
 * (the forms still work without an assignee).
 */
export async function fieldMembers(
  api: ApiClient,
  options: { permission?: "service_request.handle" | "reading.capture"; buildingId?: string | null } = {},
): Promise<FieldMember[]> {
  const { permission, buildingId } = options;
  const members = await unwrap(
    api.GET("/v1/owner/members", { params: { query: { permission, buildingId: buildingId ?? undefined } } }),
  ).catch(() => [] as Schemas["MemberDto"][]);
  return members
    .filter((member) => member.status === "active")
    .filter((member) => permission || FIELD_ROLES.has(member.role))
    .map((member) => ({ userId: member.userId, displayName: member.displayName, role: member.role }));
}
