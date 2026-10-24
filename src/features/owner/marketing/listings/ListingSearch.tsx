import { getTranslations } from "next-intl/server";

import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconSearch } from "@/ui/icons/glyphs/search";

import type { ListingQuery } from "./contract";

/**
 * The `/rent` search: a plain GET form (every filter is a URL parameter — shareable, indexable, works without JS).
 * One panel: the question people come with (where, what kind) on top, the finer filters on a quieter row under it.
 */
export async function ListingSearch({ query, action }: { query: ListingQuery; action: string }) {
  const t = await getTranslations("owner.marketing.listings.search");
  const kinds = ["condo_unit", "house", "townhouse", "room"] as const;
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="bg-surface border-border rounded-photo shadow-raised flex flex-col border"
    >
      <div className="grid gap-3 p-4 md:grid-cols-[1.6fr_1fr_auto] md:items-end">
        <Field label={t("q")}>
          <Input name="q" type="search" defaultValue={query.q ?? ""} placeholder={t("qPlaceholder")} inputSize="lg" />
        </Field>
        <Field label={t("kind")}>
          <NativeSelect
            name="kind"
            defaultValue={query.kind ?? ""}
            inputSize="lg"
            options={[
              { value: "", label: t("kinds.any") },
              ...kinds.map((k) => ({ value: k, label: t(`kinds.${k}`) })),
            ]}
          />
        </Field>
        <Button type="submit" size="lg" iconStart={IconSearch}>
          {t("submit")}
        </Button>
      </div>
      <fieldset className="border-border m-0 grid grid-cols-2 items-end gap-x-3 gap-y-3 border-0 border-t px-4 pt-3 pb-4 md:flex md:flex-wrap md:gap-x-4">
        <legend className="sr-only">{t("filters")}</legend>
        <Field label={t("minRent")} className="md:w-32">
          <Input name="minRent" inputMode="numeric" pattern="[0-9]*" defaultValue={query.minRent ?? ""} />
        </Field>
        <Field label={t("maxRent")} className="md:w-32">
          <Input name="maxRent" inputMode="numeric" pattern="[0-9]*" defaultValue={query.maxRent ?? ""} />
        </Field>
        <Field label={t("bedrooms")} className="md:w-36">
          <NativeSelect
            name="bedrooms"
            defaultValue={query.bedrooms ?? ""}
            options={(["any", "0", "1", "2", "3"] as const).map((k) => ({
              value: k === "any" ? "" : k,
              label: t(`bedroomOptions.${k}`),
            }))}
          />
        </Field>
        <Field label={t("sort")} className="md:w-44">
          <NativeSelect
            name="sort"
            defaultValue={query.sort ?? "newest"}
            options={(["newest", "rent_asc", "rent_desc"] as const).map((k) => ({ value: k, label: t(`sorts.${k}`) }))}
          />
        </Field>
        <div className="flex min-h-10 items-center">
          <Checkbox name="pets" value="1" defaultChecked={query.pets === "1"} label={t("pets")} />
        </div>
        <a
          href={action}
          className="text-muted hover:text-fg flex min-h-10 items-center text-sm underline underline-offset-4 md:ms-auto"
        >
          {t("reset")}
        </a>
      </fieldset>
    </form>
  );
}
