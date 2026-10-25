import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { allowed, body, json, mutating, notFound, owner, validation } from "./support";

type Schemas = components["schemas"];

/**
 * The tenant's own LINE Official Account (D-254) like getproperty-api's fake LINE: an access token
 * `fake-token-<name>` is a working channel whose bot is `<name>`; `fake-token-revoked…` is refused by LINE (the
 * channel is kept as `failing` with the reason). One live channel per scope (the tenant, or one building).
 */
const w = () => state.owner;

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
    return json(ok.own ? w().messagingChannels : []);
  }),

  // The month's usage (a sample near the free messages, for review): 812 of 1,000 through the shared OA.
  http.get("*/v1/owner/messaging/usage", ({ request }) => {
    const ok = owner(request, "owner.messagingUsage.get");
    if (ok instanceof Response) return ok;
    const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const own = w().messagingChannels.some((channel) => channel.state === "verified");
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
    if (!/^\d{6,20}$/.test(input.lineChannelId ?? "")) return validation(op, "lineChannelId", "6–20 digits");
    if ((input.channelSecret ?? "").length < 16) return validation(op, "channelSecret", "at least 16 characters");
    if ((input.accessToken ?? "").length < 20) return validation(op, "accessToken", "at least 20 characters");
    const buildingId = input.buildingId ?? null;
    if (buildingId && !w().buildings.some((building) => building.id === buildingId)) return notFound(op);
    if (!ok.own) return notFound(op);
    w().messagingChannels = w().messagingChannels.filter((channel) => channel.buildingId !== buildingId);
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
    w().messagingChannels.push(channel);
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
    const index = ok.own ? w().messagingChannels.findIndex((channel) => channel.id === params.channelId) : -1;
    if (index < 0) return notFound(op);
    if (action === "revoke") {
      w().messagingChannels.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    const channel = checked(w().messagingChannels[index]!, tokens.get(String(params.channelId)) ?? "");
    w().messagingChannels[index] = channel;
    return json(channel);
  }),
];
