import { getTranslations } from "next-intl/server";

import { vocabularyKeys } from "@/domain/juristic/vocabulary";
import { REGISTER_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDecimal, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBook } from "@/ui/icons/glyphs/book";
import { IconQr } from "@/ui/icons/glyphs/qr";

import { ownerPath, withQuery } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import { Channels, OwnerNames } from "./RegisterParts";
import { NewPlotButton } from "./RegisterActions";
import { juristicScope } from "./scope";

type SearchParams = Record<string, string | string[] | undefined>;
type Row = Schemas["RegisterUnitDto"];

/**
 * The co-owner register (JW1a, D-307, D-323): every unit of a building with its current owners and their shares, the
 * bill-to party, and how the owners can be reached. The property's kind decides the layout and the words (J-DESIGN
 * §1.3): a housing estate lists plots by soi with their land in ตร.วา; a condominium shows floor cards with the
 * ownership ratio. "Incomplete" is the API's own flag (Σ shares < 100 %).
 */
export async function RegisterView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.juristic");
  const { api, locale, me } = context;
  const scope = juristicScope(context, searchParams);
  const words = vocabularyKeys(scope.kind);
  const view = param(searchParams.view) === "incomplete" ? "incomplete" : "all";
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const base = ownerPath(locale, "/juristic/register");
  const keep = { property: scope.property?.id, building: scope.building?.id };
  const path = (extra: Record<string, string | undefined>) => withQuery(base, { ...keep, ...extra });

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      title={t("register.title")}
      description={
        scope.property
          ? t("register.lede", {
              property: scope.property.name,
              count: scope.buildings.reduce((sum, building) => sum + building.unitCount, 0),
              units: t(words.units),
            })
          : t("register.ledeEmpty")
      }
      actions={actions}
    />
  );

  if (!scope.building) {
    return (
      <OwnerPage testId="juristic-register">
        {header()}
        <EmptyState
          variant="card"
          icon={IconBook}
          title={t("register.noBuildingTitle")}
          description={t("register.noBuilding")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/buildings")}>{t("register.noBuildingAction")}</a>
            </Button>
          }
        />
      </OwnerPage>
    );
  }

  const building = scope.building;
  const plots = scope.traits.layout === "plots";
  const perPage = plots ? 50 : 100;
  const [list, incompleteCount] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/register", {
          params: {
            query: {
              buildingId: building.id,
              perPage,
              page,
              ...(q ? { q } : {}),
              ...(view === "incomplete" ? { incomplete: true } : {}),
            },
          },
        }),
      ),
    ),
    section(
      unwrap(
        api.GET("/v1/owner/juristic/register", {
          params: { query: { buildingId: building.id, incomplete: true, perPage: 1 } },
        }),
      ).then((result) => result.meta.total),
    ),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.register.manage");
  const canInvite = !readOnly(me) && ownerCan(me, "juristic.register.manage");

  const actions = (
    <>
      {canInvite ? (
        <Button asChild variant="secondary" iconStart={IconQr}>
          <a
            href={withQuery(ownerPath(locale, "/juristic/register/invites"), { building: building.id })}
            data-testid="register-invites"
          >
            {t("register.printInvites")}
          </a>
        </Button>
      ) : null}
      {plots && canManage && ownerCan(me, "unit.manage") ? (
        <NewPlotButton buildingId={building.id} groupName={building.name} kind={scope.kind} />
      ) : null}
    </>
  );

  const rows = list.data?.data ?? [];
  const juristicProperties = scope.properties.filter((property) => property.kind);
  const filtered = Boolean(q) || view === "incomplete";

  return (
    <OwnerPage testId="juristic-register">
      {header(actions)}

      {juristicProperties.length > 1 ? (
        <LinkTabs
          label={t("register.properties")}
          current={withQuery(base, { property: scope.property?.id })}
          tabs={juristicProperties.map((property) => ({
            href: withQuery(base, { property: property.id }),
            label: property.name,
            testId: `register-property-${property.code}`,
          }))}
        />
      ) : null}

      <ListToolbar
        tabs={
          <ViewTabs
            label={t("register.show")}
            current={view}
            tabs={[
              { key: "all", href: path({ q }), label: t("register.all"), testId: "register-view-all" },
              {
                key: "incomplete",
                href: path({ q, view: "incomplete" }),
                label: t("register.incomplete"),
                count: incompleteCount.data ?? undefined,
                testId: "register-view-incomplete",
              },
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              ...(scope.buildings.length > 1
                ? [
                    {
                      name: "building",
                      label: t(words.group),
                      type: "select" as const,
                      fallback: building.id,
                      options: scope.buildings.map((candidate) => ({ value: candidate.id, label: candidate.name })),
                    },
                  ]
                : []),
              {
                name: "q",
                label: t("register.search"),
                type: "search" as const,
                placeholder: t("register.searchPlaceholder", { unit: t(words.unit) }),
              },
            ]}
          />
        }
      />

      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBook}
          title={filtered ? t("register.empty.filteredTitle") : t("register.empty.title", { units: t(words.units) })}
          description={filtered ? t("register.empty.filtered") : t("register.empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? path({}) : ownerPath(locale, `/buildings/${building.id}`)}>
                {filtered ? t("register.empty.clear") : t("register.empty.openBuilding")}
              </a>
            </Button>
          }
        />
      ) : plots ? (
        <PlotTable rows={rows} locale={locale} kind={scope.kind} groupName={building.name} />
      ) : (
        <FloorCards rows={rows} locale={locale} kind={scope.kind} ratio={scope.traits.ratio} />
      )}

      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={{ ...searchParams, ...keep }} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/** A housing estate: one row per plot of the soi — plot, house number, land, owners, completeness, channels. */
