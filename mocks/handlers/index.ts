import type { HttpHandler } from "msw";

import { authHandlers } from "./auth";
import { generatedHandlers } from "./generated";
import { meHandlers } from "./me";

/** Hand-written, stateful handlers first; the contract-generated base handlers answer the rest. */
export function handlers(): HttpHandler[] {
  return [...authHandlers, ...meHandlers, ...generatedHandlers()];
}
