import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { TENANTS } from "../fixtures";
import { addonGate } from "./growth";
import { allowed, body, json, mutating, notFound, owner, record, validation, type Ok } from "./support";

type Schemas = components["schemas"];

/**
 * The tenant's own LINE Official Account (D-254) like getproperty-api's fake LINE: an access token
 * `fake-token-<name>` is a working channel whose bot is `<name>`; `fake-token-revoked…` is refused by LINE (the
 * channel is kept as `failing` with the reason). One live channel per scope (the tenant, or one building).
 */
const w = () => state.owner;

/**
 * The channels of the calling tenant: the sample tenant's in the owner world, the agency's beside it (G4, D-296 (6));
 * every other tenant has none (and cannot connect one in the mock).
 */
function channelsOf(ok: Ok): Schemas["MessagingChannelDto"][] | null {
  if (ok.own) return w().messagingChannels;
  if (ok.tenantId === TENANTS.agency.profile.id) return state.growth.agencyChannels;
  return null;
}

const WEBHOOK_BASE = "https://api.getproperty.test/webhooks/line/";

function checked(channel: Schemas["MessagingChannelDto"], accessToken: string): Schemas["MessagingChannelDto"] {
  const now = new Date().toISOString();
  if (accessToken.startsWith("fake-token-revoked") || !accessToken.startsWith("fake-token-")) {
    return {
      ...channel,
      state: "failing",
      lastCheckedAt: now,
      lastError: "LINE refused the channel access token (401)",
    };
  }
  return {
    ...channel,
    state: "verified",
    botName: accessToken.slice("fake-token-".length).slice(0, 200),
    verifiedAt: channel.verifiedAt ?? now,
    lastCheckedAt: now,
    lastError: null,
  };
}

/** The token each mock channel was connected with (a re-check reads it, like the API decrypting its copy). */
const tokens = new Map<string, string>();

export const messagingHandlers: HttpHandler[] = [
  http.get("*/v1/owner/messaging/channels", ({ request }) => {
    const ok = owner(request, "owner.messagingChannels.list");
    if (ok instanceof Response) return ok;
    return json(channelsOf(ok) ?? []);
  }),

  // The month's usage (a sample near the free messages, for review): 812 of 1,000 through the shared OA.
  http.get("*/v1/owner/messaging/usage", ({ request }) => {
    const ok = owner(request, "owner.messagingUsage.get");
    if (ok instanceof Response) return ok;
    const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const own = (channelsOf(ok) ?? []).some((channel) => channel.state === "verified");
    return json({
      month,
      shared: {
        counted: 812,
        allowance: 1000,
        left: 188,
        usedPercent: 81,
        chargeable: 0,
        pricePerMessage: "0.1000",
        vatPercent: "7.00",
        estimatedCharge: "0.00",
        estimatedVat: "0.00",
      },
      own: { counted: own ? 64 : 0, replies: own ? 9 : 0 },
      quotaFallbacks: 0,
    } satisfies Schemas["MessagingUsageDto"]);
  }),

  http.post("*/v1/owner/messaging/channels", async ({ request }) => {
    const op = "owner.messagingChannels.connect";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.settings.update");
    if (forbidden) return forbidden;
    const input = await body<Partial<Schemas["MessagingChannelConnectDto"]>>(request);
    // Secrets are never kept in the request log: only what the e2e suite checks (G4 add-on acceptance).
    record(op, request, {
      lineChannelId: input.lineChannelId,
      acceptAddonVersionId: input.acceptAddonVersionId ?? null,
    });
    if (!/^\d{6,20}$/.test(input.lineChannelId ?? "")) return validation(op, "lineChannelId", "6–20 digits");
    if ((input.channelSecret ?? "").length < 16) return validation(op, "channelSecret", "at least 16 characters");
    if ((input.accessToken ?? "").length < 20) return validation(op, "accessToken", "at least 20 characters");
    const buildingId = input.buildingId ?? null;
    if (buildingId && !w().buildings.some((building) => building.id === buildingId)) return notFound(op);
    const list = channelsOf(ok);
    if (!list) return notFound(op);
    // G4: while the agency OA add-on is priced, connecting needs its prices accepted (setup fee invoiced once).
    const gate = addonGate(ok.tenantId, op, input.acceptAddonVersionId);
    if (gate) return gate;
    for (let i = list.length - 1; i >= 0; i -= 1) if (list[i]!.buildingId === buildingId) list.splice(i, 1);
    const id = crypto.randomUUID();
    const channel = checked(
      {
        id,
        buildingId,
        lineChannelId: input.lineChannelId!,
        state: "pending",
        botName: null,
        botPictureUrl: null,
        webhookUrl: `${WEBHOOK_BASE}${id.replace(/-/g, "")}`,
        verifiedAt: null,
        lastCheckedAt: null,
        lastError: null,
        linkedUsers: 0,
        createdAt: new Date().toISOString(),
      },
      input.accessToken!,
    );
    tokens.set(id, input.accessToken!);
    list.push(channel);
    return json(channel, 201);
  }),

  http.post("*/v1/owner/messaging/channels/:channelId/actions/:action", ({ request, params }) => {
    const action = String(params.action);
    const op = action === "verify" ? "owner.messagingChannels.verify" : "owner.messagingChannels.revoke";
    if (action !== "verify" && action !== "revoke") return notFound("owner.messagingChannels.verify");
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "tenant.settings.update");
    if (forbidden) return forbidden;
    const list = channelsOf(ok) ?? [];
    const index = list.findIndex((channel) => channel.id === params.channelId);
    if (index < 0) return notFound(op);
    if (action === "revoke") {
      list.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    const channel = checked(list[index]!, tokens.get(String(params.channelId)) ?? "");
    list[index] = channel;
    return json(channel);
  }),
];
