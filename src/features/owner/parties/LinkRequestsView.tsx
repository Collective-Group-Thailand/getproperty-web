import { getTranslations } from "next-intl/server";

import { LINK_REQUEST_STATUS, LINK_REQUEST_VALUES } from "@/domain/status/linkRequest";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerPath } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { linkRequestsPending, openTm30 } from "./counts";
import { LinkRequestActions } from "./LinkRequestActions";
import { PartiesNav } from "./PartiesNav";

type SearchParams = Record<string, string | string[] | undefined>;

/** One link request as a row: who signed in, which party their phone matched, when, and the decision. */
export async function LinkRequestRow({
  request,
  locale,
  canDecide,
  showParty = true,
}: {
  request: Schemas["PartyLinkRequestDto"];
  locale: Locale;
  canDecide: boolean;
  showParty?: boolean;
}) {
  const t = await getTranslations("owner.parties.linkRequests");
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-3"
      data-testid="link-request-row"
      data-state={request.state}
      data-request={request.id}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">
          {t("login", { login: request.userDisplayName ?? t("unnamedLogin") })}
          {request.lineLinked ? (
            <Badge tone="info" size="sm" className="ms-2">
              {t("lineToo")}
            </Badge>
          ) : null}
        </span>
        <span className="text-muted text-sm">
          {showParty ? (
            <>
              {t("matched")}{" "}
              <a className="underline-offset-4 hover:underline" href={ownerPath(locale, `/parties/${request.partyId}`)}>
                {request.partyDisplayName}
              </a>
              {" · "}
            </>
          ) : null}
          {t("requestedAt", { date: formatDateTime(request.requestedAt, locale) })}
          {request.decidedAt ? ` · ${t("decidedAt", { date: formatDateTime(request.decidedAt, locale) })}` : ""}
        </span>
        {request.rejectReason ? <span className="text-muted text-sm">{request.rejectReason}</span> : null}
      </span>
      <StatusBadgeOf map={LINK_REQUEST_STATUS} value={request.state} size="sm" />
      {canDecide ? <LinkRequestActions request={request} /> : null}
    </div>
  );
}

/**
 * Phone sign-ins waiting for the Owner (D-226): a resident or technician who signed in with the SMS code
 * of a phone an operator entered is linked to that party only once the Owner confirms who it is. Pending
 * first; the decided ones stay as history (state filter).
 */
export async function LinkRequestsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.parties.linkRequests");
  const states = await getTranslations("status.linkRequest");
  const { api, locale, me } = context;
  const stateParam = param(searchParams.state) ?? "pending";
  const state = LINK_REQUEST_VALUES.includes(stateParam as Schemas["PartyLinkRequestState"])
    ? (stateParam as Schemas["PartyLinkRequestState"])
    : undefined;
  const [list, pending, tm30] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/party-link-requests", {
        params: { query: { state, page: pageParam(searchParams.page), perPage: 25 } },
      }),
    ),
    linkRequestsPending(api),
    ownerCan(me, "tm30.manage")
      ? openTm30(api).then(
          (rows) => rows.length,
          () => undefined,
        )
      : Promise.resolve(undefined),
  ]);
  const canDecide = ownerCan(me, "party.link.manage") && !readOnly(me);
  return (
    <OwnerPage testId="link-requests">
      <PageHeader title={t("title")} description={t("description")} />
      <PartiesNav
        context={context}
        current="/parties/link-requests"
        counts={{ "/parties/link-requests": pending, "/tm30": tm30 }}
      />
      {!canDecide ? (
        <Callout tone="info">{t("ownerOnly")}</Callout>
      ) : (
        <Callout tone="info" title={t("howTitle")}>
          {t("howBody")}
        </Callout>
      )}
      <FilterBar
        fields={[
          {
            name: "state",
            label: t("filter.state"),
            type: "select",
            // No parameter = the pending ones (what needs the Owner); `all` lifts the filter.
            placeholder: states("pending"),
            options: [
              ...LINK_REQUEST_VALUES.filter((value) => value !== "pending").map((value) => ({
                value,
                label: states(value),
              })),
              { value: "all", label: t("filter.all") },
            ],
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul
          className="divide-border border-border bg-surface rounded-card divide-y border"
          data-testid="link-request-list"
        >
          {list.data.map((request) => (
            <li key={request.id}>
              <LinkRequestRow request={request} locale={locale} canDecide={canDecide} />
            </li>
          ))}
        </ul>
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/parties/link-requests")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
