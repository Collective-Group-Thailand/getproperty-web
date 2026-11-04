import { getTranslations } from "next-intl/server";

import { formatPhone } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
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
  const type = param(searchParams.type);
  const filtered = Boolean(param(searchParams.q) || type);
  return (
    <OwnerPage testId="parties">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<NewPartyButton defaultOpen={param(searchParams.new) === "1"} />}
      />
      <ListToolbar
        tabs={
          <PartiesNav
            context={context}
            current="/parties"
            counts={{ "/parties/link-requests": linkRequests, "/tm30": tm30 }}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
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
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconResidents}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/parties")}>{t("empty.clear")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/parties?new=1")}>{t("empty.add")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="party-list"
          stackOnPhones
          minWidth="44rem"
          columns={[
            { key: "name", header: t("column.name"), phone: "title" },
            { key: "contact", header: t("column.contact"), phone: "meta" },
            { key: "type", header: t("column.type"), phone: "hidden" },
            { key: "line", header: t("column.line"), phone: "status" },
          ]}
          rows={list.data.map((party) => ({
            key: party.id,
            href: ownerPath(locale, `/parties/${party.id}`),
            testId: "party-row",
            cells: {
              name: (
                <span className="flex items-center gap-3">
                  <Icon
                    icon={party.type === "company" ? IconResidents : IconResident}
                    className="text-subtle shrink-0 max-md:hidden"
                    size={18}
                  />
                  <span className="min-w-0 truncate">{party.displayName}</span>
                </span>
              ),
              contact: (
                <span className="text-muted">
                  {[party.phone ? formatPhone(party.phone) : null, party.email].filter(Boolean).join(" · ") ||
                    t("noContact")}
                </span>
              ),
              type: (
                <span className="text-muted">{party.type === "company" ? t("form.company") : t("form.person")}</span>
              ),
              line: party.lineLinked ? (
                <Badge tone="success" size="sm" icon={IconChat}>
                  {t("lineLinked")}
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  {t("notLinked")}
                </Badge>
              ),
            },
          }))}
        />
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
