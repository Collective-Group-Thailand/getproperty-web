import { getTranslations } from "next-intl/server";

import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { cn } from "@/ui/lib/cn";

import { enumParam, param, section, tenantLabel, type AdminContext } from "../shared/server";
import { RevokeProviderCredential, SetProviderCredential } from "./CredentialActions";
import { CREDENTIAL_KINDS } from "./providers";

/** A secret as the console shows it: never the value (write-only), always the same eight dots. */
const MASK = "••••••••";

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
  const path = scope.type === "tenant" ? `/tenants/${scope.tenantId}/credentials` : "/provider-credentials";
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

  const filtered = Boolean(kind || includeRevoked || (scope.type === "all" && tenantQuery));
  return (
    <section className="flex flex-col gap-4" aria-label={t("listTitle")} data-testid="provider-credentials">
      <div
        role="note"
        className="border-border bg-surface rounded-card shadow-card flex items-start gap-3 border p-4 text-sm"
      >
        <Icon icon={IconLock} className="text-primary mt-0.5 shrink-0 text-lg" />
        <p className="min-w-0">
          <span className="font-semibold">{t("auditTitle")}</span>{" "}
          <span className="text-muted" data-testid="credential-audit-note">
            {t("auditBody")}
          </span>
        </p>
      </div>
      <ListToolbar
        filters={
          <FilterBar
            variant="toolbar"
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
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconKey}
          title={filtered ? t("emptyFiltered") : t("empty")}
          description={filtered ? undefined : t("emptyHint")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={path}>{t("clear")}</a>
              </Button>
            ) : (
              <SetProviderCredential
                tenantId={setFor}
                label={setFor === null ? t("setPlatform") : t("set")}
                testId="set-credential-empty"
              />
            )
          }
        />
      ) : (
        <SimpleTable
          caption={scope.type === "tenant" ? t("tenantTitle") : t("listTitle")}
          testId="credential-table"
          stackOnPhones
          minWidth="64rem"
          columns={[
            { key: "account", header: t("col.account"), phone: "title" },
            { key: "keys", header: t("col.keys"), phone: "meta" },
            { key: "fingerprint", header: t("col.fingerprint"), phone: "hidden" },
            { key: "created", header: t("col.created"), phone: "meta" },
            { key: "state", header: t("col.state"), phone: "status" },
            {
              key: "actions",
              header: <span className="sr-only">{t("col.actions")}</span>,
              phone: "figure",
              className: "w-14",
            },
          ]}
          rows={list.data.map((row) => {
            const live = row.revokedAt === null;
            return {
              key: row.id,
              testId: "credential-row",
              data: { kind: row.kind, provider: row.provider, live: String(live), fingerprint: row.fingerprint },
              cells: {
                account: (
                  <span className={cn("flex flex-col", !live && "text-muted")}>
                    <span className="font-medium">{providerName(row.provider)}</span>
                    <span className="text-muted text-sm font-normal">
                      {[
                        t(`kind.${row.kind}`),
                        row.accountRefHint ? t("refHint", { hint: row.accountRefHint }) : null,
                        owner(row),
                        row.source === "import" ? t("source.import") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                ),
                keys: (
                  <span className={cn("flex flex-col gap-0.5 font-mono text-sm", !live && "text-muted")}>
                    {row.keyNames.map((name) => (
                      <span key={name} className="whitespace-nowrap">
                        {name}: <span aria-label={t("masked")}>{MASK}</span>
                      </span>
                    ))}
                  </span>
                ),
                fingerprint: <code className="text-muted font-mono text-sm">{row.fingerprint}</code>,
                created: <span className="whitespace-nowrap">{formatDate(row.createdAt, locale)}</span>,
                state: live ? (
                  <Badge size="sm" tone="success" icon={IconCheckCircle}>
                    {t("live")}
                  </Badge>
                ) : (
                  <span className="flex flex-col gap-1">
                    <Badge size="sm" tone="neutral" icon={IconXCircle}>
                      {t("revokedAt", { date: formatDate(row.revokedAt!, locale) })}
                    </Badge>
                    {row.revokeReason ? <span className="text-muted text-sm">{row.revokeReason}</span> : null}
                  </span>
                ),
                actions: live ? (
                  <ActionMenu label={t("more", { provider: providerName(row.provider) })}>
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
                  </ActionMenu>
                ) : null,
              },
            };
          })}
        />
      )}
    </section>
  );
}
