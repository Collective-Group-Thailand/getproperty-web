/**
 * Liveness of this container for the Collective platform (D-230): the compose healthcheck
 * (`wget http://127.0.0.1:3000/api/healthz`) and `deploy-product.sh`'s health gate. It answers once the server has
 * booted, which includes the environment validation of `src/instrumentation.ts` (an invalid deployment never gets
 * here). It does not call getproperty-api on purpose: the API has its own health check, and a front end marked
 * unhealthy because the API is down would be rolled back for nothing. Served on every host, outside the zones
 * (`src/proxy.ts`), without a session or personal data.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } },
  );
}

export function HEAD(): Response {
  return new Response(null, { headers: { "cache-control": "no-store" } });
}
