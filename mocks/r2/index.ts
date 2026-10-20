import type { HttpHandler } from "msw";

import { state } from "../state";
import { accessR2Handlers } from "./access";
import { communityR2Handlers } from "./community";
import { serviceR2Handlers } from "./service";
import { tasksR2Handlers } from "./tasks";
import { initialR2World } from "./world";

/** R2 handlers (service, access, community, staff tasks) for the owner and staff surfaces. */
export const r2Handlers: HttpHandler[] = [
  ...tasksR2Handlers,
  ...serviceR2Handlers,
  ...accessR2Handlers,
  ...communityR2Handlers,
];

export function resetR2World(): void {
  state.r2 = initialR2World();
}
