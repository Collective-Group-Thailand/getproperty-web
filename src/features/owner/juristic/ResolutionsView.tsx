import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { RESOLUTION_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatBytes, formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { Paper, PaperHead, PaperSection } from "@/ui/components/Paper";
import { RowList } from "@/ui/components/RowList";
import { IconRules } from "@/ui/icons/glyphs/rules";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath, withQuery } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import {
  AdoptResolutionButton,
  AttachDocumentButton,
  EditResolutionButton,
  NewResolutionButton,
  RemoveDocumentButton,
  VoidResolutionButton,
} from "./ResolutionActions";

type SearchParams = Record<string, string | string[] | undefined>;
const STATES: Schemas["ResolutionState"][] = ["draft", "adopted", "void"];

/**
 * Meeting resolutions (JW1a, D-304): what the general meeting or the committee decided, recorded as drafted and then
 * adopted — budgets are approved with an adopted resolution and juristic rates name one. Newest meeting first.
 */
export async function ResolutionsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.juristic.resolution");
  const { api, locale, me } = context;
  const state = enumParam(searchParams.state, STATES);
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const base = ownerPath(locale, "/juristic/resolutions");
  const [list, drafts] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/resolutions", {
          params: { query: { page, perPage: 25, ...(state ? { state } : {}), ...(q ? { q } : {}) } },
        }),
      ),
    ),
    section(
      unwrap(api.GET("/v1/owner/juristic/resolutions", { params: { query: { state: "draft", perPage: 1 } } })).then(
        (result) => result.meta.total,
      ),
    ),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.resolution.manage");
  const buildings = context.buildings.map((building) => ({ id: building.id, name: building.name }));
  const buildingName = (id: string) => context.buildings.find((building) => building.id === id)?.name ?? "—";
  const rows = list.data?.data ?? [];
  const filtered = Boolean(state || q);

  return (
    <OwnerPage testId="juristic-resolutions">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canManage ? (
            <NewResolutionButton buildings={buildings} defaultOpen={param(searchParams.new) === "1"} />
          ) : undefined
        }
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("show")}
            current={state ?? "all"}
            tabs={[
              { key: "all", href: withQuery(base, { q }), label: t("all"), testId: "resolutions-all" },
              ...STATES.map((value) => ({
                key: value,
                href: withQuery(base, { q, state: value }),
                label: t(`stateTab.${value}`),
                count: value === "draft" ? (drafts.data ?? undefined) : undefined,
                testId: `resolutions-${value}`,
              })),
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : (
        <RowList
          label={t("title")}
          testId="resolution-rows"
          empty={
            <EmptyState
              variant="card"
              icon={IconRules}
              title={filtered ? t("empty.filteredTitle") : t("empty.title")}
              description={filtered ? t("empty.filtered") : t("empty.body")}
              action={
                <Button asChild variant="secondary">
                  <a href={filtered ? base : withQuery(base, { new: canManage ? "1" : undefined })}>
                    {filtered ? t("empty.clear") : canManage ? t("new") : t("empty.budgets")}
                  </a>
                </Button>
              }
            />
          }
          items={rows.map((row) => ({
            key: row.id,
            href: ownerPath(locale, `/juristic/resolutions/${row.id}`),
            lead: <span className="font-mono">{row.number}</span>,
            title: row.title,
            meta: t("rowMeta", {
              kind: t(`meetingKindName.${row.meetingKind}`),
              date: formatDate(row.meetingDate, locale),
              building: buildingName(row.buildingId),
            }),
            status: <StatusBadgeOf map={RESOLUTION_STATUS} value={row.state} size="sm" />,
            testId: "resolution-row",
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/**
 * One resolution as a paper document (J-DESIGN §4 "paper"): the meeting, the number, the text as the minutes word it,
 * the votes, the attachments; adopt / void / attach in the panel by the API's `nextActions` and the member's rights.
 */
export async function ResolutionView({ context, resolutionId }: { context: OwnerContext; resolutionId: string }) {
  const t = await getTranslations("owner.juristic.resolution");
  const { api, locale, me } = context;
  let resolution: Schemas["ResolutionDto"];
  try {
    resolution = await unwrap(
      api.GET("/v1/owner/juristic/resolutions/{resolutionId}", { params: { path: { resolutionId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const writable = !readOnly(me);
  const canManage = writable && ownerCan(me, "juristic.resolution.manage");
  const canAdopt = writable && ownerCan(me, "juristic.resolution.adopt");
  const next = new Set(resolution.nextActions);
  const building = context.buildings.find((candidate) => candidate.id === resolution.buildingId);
  const draft = resolution.state === "draft";

  return (
    <OwnerPage testId="juristic-resolution">
      <PageHeader
        title={t("recordTitle", { number: resolution.number })}
        status={<StatusBadgeOf map={RESOLUTION_STATUS} value={resolution.state} />}
        description={resolution.title}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/resolutions") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            status={<StatusBadgeOf map={RESOLUTION_STATUS} value={resolution.state} size="sm" />}
            description={draft ? t("panelDraft") : resolution.state === "adopted" ? t("panelAdopted") : t("panelVoid")}
            facts={[
              { key: "meeting", label: t("meetingDate"), value: formatDate(resolution.meetingDate, locale) },
              ...(resolution.adoptedAt
                ? [{ key: "adopted", label: t("adoptedAt"), value: formatDateTime(resolution.adoptedAt, locale) }]
                : []),
              ...(resolution.voidedAt
                ? [{ key: "voided", label: t("voidedAt"), value: formatDateTime(resolution.voidedAt, locale) }]
                : []),
            ]}
            primary={canAdopt && next.has("adopt") ? <AdoptResolutionButton resolution={resolution} /> : undefined}
            secondary={
              <>
                {canManage && draft && next.has("update") ? <EditResolutionButton resolution={resolution} /> : null}
                {canManage && next.has("add_document") ? <AttachDocumentButton resolution={resolution} /> : null}
                {resolution.state === "adopted" && ownerCan(me, "juristic.budget.read") ? (
                  <Button asChild variant="secondary" block>
                    <a href={withQuery(ownerPath(locale, "/juristic/budgets"), { building: resolution.buildingId })}>
                      {t("openBudgets")}
                    </a>
                  </Button>
                ) : null}
              </>
            }
            destructive={canAdopt && next.has("void") ? <VoidResolutionButton resolution={resolution} /> : undefined}
          />
        }
      >
        <Paper label={t("recordTitle", { number: resolution.number })} testId="resolution-paper">
          <PaperHead
            kind={t("paperKind")}
            number={resolution.number}
            facts={[
              { key: "kind", label: t("meetingKind"), value: t(`meetingKindName.${resolution.meetingKind}`) },
              {
                key: "date",
                label: t("meetingDate"),
                value: formatDate(resolution.meetingDate, locale, { style: "long" }),
              },
              { key: "building", label: t("building"), value: building?.name ?? "—" },
            ]}
          />
          <PaperSection title={resolution.title}>
            <p className="m-0 leading-relaxed whitespace-pre-line" data-testid="resolution-body">
              {resolution.text}
            </p>
          </PaperSection>
          {resolution.votesSummary ? (
            <PaperSection title={t("votes")}>
              <p className="m-0">{resolution.votesSummary}</p>
            </PaperSection>
          ) : null}
          {resolution.state === "void" && resolution.voidReason ? (
            <PaperSection title={t("voidedBecause")}>
              <p className="m-0">{resolution.voidReason}</p>
            </PaperSection>
          ) : null}
        </Paper>

        <Card
          as="section"
          aria-labelledby="documents-title"
          className="flex flex-col gap-3"
          data-testid="resolution-documents"
        >
          <CardHeader title={<span id="documents-title">{t("documents")}</span>} description={t("documentsHint")} />
          {resolution.documents.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("noDocuments")}</p>
          ) : (
            <ul className="divide-border m-0 list-none divide-y p-0">
              {resolution.documents.map((document) => (
                <li
                  key={document.documentId}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  data-testid="resolution-document"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium break-words">
                      {document.title ?? t(`documentKind.${document.kind}`)}
                    </span>
                    <span className="text-muted text-sm">
                      {[
                        document.title ? t(`documentKind.${document.kind}`) : null,
                        document.sizeBytes > 0 ? formatBytes(document.sizeBytes, locale) : null,
                        t("attachedOn", { date: formatDate(document.createdAt, locale) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <DocumentButton
                      document={{ kind: "file", id: document.documentId }}
                      label={t("openDocument")}
                      title={
                        document.title ??
                        t("documentTitle", {
                          kind: t(`documentKind.${document.kind}`),
                          number: resolution.number,
                        })
                      }
                      variant="ghost"
                    />
                    {canManage && draft ? (
                      <RemoveDocumentButton resolution={resolution} documentId={document.documentId} />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}
