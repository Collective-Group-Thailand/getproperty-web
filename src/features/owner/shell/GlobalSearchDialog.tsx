"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";

import { CSRF_HEADER } from "@/lib/api/headers";
import { parseSearchResults, type SearchResult } from "@/lib/api/search";
import { queryKeys } from "@/lib/api/query";
import { QueryProvider } from "@/features/shared/providers/QueryProvider";
import type { ShellNavItem } from "@/features/shared/shell/types";
import { Input } from "@/ui/components/Input";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconResident } from "@/ui/icons/glyphs/resident";
import { IconRoom } from "@/ui/icons/glyphs/room";
// eslint-disable-next-line no-restricted-imports -- this module is itself loaded on first open (GlobalSearch, D-179)
import { Dialog } from "@/ui/components/Dialog";

const RESULT_ICON: Record<SearchResult["type"], IconGlyph> = {
  building: IconBuilding,
  unit: IconRoom,
  party: IconResident,
  lease: IconLease,
  device: IconGateway,
  invoice: IconBill,
};

/** Where a search hit opens in the owner console (F2 routes). */
function resultHref(result: SearchResult, prefix: string): string {
  const paths: Record<SearchResult["type"], string> = {
    building: `/buildings/${result.id}`,
    unit: `/units/${result.id}`,
    party: `/parties/${result.id}`,
    lease: `/leases/${result.id}`,
    device: `/devices/${result.id}`,
    invoice: `/invoices/${result.id}`,
  };
  return `${prefix}${paths[result.type]}`;
}

export interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ShellNavItem[];
  tenantId: string;
  localePrefix: string;
}

/** The search dialog, loaded the first time search opens (D-179), with TanStack Query for the results. */
export function GlobalSearchDialog(props: GlobalSearchDialogProps) {
  return (
    <QueryProvider>
      <SearchDialog {...props} />
    </QueryProvider>
  );
}

function SearchDialog({ open, onOpenChange, items, tenantId, localePrefix }: GlobalSearchDialogProps) {
  const t = useTranslations("shell.search");
  const close = useTranslations("common");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());

  const results = useQuery({
    queryKey: queryKeys.search("owner", tenantId, deferred),
    enabled: open && deferred.length >= 2,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      // Pending endpoint: typed by the requested shape until the contract publishes it.
      const response = await fetch(`/bff/v1/owner/search?q=${encodeURIComponent(deferred)}`, {
        signal,
        headers: { accept: "application/json", [CSRF_HEADER]: "1" },
      });
      if (!response.ok) return [];
      return parseSearchResults(await response.json());
    },
  });

  const needle = deferred.toLowerCase();
  const pages = needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items.slice(0, 6);
  const hits = results.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("title")} closeLabel={close("close")}>
      <div className="flex flex-col gap-4">
        <Input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
        />
        {pages.length > 0 ? (
          <section aria-label={t("pages")}>
            <h3 className="text-muted mb-1 text-xs font-semibold uppercase">{t("pages")}</h3>
            <ul className="flex flex-col">
              {pages.map((item) => (
                <li key={item.key}>
                  <a href={item.href} className="rounded-control hover:bg-bg-subtle flex items-center gap-3 px-2 py-2">
                    <Icon icon={item.icon} className="text-muted" />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {hits.length > 0 ? (
          <section aria-label={t("results")}>
            <h3 className="text-muted mb-1 text-xs font-semibold uppercase">{t("results")}</h3>
            <ul className="flex flex-col" data-testid="search-results">
              {hits.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <a
                    href={resultHref(hit, localePrefix)}
                    className="rounded-control hover:bg-bg-subtle flex items-center gap-3 px-2 py-2"
                  >
                    <Icon icon={RESULT_ICON[hit.type]} className="text-muted" />
                    <span className="flex flex-col">
                      <span>{hit.label}</span>
                      {hit.sublabel ? <span className="text-muted text-xs">{hit.sublabel}</span> : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {deferred.length >= 2 && pages.length === 0 && hits.length === 0 && !results.isFetching ? (
          <p className="text-muted text-sm">{t("empty", { query: deferred })}</p>
        ) : null}
      </div>
    </Dialog>
  );
}
