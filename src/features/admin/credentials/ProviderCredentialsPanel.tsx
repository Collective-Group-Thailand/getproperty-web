import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { enumParam, param, section, tenantLabel, type AdminContext } from "../shared/server";
import { RevokeProviderCredential, SetProviderCredential } from "./CredentialActions";
import { CREDENTIAL_KINDS } from "./providers";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Which credentials the panel lists: one tenant's (the tenant page), the platform merchant's, or every
 * credential with a tenant filter (the platform page).
 */
export type CredentialScope =
  { type: "tenant"; tenantId: string } | { type: "platform" } | { type: "all"; names: Map<string, string> };

/** `?tenant=` on the platform page: `platform` or a tenant id; anything else lists everything. */
export function scopeQuery(scope: CredentialScope, searchParams: SearchParams): string | undefined {
  if (scope.type === "tenant") return scope.tenantId;
  if (scope.type === "platform") return "platform";
  const tenant = param(searchParams.tenant);
  if (tenant === "platform" || (tenant && scope.names.has(tenant))) return tenant;
  return undefined;
}

/**
 * Provider credentials (F11-4, D-240): metadata only — kind, provider, the last 4 characters of a payment's
 * merchant reference, key names, a fingerprint, where it came from (entered here or imported from the former
 * secrets), when it was set and, for revoked or replaced ones, why. Set and rotate send write-only values; revoke
 * is typed with the fingerprint. The audit note says what is recorded (key names and fingerprint, never values;
 * every decrypt by an adapter).
 */
export async function ProviderCredentialsPanel({
  context,
  scope,
  searchParams,
}: {
  context: AdminContext;
  scope: CredentialScope;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("admin.credentials");
  const { api, locale } = context;
  const kind = enumParam(searchParams.kind, CREDENTIAL_KINDS);
  const includeRevoked = param(searchParams.state) === "all";
  const tenantQuery = scopeQuery(scope, searchParams);
  const list = await section(
    unwrap(
      api.GET("/v1/admin/provider-credentials", {
        params: { query: { tenantId: tenantQuery, kind, includeRevoked } },
      }),
    ),
  );
  // Set here: the tenant of the tenant page, the platform merchant on the platform page.
  const setFor = scope.type === "tenant" ? scope.tenantId : null;
  const providerName = (provider: string) => (t.has(`provider.${provider}`) ? t(`provider.${provider}`) : provider);
  const owner = (row: Schemas["ProviderCredentialDto"]) =>
    row.tenantId === null
      ? t("platformMerchant")
      : scope.type === "all"
        ? tenantLabel(scope.names, row.tenantId, "—")
        : null;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="provider-credentials" data-testid="provider-credentials">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="provider-credentials" className="text-lg font-semibold">
            {scope.type === "tenant" ? t("tenantTitle") : t("listTitle")}
          </h2>
          <p className="text-muted text-sm">{scope.type === "tenant" ? t("tenantHint") : t("platformHint")}</p>
        </div>
        <SetProviderCredential
          tenantId={setFor}
          label={setFor === null ? t("setPlatform") : t("set")}
          testId="set-credential"
        />
      </div>
      <Callout tone="info" icon={IconKey} title={t("auditTitle")}>
        <span data-testid="credential-audit-note">{t("auditBody")}</span>
      </Callout>
      <FilterBar
        fields={[
          ...(scope.type === "all"
            ? [
                {
                  name: "tenant",
                  label: t("filter.tenant"),
                  type: "select" as const,
                  placeholder: t("filter.allTenants"),
                  options: [
                    { value: "platform", label: t("platformMerchant") },
                    ...[...scope.names.entries()].map(([value, label]) => ({ value, label })),
                  ],
                },
              ]
            : []),
          {
            name: "kind",
            label: t("filter.kind"),
            type: "select",
            placeholder: t("filter.allKinds"),
            options: CREDENTIAL_KINDS.map((value) => ({ value, label: t(`kind.${value}`) })),
          },
          {
            name: "state",
            label: t("filter.state"),
            type: "select",
            placeholder: t("filter.live"),
            options: [{ value: "all", label: t("filter.withRevoked") }],
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconKey} title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <SimpleTable
          caption={scope.type === "tenant" ? t("tenantTitle") : t("listTitle")}
          testId="credential-table"
          minWidth="68rem"
          columns={[
            { key: "account", header: t("col.account") },
            { key: "keys", header: t("col.keys") },
            { key: "fingerprint", header: t("col.fingerprint") },
            { key: "source", header: t("col.source") },
            { key: "created", header: t("col.created") },
            { key: "state", header: t("col.state") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={list.data.map((row) => {
            const live = row.revokedAt === null;
            return {
              key: row.id,
              testId: "credential-row",
              data: { kind: row.kind, provider: row.provider, live: String(live), fingerprint: row.fingerprint },
              cells: {
                account: (
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {providerName(row.provider)} · {t(`kind.${row.kind}`)}
                    </span>
                    {row.accountRefHint ? (
                      <span className="text-muted text-xs">{t("refHint", { hint: row.accountRefHint })}</span>
                    ) : null}
                    {owner(row) ? <span className="text-muted text-xs">{owner(row)}</span> : null}
                  </span>
                ),
                keys: (
                  <span className="flex flex-wrap gap-1">
                    {row.keyNames.map((name) => (
                      <code key={name} className="bg-bg-subtle rounded px-1 text-xs">
                        {name}
                      </code>
                    ))}
                  </span>
                ),
                fingerprint: <code className="font-mono text-xs">{row.fingerprint}</code>,
                source: (
                  <Badge size="sm" tone={row.source === "import" ? "info" : "neutral"}>
                    {t(`source.${row.source}`)}
                  </Badge>
                ),
                created: formatDateTime(row.createdAt, locale),
                state: live ? (
                  <Badge size="sm" tone="success" icon={IconCheckCircle}>
                    {t("live")}
                  </Badge>
                ) : (
                  <span className="flex flex-col gap-1">
                    <Badge size="sm" tone="neutral" icon={IconXCircle}>
                      {t("revokedAt", { date: formatDateTime(row.revokedAt!, locale) })}
                    </Badge>
                    {row.revokeReason ? <span className="text-muted text-xs">{row.revokeReason}</span> : null}
                  </span>
                ),
                actions: live ? (
                  <span className="flex flex-wrap justify-end gap-2">
                    <SetProviderCredential
                      tenantId={row.tenantId}
                      preset={{
                        kind: row.kind,
                        provider: row.provider,
                        keyNames: row.keyNames,
                        accountRefHint: row.accountRefHint,
                      }}
                      label={t("rotate")}
                      testId="rotate-credential"
                    />
                    <RevokeProviderCredential credential={row} />
                  </span>
                ) : null,
              },
            };
          })}
        />
      )}
    </section>
  );
}
