import type { Schemas } from "@/lib/api/types";

export type CredentialKind = Schemas["ProviderCredentialKind"];

export const CREDENTIAL_KINDS = ["payment", "lock", "etax"] as const satisfies readonly CredentialKind[];

/**
 * Providers per kind, as the contract documents them on `ProviderCredentialDto.provider` ("payment: kbank | scb |
 * opn · lock: ttlock | tuya · etax: inet") — the adapters getproperty-api has (`CREDENTIAL_PROVIDERS`, O-001, D-070,
 * D-215). The contract types `provider` as a string, so the API stays the judge: an unknown one is refused with
 * `validation.failed` on `provider` (docs/contract-requests.md asks for an enum).
 */
export const CREDENTIAL_PROVIDERS: Record<CredentialKind, readonly string[]> = {
  payment: ["kbank", "scb", "opn"],
  lock: ["ttlock", "tuya"],
  etax: ["inet"],
};

/**
 * The key names each real adapter reads (getproperty-api `src/integrations/{payments,locks,etax}`, all
 * `// UNVERIFIED against live provider`) — offered as the form's starting rows; the admin may rename, add or
 * remove keys, and the API validates the document (1–20 keys, `^[A-Za-z][A-Za-z0-9_]{0,63}$`).
 */
export const CREDENTIAL_KEY_TEMPLATES: Record<string, readonly string[]> = {
  kbank: ["consumerId", "consumerSecret", "partnerId", "partnerSecret", "merchantId", "webhookSecret"],
  scb: ["apiKey", "apiSecret", "billerId", "webhookSecret"],
  opn: ["secretKey", "webhookSecret"],
  ttlock: ["clientId", "clientSecret", "username", "password"],
  tuya: ["accessId", "accessSecret"],
  inet: ["apiKey", "userCode", "accessKey"],
};

/** The API's limits on the write-only document and the reason (`ProviderCredentialSetDto`, `credentialProblems`). */
export const CREDENTIAL_LIMITS = {
  maxKeys: 20,
  maxValueLength: 4096,
  keyName: /^[A-Za-z][A-Za-z0-9_]{0,63}$/,
  reasonMin: 3,
  reasonMax: 500,
  merchantRefMax: 100,
} as const;

export function providersFor(kind: CredentialKind): readonly string[] {
  return CREDENTIAL_PROVIDERS[kind];
}

/** The starting key names of a provider (none for a provider this app does not know). */
export function keyTemplate(provider: string): string[] {
  return [...(CREDENTIAL_KEY_TEMPLATES[provider] ?? [])];
}

/** The platform's own merchant has payment credentials only (`tenantId: null`, D-240). */
export function kindsFor(tenantId: string | null): readonly CredentialKind[] {
  return tenantId === null ? ["payment"] : CREDENTIAL_KINDS;
}

/**
 * The write-only document from the form's rows: key name → value, rows with an empty name and an empty value
 * dropped. Values are passed through unchanged (no trimming: a secret may legitimately end in a space).
 */
export function credentialValues(rows: { name: string; value: string }[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name && !row.value) continue;
    values[name] = row.value;
  }
  return values;
}

/**
 * What the form can tell before sending (the API re-checks everything): duplicated, malformed or empty key names,
 * empty or oversized values, too many keys. Messages are keys of `admin.credentials.form.problem`.
 */
export function credentialFormProblems(rows: { name: string; value: string }[]): string[] {
  const problems = new Set<string>();
  const seen = new Set<string>();
  const used = rows.filter((row) => row.name.trim() || row.value);
  if (used.length === 0) problems.add("noKeys");
  if (used.length > CREDENTIAL_LIMITS.maxKeys) problems.add("tooManyKeys");
  for (const row of used) {
    const name = row.name.trim();
    if (!CREDENTIAL_LIMITS.keyName.test(name)) problems.add("keyName");
    if (seen.has(name)) problems.add("duplicateKey");
    seen.add(name);
    if (!row.value) problems.add("emptyValue");
    if (row.value.length > CREDENTIAL_LIMITS.maxValueLength) problems.add("valueTooLong");
  }
  return [...problems];
}
