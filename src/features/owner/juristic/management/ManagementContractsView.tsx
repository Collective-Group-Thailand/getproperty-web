import { getTranslations } from "next-intl/server";

import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { ViewTabs } from "@/ui/components/ListToolbar";

import { ContractRecordView } from "../../pm/ContractRecord";
import { ContractList, loadContract } from "../../pm/PmViews";
import { JURISTIC_CONTRACT_TABS, juristicContractTab } from "../../pm/pm";
import { ownerPath, withQuery } from "../../shared/links";
import { focusedBuilding, pageParam, param, section, type OwnerContext } from "../../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;

const TAB_STATE: Readonly<Record<string, Schemas["ManagementContractState"] | undefined>> = {
  active: "active",
  offered: "offered",
  draft: "draft",
  all: undefined,
};

/**
 * `/juristic/management-contracts` (JW3b, D-334): the office's contracts with PM companies — running, offered, drafts
 * — scoped by the rail's building switcher. Drafts are written by the API's editor (a follow-up in the console).
 */
export async function ManagementContractsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.pm.juristic");
  const pm = await getTranslations("owner.pm.contracts");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const scope = building ? { buildingId: building.id } : {};
  const count = (state: Schemas["ManagementContractState"] | undefined) =>
    unwrap(
      api.GET("/v1/owner/juristic/management-contracts", {
        params: { query: { perPage: 1, ...scope, ...(state ? { state } : {}) } },
      }),
    )
      .then((answer) => answer.meta.total)
      .catch(() => undefined);
  const counts = await Promise.all(JURISTIC_CONTRACT_TABS.map((tab) => count(TAB_STATE[tab])));
  const tab = juristicContractTab(param(searchParams.tab));
  const state = TAB_STATE[tab];
  const page = pageParam(searchParams.page);
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/management-contracts", {
        params: { query: { page, perPage: 25, ...scope, ...(state ? { state } : {}) } },
      }),
    ),
  );
  const base = ownerPath(locale, "/juristic/management-contracts");
  return (
    <OwnerPage testId="juristic-management-contracts">
      <PageHeader
        title={t("title")}
        description={building ? t("ledeBuilding", { building: building.name }) : t("lede")}
      />
      <ViewTabs
        label={pm("tabs")}
        current={tab}
        tabs={JURISTIC_CONTRACT_TABS.map((which, index) => ({
          key: which,
          href: withQuery(base, { tab: which }),
          label: t(`tab.${which}`),
          count: counts[index],
          testId: `jmc-tab-${which}`,
        }))}
      />
      <ContractList context={context} side="juristic" list={list} tab={tab} />
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/** `/juristic/management-contracts/[contractId]` (JW3b): the shared record from the office's side. */
export async function ManagementContractView({ context, contractId }: { context: OwnerContext; contractId: string }) {
  const { api } = context;
  const path = { params: { path: { contractId } } };
  const contract = await loadContract(() =>
    unwrap(api.GET("/v1/owner/juristic/management-contracts/{contractId}", path)),
  );
  const started = ["active", "ended", "terminated"].includes(contract.state);
  const [charges, staff] = await Promise.all([
    started
      ? unwrap(api.GET("/v1/owner/juristic/management-contracts/{contractId}/charges", path)).catch(() => [])
      : Promise.resolve(null),
    started
      ? unwrap(api.GET("/v1/owner/juristic/management-contracts/{contractId}/staff", path)).catch(() => [])
      : Promise.resolve(null),
  ]);
  return <ContractRecordView context={context} contract={contract} side="juristic" charges={charges} staff={staff} />;
}
