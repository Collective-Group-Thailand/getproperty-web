import { getTranslations } from "next-intl/server";

import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Pagination } from "@/ui/components/Pagination";

/**
 * Server pagination of an owner list (contract §3 `meta`): links that keep every other search
 * parameter of the page, so filters and sort survive a page change and the URL can be shared.
 */
export async function ListPagination({
  meta,
  path,
  searchParams,
  locale,
}: {
  meta: { page: number; perPage: number; total: number };
  path: string;
  searchParams: Record<string, string | string[] | undefined>;
  locale: Locale;
}) {
  const t = await getTranslations("owner.common.pagination");
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.perPage + 1;
  const to = Math.min(meta.total, meta.page * meta.perPage);
  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    }
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };
  return (
    <Pagination
      page={meta.page}
      perPage={meta.perPage}
      total={meta.total}
      href={href}
      labels={{
        nav: t("nav"),
        previous: t("previous"),
        next: t("next"),
        range: t("range", {
          from: formatNumber(from, locale),
          to: formatNumber(to, locale),
          total: formatNumber(meta.total, locale),
        }),
        page: (page) => t("page", { page }),
      }}
    />
  );
}
