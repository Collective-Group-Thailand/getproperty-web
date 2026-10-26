import { http, HttpResponse, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { authenticate, json, problem } from "./support";

type Schemas = components["schemas"];
type Attempt = Schemas["IdentityVerificationAttemptDto"];

/**
 * Identity verification of the signed-in operator (D-267) like getproperty-api's fake e-KYC (O-021): starting opens a
 * session whose page is served by this mock API (`/webhooks/ekyc/fake/sessions/{id}`, approve or reject); a pending
 * attempt is answered again; approved once = verified. Attempts are kept per persona in `state.identityVerifications`.
 */
const SESSION_PREFIX = "fake-ekyc-";
const MINUTES = 60;

const attemptsOf = (personaKey: string) => (state.identityVerifications[personaKey] ??= []);

function live(attempt: Attempt): Attempt {
  return attempt.state === "pending" && Date.parse(attempt.expiresAt) <= Date.now()
    ? { ...attempt, state: "expired", verificationUrl: null }
    : attempt;
}

function status(personaKey: string): Schemas["IdentityVerificationDto"] {
  const attempts = attemptsOf(personaKey);
  const approved = attempts.find((a) => a.state === "approved");
  const latest = attempts[0] ? live(attempts[0]) : null;
  return {
    verified: Boolean(approved),
    verifiedAt: approved ? approved.createdAt : null,
    available: true,
    latest: latest ? { ...latest, verificationUrl: latest.state === "pending" ? latest.verificationUrl : null } : null,
  };
}

function find(sessionId: string): Attempt | null {
  const id = sessionId.startsWith(SESSION_PREFIX) ? sessionId.slice(SESSION_PREFIX.length) : "";
  for (const attempts of Object.values(state.identityVerifications)) {
    const hit = attempts.find((a) => a.id === id);
    if (hit) return hit;
  }
  return null;
}

const page = (body: string) =>
  new HttpResponse(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fake e-KYC</title></head><body style="font-family:sans-serif;max-width:28rem;margin:2rem auto;padding:0 1rem">${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

export const identityVerificationHandlers: HttpHandler[] = [
  http.get("*/v1/owner/me/identity-verification", ({ request }) => {
    const auth = authenticate(request, "operator");
    if (!auth.ok) return problem("owner.identityVerification.get", "tenant.context_invalid");
    return json(status(auth.persona.key));
  }),

  http.post("*/v1/owner/me/identity-verification", ({ request }) => {
    const op = "owner.identityVerification.start";
    const auth = authenticate(request, "operator");
    if (!auth.ok) return problem(op, "tenant.context_invalid");
    const current = status(auth.persona.key);
    if (current.verified) return problem(op, "identity.already_verified");
    if (current.latest?.state !== "pending") {
      const id = crypto.randomUUID();
      const attempts = attemptsOf(auth.persona.key);
      attempts.forEach((a, i) => (attempts[i] = live(a)));
      attempts.unshift({
        id,
        state: "pending",
        verificationUrl: `${new URL(request.url).origin}/webhooks/ekyc/fake/sessions/${SESSION_PREFIX}${id}`,
        failureReason: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + MINUTES * 60_000).toISOString(),
      });
    }
    return json(status(auth.persona.key));
  }),

  // The fake provider's page (demos and e2e; never in the contract).
  http.get("*/webhooks/ekyc/fake/sessions/:sessionId", ({ params }) => {
    const attempt = find(String(params.sessionId));
    if (!attempt) return new HttpResponse(null, { status: 404 });
    const id = `${SESSION_PREFIX}${attempt.id}`;
    return page(
      `<h1>Fake e-KYC</h1><p>Session <code>${id}</code></p><form method="post" action="${id}/approve"><button>Approve</button></form><form method="post" action="${id}/reject" style="margin-top:1rem"><button>Reject</button></form>`,
    );
  }),

  http.post("*/webhooks/ekyc/fake/sessions/:sessionId/:outcome", ({ params }) => {
    const attempt = find(String(params.sessionId));
    const outcome = String(params.outcome);
    if (!attempt || (outcome !== "approve" && outcome !== "reject")) return new HttpResponse(null, { status: 404 });
    if (attempt.state === "pending") {
      attempt.state = outcome === "approve" ? "approved" : "rejected";
      attempt.verificationUrl = null;
      attempt.failureReason = outcome === "reject" ? "The ID card photo could not be read (fake provider)." : null;
    }
    return page(`<p>${attempt.state}. You can close this page.</p>`);
  }),
];
