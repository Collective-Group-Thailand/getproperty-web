import { getTranslations } from "next-intl/server";

import { CONTRACT_DOCUMENT_STATUS, CONTRACT_DOCUMENT_VALUES, LEGAL_REVIEW_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconSign } from "@/ui/icons/glyphs/sign";

import { ownerPath } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import { ContractCreate, type ContractCreateOptions } from "./ContractCreate";
import { ContractsNav } from "./ContractsNav";
import { isSignableKind, SIGNABLE_KINDS } from "./labels";

type SearchParams = Record<string, string | string[] | undefined>;
const LEASE_OPEN = new Set<Schemas["LeaseStatus"]>(["pending_signature", "active", "notice_given", "ending"]);

/**
 * Signable contracts (G3, D-294): reservations, lease addenda, brokerage mandates and co-broke agreements — each on a
 * pinned template version, numbered and hashed when sent, signed by every party (D-062) and archived under legal
 * hold. *New contract* takes only what the user types; the API fills everything else from the unit, lease, mandate or
 * agreement. `?new=<kind>` (with `lease`, `mandate` or `agreement`) opens the dialog from another page.
 */
export async function ContractsListView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.contracts");
  const { api, locale, me } = context;
  const kindParam = param(searchParams.kind);
  const stateParam = param(searchParams.state);
  const kind = SIGNABLE_KINDS.find((value) => value === kindParam);
  const state = CONTRACT_DOCUMENT_VALUES.find((value) => value === stateParam);
  const canManage = !readOnly(me) && ownerCan(me, "lease.manage");
  const isAgency = me.currentTenant?.type === "agency";

  const [list, options] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/contracts", {
          params: {
            query: { kind, state, page: pageParam(searchParams.page), perPage: 25, sort: "createdAt", order: "desc" },
          },
        }),
      ),
    ),
    canManage ? createOptions(context, isAgency) : Promise.resolve(null),
  ]);
  const requested = param(searchParams.new);

  return (
    <OwnerPage testId="contracts">
      <PageHeader
        title={t("documents.title")}
        description={t("documents.description")}
        actions={
          options ? (
            <ContractCreate
              options={options}
              defaults={{
                open: Boolean(requested),
                kind: requested && isSignableKind(requested) ? requested : undefined,
                leaseId: param(searchParams.lease),
                mandateId: param(searchParams.mandate),
                agreementId: param(searchParams.agreement),
              }}
            />
          ) : null
        }
      />
      {isAgency ? null : <ContractsNav current="/contracts/documents" locale={locale} />}
      <FilterBar
        fields={[
          {
            name: "kind",
            label: t("library.filter.kind"),
            type: "select",
            placeholder: t("library.filter.allKinds"),
            options: SIGNABLE_KINDS.map((value) => ({ value, label: t(`kind.${value}`) })),
          },
          {
            name: "state",
            label: t("documents.filterState"),
            type: "select",
            placeholder: t("documents.allStates"),
            options: CONTRACT_DOCUMENT_VALUES.map((value) => ({
              value,
              label: t(`documents.state.${value}`),
            })),
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={IconSign} title={t("documents.empty")} description={t("documents.emptyHint")} />
        </Card>
      ) : (
        <>
          <ul
            className="divide-border border-border bg-surface rounded-card m-0 list-none divide-y border p-0"
            data-testid="contract-rows"
          >
            {list.data.data.map((contract) => {
              const signed = contract.signers.filter((signer) => signer.signedAt).length;
              return (
                <li key={contract.id} data-testid="contract-row" data-kind={contract.kind} data-state={contract.state}>
                  <a
                    href={ownerPath(locale, `/contracts/documents/${contract.id}`)}
                    className="hover:bg-bg-subtle flex items-center justify-between gap-4 px-4 py-4 md:px-5"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{contract.title}</span>
                        <StatusBadgeOf map={CONTRACT_DOCUMENT_STATUS} value={contract.state} size="sm" />
                        <StatusBadgeOf map={LEGAL_REVIEW_STATUS} value={contract.legalReviewState} size="sm" />
                      </span>
                      <span className="text-muted flex flex-wrap gap-x-3 text-sm">
                        <Badge size="sm">{t(`kind.${contract.kind}`)}</Badge>
                        {contract.number ? <span className="tabular-nums">{contract.number}</span> : null}
                        <span>{t("documents.signedCount", { signed, total: contract.signers.length })}</span>
                        <span>{t("documents.createdOn", { date: formatDate(contract.createdAt, locale) })}</span>
                      </span>
                    </span>
                    <Icon icon={IconChevronRight} className="text-muted shrink-0" />
                  </a>
                </li>
              );
            })}
          </ul>
          <ListPagination
            meta={list.data.meta}
            path={ownerPath(locale, "/contracts/documents")}
            searchParams={searchParams}
            locale={locale}
          />
        </>
      )}
    </OwnerPage>
  );
}

/** What the create dialog may offer — each list is the API's; a kind with nothing to attach to is not offered. */
async function createOptions(context: OwnerContext, isAgency: boolean): Promise<ContractCreateOptions> {
  const { api } = context;
  const t = await getTranslations("owner.contracts");
  const [units, parties, leases, mandates, coBrokes, library] = await Promise.all([
    isAgency
      ? null
      : section(unwrap(api.GET("/v1/owner/units", { params: { query: { perPage: 100, sort: "unitNo" } } }))),
    isAgency ? null : section(unwrap(api.GET("/v1/owner/parties", { params: { query: { perPage: 100 } } }))),
    isAgency
      ? null
      : section(
          unwrap(
            api.GET("/v1/owner/leases", { params: { query: { perPage: 100, sort: "startDate", order: "desc" } } }),
          ),
        ),
    isAgency ? null : section(unwrap(api.GET("/v1/owner/mandates", { params: { query: { role: "owner" } } }))),
    isAgency ? section(unwrap(api.GET("/v1/owner/co-broke-agreements"))) : null,
    section(unwrap(api.GET("/v1/owner/contract-library"))),
  ]);
  const own = context.me.currentTenant?.id;
  return {
    units: (units?.data?.data ?? []).map((unit) => ({ id: unit.id, label: unit.unitNo })),
    parties: (parties?.data?.data ?? []).map((party) => ({ id: party.id, label: party.displayName })),
    leases: (leases?.data?.data ?? [])
      .filter((lease) => LEASE_OPEN.has(lease.status))
      .map((lease) => ({
        id: lease.id,
        label: [lease.unitNo, lease.lesseeName, lease.number].filter(Boolean).join(" · "),
      })),
    mandates: (mandates?.data?.data ?? [])
      .filter((mandate) => mandate.state === "accepted" || mandate.state === "active")
      .map((mandate) => ({ id: mandate.id, label: `${mandate.unitNo} · ${mandate.agencyName}` })),
    agreements: (coBrokes?.data?.data ?? [])
      .filter((agreement) => agreement.listingAgencyTenantId === own && agreement.state !== "cancelled")
      .map((agreement) => ({ id: agreement.id, label: `${agreement.coAgencyName} · ${agreement.splitPercent}%` })),
    templates: (library.data?.data ?? []).flatMap((template) =>
      isSignableKind(template.kind)
        ? template.versions
            .filter((version) => version.state === "published")
            .map((version) => ({
              id: version.id,
              kind: template.kind as Schemas["SignableContractKind"],
              language: version.language,
              own: !template.platform,
              label: `${template.name} · ${t("versionLabel", {
                language: t(`language.${version.language}`),
                version: version.version,
              })}`,
            }))
        : [],
    ),
  };
}
