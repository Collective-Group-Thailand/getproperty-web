/**
 * What error reports may carry (D-025: no personal data, no secrets). Applied to every Sentry event
 * on the server and in the browser: cookies, authorization headers and bodies are dropped; URL query
 * values that are credentials (the SSE `token`, invitation `code`, `next`) are masked.
 */
const SECRET_PARAMS = ["token", "code", "invitation", "next", "enrollmentToken", "refreshToken"];

export function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://local.invalid");
    for (const name of SECRET_PARAMS) if (parsed.searchParams.has(name)) parsed.searchParams.set(name, "[redacted]");
    const out = parsed.toString();
    return url.startsWith("http") ? out : out.replace("http://local.invalid", "");
  } catch {
    return url.split("?")[0] ?? "";
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
  for (const crumb of event.breadcrumbs ?? []) {
    if (typeof crumb.data?.url === "string") crumb.data.url = scrubUrl(crumb.data.url);
  }
  return event;
}
