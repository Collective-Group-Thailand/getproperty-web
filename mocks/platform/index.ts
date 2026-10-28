import type { HttpHandler } from "msw";

import { state } from "../state";
import { businessHandlers } from "./business";
import { credentialHandlers } from "./credentials";
import { advanceRollout, fleetHandlers } from "./fleet";
import { growthAdminHandlers } from "./growth";
import { guideHandlers } from "./guides";
import { operationHandlers } from "./operations";
import { storageAdminHandlers } from "./storage";
import { initialPlatformWorld } from "./world";

/** The admin surface's stateful handlers (F5); the contract-generated handlers answer what is not here. */
export const platformHandlers: HttpHandler[] = [
  ...businessHandlers,
  ...operationHandlers,
  ...fleetHandlers,
  ...credentialHandlers,
  ...guideHandlers,
  ...storageAdminHandlers,
  ...growthAdminHandlers,
];

export function resetPlatformWorld(): void {
  state.platform = initialPlatformWorld();
  state.guides = undefined;
}

export { advanceRollout };
