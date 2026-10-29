/**
 * What error reports may carry (D-025: no personal data, no secrets). Applied to every Sentry event
 * on the server and in the browser: cookies, authorization headers and bodies are dropped; URL query
 * values that are credentials (the SSE `token`, invitation `code`, `next`) are masked, and so are path segments that
 * are bearer credentials — the getbuild invitation `/handoff/<token>` (review L4).
 */
const SECRET_PARAMS = ["token", "code", "invitation", "next", "enrollmentToken", "refreshToken"];
/** `/handoff/<token>` (with or without a locale prefix): the token lets a signed-in landlord claim the unit. */
const SECRET_PATHS = /(\/handoff\/)[^/?#]+/g;

const scrubPath = (url: string) => url.replace(SECRET_PATHS, "$1[redacted]");

export function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://local.invalid");
    for (const name of SECRET_PARAMS) if (parsed.searchParams.has(name)) parsed.searchParams.set(name, "[redacted]");
    parsed.pathname = scrubPath(parsed.pathname);
    const out = parsed.toString();
    return url.startsWith("http") ? out : out.replace("http://local.invalid", "");
  } catch {
    return scrubPath(url.split("?")[0] ?? "");
  }
}

interface ScrubbableEvent {
  request?: {
    url?: string;
    cookies?: unknown;
    headers?: Record<string, string>;
    data?: unknown;
    query_string?: unknown;
  };
  user?: unknown;
  transaction?: string;
  breadcrumbs?: { data?: Record<string, unknown> }[];
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      const kept: Record<string, string> = {};
      for (const [name, value] of Object.entries(event.request.headers)) {
        if (/^(user-agent|accept-language|x-request-id|x-gp-zone)$/i.test(name)) kept[name] = value;
      }
      event.request.headers = kept;
    }
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
  }
  delete event.user;
  if (typeof event.transaction === "string") event.transaction = scrubUrl(event.transaction);
  for (const crumb of event.breadcrumbs ?? []) {
    // Fetch / xhr crumbs carry `url`; navigation crumbs carry `from` and `to`.
    for (const field of ["url", "from", "to"] as const) {
      const value = crumb.data?.[field];
      if (typeof value === "string") crumb.data![field] = scrubUrl(value);
    }
  }
  return event;
}
