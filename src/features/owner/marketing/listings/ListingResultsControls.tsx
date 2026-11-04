"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Checkbox } from "@/ui/components/Checkbox";
import { NativeSelect } from "@/ui/components/NativeSelect";

/**
 * The results header's controls on `/rent` (Stitch revision): "pets allowed" (from `md`; on phones it sits in the
 * filter sheet) and the sort — each change replaces the URL, so the server renders the new list.
 */
export function ListingResultsControls({ sort, pets }: { sort?: string; pets?: string }) {
  const t = useTranslations("owner.marketing.listings.search");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const apply = (name: string, value: string | undefined) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("cursor");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return (
    <div className="flex items-center gap-4" aria-busy={pending}>
      <div className="hidden md:flex">
        <Checkbox
          label={t("pets")}
          checked={pets === "1"}
          onCheckedChange={(checked) => apply("pets", checked === true ? "1" : undefined)}
        />
      </div>
      <div className="w-44">
        <NativeSelect
          aria-label={t("sort")}
          inputSize="sm"
          value={sort ?? "newest"}
          onChange={(event) => apply("sort", event.target.value === "newest" ? undefined : event.target.value)}
          options={(["newest", "rent_asc", "rent_desc"] as const).map((k) => ({ value: k, label: t(`sorts.${k}`) }))}
        />
      </div>
    </div>
  );
}
