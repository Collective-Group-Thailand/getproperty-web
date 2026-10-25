import { http, type HttpHandler } from "msw";

import { OPERATORS, TENANTS } from "../fixtures";
import { state, type MockIdentity } from "../state";
import { authenticate, issueTokens, json, problem } from "./support";

/**
 * Sign-in with Google / Apple / LINE (D-255, D-283) against the readable fake tokens the web's fake provider page
 * produces — the same ones getproperty-api's fake verifiers accept: `fake-firebase.<google|apple>.<uid>[.<email>]`
 * and `fake-line.<base64url(claims)>`. Seeded: the `landlord` persona has Google `landlord-google` linked.
 */

type TokenIdentity = { provider: MockIdentity["provider"]; subject: string; email: string | null; name: string | null };

function parse(provider: string | undefined, idToken: string | undefined): TokenIdentity | null {
  if (!idToken) return null;
  if (provider === "line") {
    if (!idToken.startsWith("fake-line.")) return null;
    try {
      const claims = JSON.parse(Buffer.from(idToken.slice(10), "base64url").toString("utf8")) as {
        sub?: string;
        name?: string;
      };
      return claims.sub ? { provider: "line", subject: claims.sub, email: null, name: claims.name ?? null } : null;
    } catch {
      return null;
    }
  }
  const [marker, kind, uid, ...rest] = idToken.split(".");
  if (marker !== "fake-firebase" || !uid || `firebase_${kind}` !== provider) return null;
  const email = rest.join(".");
  return {
    provider: provider as MockIdentity["provider"],
    subject: uid,
    email: email ? decodeURIComponent(email) : null,
    name: null,
  };
}

const find = (identity: TokenIdentity) =>
  state.identities.find((row) => row.provider === identity.provider && row.subject === identity.subject);

function listOf(personaKey: string) {
  const persona = OPERATORS.find((p) => p.key === personaKey)!;
  return {
    phoneMasked: persona.user.phone ? `0${persona.user.phone.slice(3, 4)}•-•••-${persona.user.phone.slice(-4)}` : null,
    hasPassword: Boolean(persona.password),
    identities: state.identities
      .filter((row) => row.personaKey === personaKey)
      .map((row) => ({
        id: row.id,
        provider: row.provider,
        displayName: row.displayName,
        email: row.email,
        linkedAt: row.linkedAt,
        lastSeenAt: row.linkedAt,
        removable: row.provider !== "line",
      })),
  };
}

function signedIn(personaKey: string) {
  const persona = OPERATORS.find((p) => p.key === personaKey)!;
  return json({
    ...issueTokens("operator", personaKey),
    subject: {
      id: persona.user.id,
      type: "user",
      audience: "operator",
      roles: persona.memberships.length === 1 ? [persona.memberships[0]!.role] : [],
      permissions: [],
      scopes: persona.memberships.map((m) => `tenant:${TENANTS[m.tenant].profile.id}`),
    },
  });
}

export const identityHandlers: HttpHandler[] = [
  http.post("*/v1/auth/operator/identity", async ({ request }) => {
    const op = "auth.operatorIdentity.exchange";
    const body = (await request.json().catch(() => ({}))) as { provider?: string; idToken?: string };
    const identity = parse(body.provider, body.idToken);
    if (!identity)
      return problem(op, body.provider === "line" ? "auth.line_token_invalid" : "auth.identity_token_invalid");
    const row = find(identity);
    if (!row) return problem(op, "auth.identity_not_linked");
    return signedIn(row.personaKey);
  }),

  http.get("*/v1/owner/me/identities", ({ request }) => {
    const auth = authenticate(request, "operator");
    if (!auth.ok) return problem("owner.identities.list", "tenant.context_invalid");
    return json(listOf(auth.persona.key));
  }),

  http.post("*/v1/owner/me/identities", async ({ request }) => {
    const op = "owner.identities.link";
    const auth = authenticate(request, "operator");
    if (!auth.ok) return problem(op, "tenant.context_invalid");
    const body = (await request.json().catch(() => ({}))) as { provider?: string; idToken?: string };
    const identity = parse(body.provider, body.idToken);
    if (!identity)
      return problem(op, body.provider === "line" ? "auth.line_token_invalid" : "auth.identity_token_invalid");
    const row = find(identity);
    if (row && row.personaKey !== auth.persona.key) return problem(op, "auth.identity_in_use");
    if (!row) {
      state.identities.push({
        id: crypto.randomUUID(),
        personaKey: auth.persona.key,
        provider: identity.provider,
        subject: identity.subject,
        displayName: identity.name,
        email: identity.email,
        linkedAt: new Date().toISOString(),
      });
    }
    return json(listOf(auth.persona.key));
  }),

  http.delete("*/v1/owner/me/identities/:identityId", ({ request, params }) => {
    const op = "owner.identities.unlink";
    const auth = authenticate(request, "operator");
    if (!auth.ok) return problem(op, "tenant.context_invalid");
    const index = state.identities.findIndex(
      (row) => row.id === params.identityId && row.personaKey === auth.persona.key,
    );
    if (index < 0) return problem(op, "http.not_found");
    if (state.identities[index]!.provider === "line") return problem(op, "auth.identity_locked");
    const others = state.identities.filter((row) => row.personaKey === auth.persona.key).length - 1;
    if (others === 0 && !auth.persona.user.phone && !auth.persona.password) return problem(op, "auth.identity_last");
    state.identities.splice(index, 1);
    return json(listOf(auth.persona.key));
  }),
];

/** A landlord signing up with Google / Apple / LINE: the token's identity is linked to the `signup` persona. */
export function signUpIdentity(provider: string | undefined, idToken: string | undefined): TokenIdentity | null {
  return parse(provider, idToken);
}

export function linkSignUpIdentity(identity: TokenIdentity): void {
  if (find(identity)) return;
  state.identities.push({
    id: crypto.randomUUID(),
    personaKey: "signup",
    provider: identity.provider,
    subject: identity.subject,
    displayName: identity.name,
    email: identity.email,
    linkedAt: new Date().toISOString(),
  });
}
