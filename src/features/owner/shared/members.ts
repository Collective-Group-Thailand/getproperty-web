import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** A login the owner can hand field work to (a reading request, a work order, a staff code). */
export interface FieldMember {
  userId: string;
  displayName: string;
  role: Schemas["TenantRole"];
}

const FIELD_ROLES = new Set<Schemas["TenantRole"]>(["staff", "manager", "owner"]);

/**
 * Active members who may do field work in `buildingId` (D-090): Staff, Managers and Owners whose
 * membership is not limited to other buildings. Only a choice list — the API checks the permission
 * (`reading.capture`, `service_request.handle`) on the building and refuses anyone else (422). An empty
 * list when the members cannot be read (the form still works without an assignee).
 */
export async function fieldMembers(api: ApiClient, buildingId?: string | null): Promise<FieldMember[]> {
  const members = await unwrap(api.GET("/v1/owner/members")).catch(() => [] as Schemas["MemberDto"][]);
  return members
    .filter((member) => member.status === "active" && FIELD_ROLES.has(member.role))
    .filter((member) => !buildingId || !member.buildingIds || member.buildingIds.includes(buildingId))
    .map((member) => ({ userId: member.userId, displayName: member.displayName, role: member.role }));
}
