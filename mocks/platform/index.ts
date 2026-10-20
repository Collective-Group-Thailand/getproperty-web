import type { HttpHandler } from "msw";

import { state } from "../state";
import { businessHandlers } from "./business";
import { advanceRollout, fleetHandlers } from "./fleet";
import { operationHandlers } from "./operations";
import { initialPlatformWorld } from "./world";

/** The admin surface's stateful handlers (F5); the contract-generated handlers answer what is not here. */
export const platformHandlers: HttpHandler[] = [...businessHandlers, ...operationHandlers, ...fleetHandlers];

export function resetPlatformWorld(): void {
  state.platform = initialPlatformWorld();
}

export { advanceRollout };
