"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useState } from "react";

import { CSRF_HEADER } from "@/lib/api/headers";
import type { SearchResult } from "@/lib/api/pending";
import { parseSearchResults } from "@/lib/api/search";
import { queryKeys } from "@/lib/api/query";
import type { ShellNavItem } from "@/features/shared/shell/types";
import { Dialog } from "@/ui/components/Dialog";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { Icon, type IconName } from "@/ui/icons";

const RESULT_ICON: Record<SearchResult["type"], IconName> = {
  building: "building",
  unit: "room",
  party: "resident",
  lease: "lease",
  invoice: "bill",
};

/** Where a search hit opens in the owner console (F2 routes). */
function resultHref(result: SearchResult, prefix: string): string {
  const paths: Record<SearchResult["type"], string> = {
    building: `/buildings/${result.id}`,
    unit: `/units/${result.id}`,
    party: `/parties/${result.id}`,
    lease: `/leases/${result.id}`,
    invoice: `/invoices/${result.id}`,
  };
  return `${prefix}${paths[result.type]}`;
}

/**
 * Global search (`/` opens it): menu entries match locally at once; entities come from
 * `GET /v1/owner/search` — a contract request (docs/contract-requests.md), so against an API without
 * it only the menu part answers.
 */
export function GlobalSearch({
  items,
  tenantId,
  localePrefix,
}: {
  items: ShellNavItem[];
  tenantId: string;
  localePrefix: string;
}) {
  const t = useTranslations("shell.search");
  const close = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <>
      <IconButton
        name="search"
        label={`${t("open")} (${t("hint")})`}
        onClick={() => setOpen(true)}
        data-testid="global-search"
      />
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} closeLabel={close("close")}>
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
                    <a
                      href={item.href}
                      className="rounded-control hover:bg-bg-subtle flex items-center gap-3 px-2 py-2"
                    >
                      <Icon name={item.icon} className="text-muted" />
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
                      <Icon name={RESULT_ICON[hit.type]} className="text-muted" />
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
    </>
  );
}
