import { http, type HttpHandler } from "msw";

import { ADMIN_MENU, menuFor, TENANTS } from "../fixtures";
import { tenantContext } from "./context";
import { authenticate, json, problem } from "./support";

/** `/v1/{owner,staff,admin}/me` from the personas, honouring the audience and the tenant context. */
function operatorMe(surface: "owner" | "staff") {
  const operationId = `${surface}.me.get`;
  return http.get(`*/v1/${surface}/me`, ({ request }) => {
    const auth = authenticate(request, "operator");
    if (!auth.ok) return problem(operationId, auth.code);
    if (auth.audience !== "operator") return problem(operationId, "auth.wrong_audience");
    const persona = auth.persona;
    const context = tenantContext(request, persona);
    if (!context.ok) return problem(operationId, context.code);
    const tenants = persona.memberships.map((m) => ({ ...TENANTS[m.tenant].profile, role: m.role }));
    const current = context.tenant ? TENANTS[context.tenant] : null;
    return json({
      user: persona.user,
      hasPassword: Boolean(persona.password),
      totpEnabled: Boolean(persona.totp),
      tenants,
      currentTenant: current ? { ...current.profile, role: context.role!, buildingIds: null } : null,
      roles: context.role ? [context.role] : [],
      permissions: [],
      menu: context.role ? menuFor(surface, context.role) : [],
      featureFlags: { "channel.web_push": true, "module.service_requests": false },
      subscription: current ? current.subscription : null,
      scopes: persona.memberships.map((m) => `tenant:${TENANTS[m.tenant].profile.id}`),
    });
  });
}

export const meHandlers: HttpHandler[] = [
  operatorMe("owner"),
  operatorMe("staff"),
  http.get("*/v1/admin/me", ({ request }) => {
    const auth = authenticate(request, "platform");
    if (!auth.ok) return problem("admin.me.get", auth.code);
    if (auth.audience !== "platform") return problem("admin.me.get", "auth.wrong_audience");
    return json({
      user: auth.persona.user,
      roles: auth.persona.roles,
      permissions: [],
      menu: auth.persona.roles.includes("platform_admin") ? ADMIN_MENU : ["tenants", "support_grants", "audit_log"],
      featureFlags: { "channel.web_push": true },
      totpEnabled: true,
    });
  }),
];
