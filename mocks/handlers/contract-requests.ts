import type { HttpHandler } from "msw";

/*
 * CONTRACT-REQUEST — mocks of endpoints the pinned contract does not publish yet, in the requested
 * shapes of docs/contract-requests.md. Each one is deleted the day the contract adopts the endpoint
 * (the generated base handler then answers).
 */
export const contractRequestHandlers: HttpHandler[] = [];
