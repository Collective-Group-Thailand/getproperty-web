import { getTranslations } from "next-intl/server";

import { formatPhone } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconResident } from "@/ui/icons/glyphs/resident";
import { IconResidents } from "@/ui/icons/glyphs/residents";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerCan, pageParam, param, type OwnerContext } from "../shared/server";
import { linkRequestsPending, openTm30 } from "./counts";
import { PartiesNav } from "./PartiesNav";
import { NewPartyButton } from "./PartyForm";

type SearchParams = Record<string, string | string[] | undefined>;

/** Residents and other parties of the tenant (F2 2.2): search, LINE link state, one click to each. */
export async function PartiesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.parties");
  const { api, locale } = context;
  const page = pageParam(searchParams.page);
  const [list, linkRequests, tm30] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/parties", {
        params: {
          query: {
            page,
            perPage: 25,
            q: param(searchParams.q),
            type: param(searchParams.type) as never,
          },
        },
      }),
    ),
    linkRequestsPending(api),
    ownerCan(context.me, "tm30.manage")
      ? openTm30(api).then(
          (rows) => rows.length,
          () => undefined,
        )
      : Promise.resolve(undefined),
  ]);
  return (
    <OwnerPage testId="parties">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<NewPartyButton defaultOpen={param(searchParams.new) === "1"} />}
      />
      <PartiesNav
        context={context}
        current="/parties"
        counts={{ "/parties/link-requests": linkRequests, "/tm30": tm30 }}
      />
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          {
            name: "type",
            label: t("filter.type"),
            type: "select",
            placeholder: t("filter.allTypes"),
            options: [
              { value: "person", label: t("form.person") },
              { value: "company", label: t("form.company") },
            ],
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconResidents} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="party-list">
          {list.data.map((party) => (
            <li key={party.id}>
              <a
                href={ownerPath(locale, `/parties/${party.id}`)}
                className="hover:bg-bg-subtle flex items-center gap-3 px-4 py-3"
                data-testid="party-row"
              >
                <Icon icon={party.type === "company" ? IconResidents : IconResident} className="text-muted" size={20} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{party.displayName}</span>
                  <span className="text-muted text-sm">
                    {[party.phone ? formatPhone(party.phone) : null, party.email].filter(Boolean).join(" · ") ||
                      t("noContact")}
                  </span>
                </span>
                {party.lineLinked ? (
                  <Badge tone="success" size="sm" icon={IconChat}>
                    {t("lineLinked")}
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="sm">
                    {t("notLinked")}
                  </Badge>
                )}
                <Icon icon={IconChevronRight} className="text-muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/parties")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
