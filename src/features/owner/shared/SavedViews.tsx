"use client";

import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { IconButton } from "@/ui/components/IconButton";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconFlag } from "@/ui/icons/glyphs/flag";

interface SavedView {
  name: string;
  query: string;
}

const CHANGE = "gp:saved-views";

function raw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE, callback);
  };
}

function parse(text: string): SavedView[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedView[]).filter((view) => typeof view?.name === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, views: SavedView[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
  } catch {
    // Storage blocked (private mode): the views just do not persist.
  }
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Saved views of a list (design-system.md §3 DataTable "saved views"): the filters and sort of the
 * current URL under a name, kept in this browser only (a per-viewer convenience — nothing shared, no
 * personal data, the URL holds only filter values).
 */
export function SavedViews({ storageKey }: { storageKey: string }) {
  const t = useTranslations("owner.common.views");
  const pathname = usePathname();
  const params = useSearchParams();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const key = `gp:views:${storageKey}`;
  const stored = useSyncExternalStore(
    subscribe,
    () => raw(key),
    () => "[]",
  );
  const views = useMemo(() => parse(stored), [stored]);

  const current = (() => {
    const copy = new URLSearchParams(params.toString());
    copy.delete("page");
    return copy.toString();
  })();

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    write(key, [...views.filter((view) => view.name !== trimmed), { name: trimmed, query: current }]);
    setNaming(false);
    setName("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="saved-views">
      <span className="text-muted text-sm">{t("label")}</span>
      {views.length === 0 ? <span className="text-subtle text-sm">{t("none")}</span> : null}
      {views.map((view) => (
        <span key={view.name} className="bg-bg-subtle inline-flex items-center rounded-full ps-3">
          <a
            href={view.query ? `${pathname}?${view.query}` : pathname}
            aria-current={view.query === current ? "true" : undefined}
            className="aria-[current=true]:text-primary text-sm font-medium underline-offset-4 hover:underline"
            data-testid="saved-view"
          >
            {view.name}
          </a>
          <IconButton
            icon={IconClose}
            size="sm"
            label={t("remove", { name: view.name })}
            onClick={() => {
              write(
                key,
                views.filter((candidate) => candidate.name !== view.name),
              );
            }}
          />
        </span>
      ))}
      {naming ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            inputSize="sm"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={t("name")}
            placeholder={t("namePlaceholder")}
            className="w-44"
            data-testid="saved-view-name"
          />
          <Button size="sm" type="submit" data-testid="saved-view-save">
            {t("save")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNaming(false)}>
            {t("cancel")}
          </Button>
        </form>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          iconStart={IconFlag}
          onClick={() => setNaming(true)}
          data-testid="saved-view-new"
        >
          {t("new")}
        </Button>
      )}
    </div>
  );
}
