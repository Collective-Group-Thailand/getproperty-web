"use client";

import { createApiClient, type ApiClient } from "./client";
import { CSRF_HEADER } from "./headers";

/**
 * The browser's API client: same generated types, base URL `/bff` on the page's own host, so the
 * zone BFF attaches the session from its httpOnly cookies (ADR-0004). Every request carries the CSRF
 * header the BFF demands on non-GET requests, and the page language for problem `detail`s.
 */
let client: ApiClient | undefined;

export function browserApi(): ApiClient {
  client ??= createApiClient({
    baseUrl: "/bff",
    headers: () => ({
      [CSRF_HEADER]: "1",
      "Accept-Language": typeof document === "undefined" ? undefined : document.documentElement.lang || "th",
    }),
  });
  return client;
}
