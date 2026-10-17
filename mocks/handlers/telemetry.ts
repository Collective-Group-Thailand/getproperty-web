import { http, HttpResponse, type HttpHandler } from "msw";

import { state } from "../state";

/** `POST /v1/{owner,staff,admin}/telemetry/web-vitals` (D-180): kept for `GET /__mock/web-vitals`, 202. */
export const telemetryHandlers: HttpHandler[] = (["owner", "staff", "admin"] as const).map((surface) =>
  http.post(`*/v1/${surface}/telemetry/web-vitals`, async ({ request }) => {
    state.webVitals.push({ surface, ...((await request.json().catch(() => ({}))) as object) });
    if (state.webVitals.length > 500) state.webVitals.splice(0, state.webVitals.length - 500);
    return new HttpResponse(null, { status: 202 });
  }),
);
