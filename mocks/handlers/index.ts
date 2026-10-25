import type { HttpHandler } from "msw";

import { authHandlers } from "./auth";
import { generatedHandlers } from "./generated";
import { identityHandlers } from "./identities";
import { meHandlers } from "./me";
import { notificationHandlers } from "./notifications";
import { ownerHandlers } from "../owner";
import { platformHandlers } from "../platform";
import { r2Handlers } from "../r2";
import { publicHandlers } from "./public";
import { realtimeHandlers } from "./realtime";
import { searchHandlers } from "./search";
import { staffHandlers } from "./staff";
import { telemetryHandlers } from "./telemetry";

/** Hand-written, stateful handlers first; the contract-generated base handlers answer the rest. */
export function handlers(): HttpHandler[] {
  return [
    ...authHandlers,
    ...identityHandlers,
    ...meHandlers,
    ...notificationHandlers,
    ...realtimeHandlers,
    ...publicHandlers,
    ...searchHandlers,
    ...telemetryHandlers,
    ...staffHandlers,
    ...r2Handlers,
    ...ownerHandlers,
    ...platformHandlers,
    ...generatedHandlers(),
  ];
}