async function PlotTable({
  rows,
  locale,
  kind,
  groupName,
}: {
  rows: Row[];
  locale: Locale;
  kind: Schemas["PropertyKind"];
  groupName: string;
}) {
  const t = await getTranslations("owner.juristic");
  const words = vocabularyKeys(kind);
  return (
    <SimpleTable
      caption={t("register.plotCaption", { group: groupName })}
      testId="register-plots"
      pinFirstColumn
      stackOnPhones
      minWidth="52rem"
      columns={[
        { key: "plot", header: t("register.col.plot"), phone: "title" },
        { key: "unit", header: t(words.unit), phone: "meta" },
        { key: "size", header: t(words.size), align: "end", phone: "figure" },
        { key: "owners", header: t("register.col.owners"), phone: "meta" },
        { key: "channels", header: t("register.col.channels"), phone: "meta" },
      ]}
      rows={rows.map((row) => ({
        key: row.unitId,
        testId: "register-row",
        data: { unit: row.unitNo, incomplete: row.incomplete },
        href: ownerPath(locale, `/juristic/register/${row.unitId}`),
        cells: {
          plot: <span className="font-mono">{row.plotNo ?? row.unitNo}</span>,
          unit: <span className="font-mono">{row.unitNo}</span>,
          size: row.landAreaSqwa ? (
            <span className="tabular-nums">
              {t("unitOf.sqwa", { value: formatDecimal(row.landAreaSqwa, locale, 2) })}
            </span>
          ) : (
            <span className="text-muted">{t("register.noSize")}</span>
          ),
          owners: (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <OwnerNames row={row} />
              {row.incomplete ? <StatusBadgeOf map={REGISTER_STATUS} value="incomplete" size="sm" /> : null}
            </span>
          ),
          channels: <Channels row={row} />,
        },
      }))}
    />
  );
}

/**
 * A condominium: one section per floor (the row's `floorLevel` / `floorName`, J-CR), a card per unit — the unit number, its owners (the second line: bill-to or
 * "+1"), the ownership ratio and area, and the word "ยังไม่ครบ" when the shares do not reach 100 %.
 */
async function FloorCards({
  rows,
  locale,
  kind,
  ratio,
}: {
  rows: Row[];
  locale: Locale;
  kind: Schemas["PropertyKind"];
  ratio: boolean;
}) {
  const t = await getTranslations("owner.juristic");
  const words = vocabularyKeys(kind);
  const groups = new Map<number | null, Row[]>();
  for (const row of rows) {
    const level = row.floorLevel;
    groups.set(level, [...(groups.get(level) ?? []), row]);
  }
  const levels = [...groups.keys()].sort((a, b) => (a ?? 9999) - (b ?? 9999));
  return (
    <div className="flex flex-col gap-8" data-testid="register-floors">
      {levels.map((level) => {
        const units = groups.get(level)!;
        const id = `floor-${level ?? "none"}`;
        const name = units.find((unit) => unit.floorName)?.floorName;
        return (
          <section key={id} aria-labelledby={id} className="flex flex-col gap-3" data-testid="register-floor">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={id} className="text-base font-semibold">
                {level !== null
                  ? t("register.floor", { level: formatNumber(level, locale) })
                  : (name ?? t("register.noFloor"))}
              </h2>
              <span className="text-muted text-sm tabular-nums">
                {t("register.unitsOnFloor", { count: units.length, units: t(words.units) })}
              </span>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
              {units.map((row) => (
                <Card
                  key={row.unitId}
                  as="li"
                  interactive
                  className="relative flex flex-col gap-2 p-4"
                  data-testid="register-row"
                  data-unit={row.unitNo}
                  data-incomplete={row.incomplete}
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={ownerPath(locale, `/juristic/register/${row.unitId}`)}
                      className="text-primary font-mono text-base font-semibold after:absolute after:inset-0"
                    >
                      {row.unitNo}
                    </a>
                    {row.incomplete ? <StatusBadgeOf map={REGISTER_STATUS} value="incomplete" size="sm" /> : null}
                  </div>
                  <OwnerNames row={row} />
                  <dl className="border-border m-0 mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-sm">
                    {ratio ? (
                      <div className="flex gap-1.5">
                        <dt className="text-muted">{t(words.share)}</dt>
                        <dd className="m-0 font-mono tabular-nums">{row.ownershipRatio ?? "—"}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-1.5">
                      <dt className="text-muted">{t(words.size)}</dt>
                      <dd className="m-0 tabular-nums">{row.areaSqm ? formatDecimal(row.areaSqm, locale, 2) : "—"}</dd>
                    </div>
                  </dl>
                  <Channels row={row} />
                </Card>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
