import { getTranslations } from "next-intl/server";

import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FilterSheet } from "@/ui/components/FilterSheet";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Icon } from "@/ui/icons";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { cn } from "@/ui/lib/cn";

import { listingQueryString, type ListingQuery } from "./contract";

const KINDS = ["condo_unit", "house", "townhouse", "room"] as const;

/** `href` of the search with one part of the query changed (the cursor always starts again). */
export function searchHref(action: string, query: ListingQuery, change: Partial<ListingQuery>): string {
  const text = listingQueryString({ ...query, ...change, cursor: undefined });
  return text ? `${action}?${text}` : action;
}

/**
 * The `/rent` search (Stitch revision): plain GET forms — every filter is a URL parameter, shareable and indexable,
 * working without JavaScript.
 * - From `md`: ONE horizontal bar — where · type · rent from–to · bedrooms · search. Sort and "pets allowed" live in
 *   the results header (`ListingResultsControls`) and ride along here as hidden values.
 * - Phones: one search field and a filter button with the number of filters in use; the type is a row of chips
 *   (`ListingKindChips`) and the rest waits in a bottom sheet — the first listing shows in the first screen.
 */
export async function ListingSearch({ query, action }: { query: ListingQuery; action: string }) {
  const t = await getTranslations("owner.marketing.listings.search");
  const common = await getTranslations("common");
  const secondary = [query.minRent, query.maxRent, query.bedrooms, query.pets].filter(Boolean).length;
  const bedroomOptions = (["any", "0", "1", "2", "3"] as const).map((k) => ({
    value: k === "any" ? "" : k,
    label: t(`bedroomOptions.${k}`),
  }));
  return (
    <>
      <form
        action={action}
        method="get"
        role="search"
        aria-label={t("label")}
        className="bg-surface border-border rounded-panel shadow-card hidden border p-2 md:block"
      >
        {query.area ? <input type="hidden" name="area" value={query.area} /> : null}
        {query.sort ? <input type="hidden" name="sort" value={query.sort} /> : null}
        {query.pets ? <input type="hidden" name="pets" value={query.pets} /> : null}
        <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-end">
          <BarSegment label={t("q")} htmlFor="rent-q">
            <div className="relative">
              <Icon
                icon={IconSearch}
                className="text-muted pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-lg"
              />
              <Input
                id="rent-q"
                name="q"
                type="search"
                defaultValue={query.q ?? ""}
                placeholder={t("qPlaceholder")}
                inputSize="lg"
                className="ps-10"
              />
            </div>
          </BarSegment>
          <BarSegment label={t("kind")} htmlFor="rent-kind" divider>
            <NativeSelect
              id="rent-kind"
              name="kind"
              defaultValue={query.kind ?? ""}
              inputSize="lg"
              options={[
                { value: "", label: t("kinds.any") },
                ...KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) })),
              ]}
            />
          </BarSegment>
          <fieldset className="border-border m-0 min-w-0 border-0 border-s px-2 py-0">
            <legend className="text-muted float-left mb-1 w-full px-1 text-xs font-medium">{t("rentRange")}</legend>
            <div className="clear-both flex items-center gap-1.5">
              <Input
                name="minRent"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={query.minRent ?? ""}
                placeholder={t("from")}
                aria-label={t("minRent")}
                inputSize="lg"
              />
              <span aria-hidden="true" className="text-muted">
                –
              </span>
              <Input
                name="maxRent"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={query.maxRent ?? ""}
                placeholder={t("to")}
                aria-label={t("maxRent")}
                inputSize="lg"
              />
            </div>
          </fieldset>
          <BarSegment label={t("bedrooms")} htmlFor="rent-bedrooms" divider>
            <NativeSelect
              id="rent-bedrooms"
              name="bedrooms"
              defaultValue={query.bedrooms ?? ""}
              inputSize="lg"
              options={bedroomOptions}
            />
          </BarSegment>
          <div className="ps-2">
            <Button type="submit" size="lg" iconStart={IconSearch}>
              {t("submit")}
            </Button>
          </div>
        </div>
      </form>

      <div className="flex items-center gap-2 md:hidden">
        <form action={action} method="get" role="search" aria-label={t("label")} className="relative min-w-0 flex-1">
          {(["area", "kind", "minRent", "maxRent", "bedrooms", "pets", "sort"] as const).map((key) =>
            query[key] ? <input key={key} type="hidden" name={key} value={query[key]} /> : null,
          )}
          <Icon
            icon={IconSearch}
            className="text-muted pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-lg"
          />
          <Input
            name="q"
            type="search"
            enterKeyHint="search"
            defaultValue={query.q ?? ""}
            placeholder={t("q")}
            aria-label={t("q")}
            className="ps-10"
          />
        </form>
        <FilterSheet
          label={t("filters")}
          count={secondary}
          closeLabel={common("close")}
          applyLabel={t("apply")}
          clear={{ href: action, label: t("reset") }}
          form={{ action, hidden: { area: query.area, q: query.q, kind: query.kind, sort: query.sort } }}
          testId="rent-filters"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("minRent")}>
              <Input name="minRent" inputMode="numeric" pattern="[0-9]*" defaultValue={query.minRent ?? ""} />
            </Field>
            <Field label={t("maxRent")}>
              <Input name="maxRent" inputMode="numeric" pattern="[0-9]*" defaultValue={query.maxRent ?? ""} />
            </Field>
          </div>
          <Field label={t("bedrooms")}>
            <NativeSelect name="bedrooms" defaultValue={query.bedrooms ?? ""} options={bedroomOptions} />
          </Field>
          <Checkbox name="pets" value="1" defaultChecked={query.pets === "1"} label={t("pets")} />
        </FilterSheet>
      </div>
    </>
  );
}

/** One segment of the bar: a small muted label over a borderless-looking control, a hairline before it. */
function BarSegment({
  label,
  htmlFor,
  divider,
  children,
}: {
  label: string;
  htmlFor: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", divider ? "border-border border-s px-2" : "pe-2")}>
      <label htmlFor={htmlFor} className="text-muted px-1 text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** The type as a row of chips that scrolls sideways (phones), each a link keeping the rest of the query. */
export async function ListingKindChips({ query, action }: { query: ListingQuery; action: string }) {
  const t = await getTranslations("owner.marketing.listings.search");
  const chips = [{ key: "", label: t("kinds.any") }, ...KINDS.map((k) => ({ key: k, label: t(`kinds.${k}`) }))];
  return (
    <nav aria-label={t("kind")} className="relative -mx-4 overflow-x-auto px-4 md:hidden">
      <ul className="m-0 flex w-max list-none gap-2 p-0">
        {chips.map((chip) => {
          const active = (query.kind ?? "") === chip.key;
          return (
            <li key={chip.key || "any"}>
              <a
                href={searchHref(action, query, { kind: (chip.key || undefined) as ListingQuery["kind"] })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-control inline-flex h-10 items-center border px-3.5 text-sm font-medium whitespace-nowrap",
                  active
                    ? "bg-primary-subtle text-primary-subtle-fg border-transparent"
                    : "border-border bg-surface text-fg hover:border-border-strong",
                )}
              >
                {chip.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
