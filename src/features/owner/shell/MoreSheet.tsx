"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import { currentHref } from "@/features/shared/shell/menu";
import type { ShellNavGroup } from "@/features/shared/shell/types";
import { signOut } from "@/lib/auth/actions";
import { Icon } from "@/ui/icons";
import { MenuRow } from "@/ui/components/MenuRow";
import { IconLogOut } from "@/ui/icons/glyphs/log-out";
import { cn } from "@/ui/lib/cn";

/**
 * The phone's "More" sheet (redesign G0, Stitch revision): who is signed in and where (with the way to switch
 * organisation), a field-like search, the whole menu as a three-column grid of icon tiles per group — sixteen
 * destinations in one screen instead of a long list — then the plain settings rows, and sign-out last in red. No
 * filled button anywhere: the sheet is a menu, not a task.
 */
export function MoreSheetBody({
  groups,
  userName,
  roleLabel,
  tenantName,
  switchTenantHref,
  loginHref,
  search,
}: {
  groups: ShellNavGroup[];
  userName: string;
  roleLabel: string;
  tenantName: string;
  /** Operators of several organisations: the tenant picker. */
  switchTenantHref?: string;
  loginHref: string;
  search: React.ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const current = currentHref(
    groups.flatMap((group) => group.items).flatMap((item) => [item.href, ...(item.children ?? []).map((c) => c.href)]),
    pathname,
  );
  return (
    <div className="flex flex-col gap-6 pb-2">
      <div className="border-border flex items-center gap-3 border-b pb-4">
        <span
          aria-hidden="true"
          className="bg-primary-subtle text-primary-subtle-fg grid size-11 shrink-0 place-items-center rounded-full text-base font-semibold"
        >
          {Array.from(userName.trim())[0] ?? "?"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{userName}</span>
          <span className="text-muted truncate text-sm">
            {roleLabel} · {tenantName}
          </span>
        </div>
        {switchTenantHref ? (
          <a
            href={switchTenantHref}
            className="text-primary inline-flex min-h-11 shrink-0 items-center text-sm font-semibold"
          >
            {t("shell.tenantSwitcher.label")}
          </a>
        ) : null}
      </div>

      {search}

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`more-group-${group.key}`}>
          <h2 id={`more-group-${group.key}`} className="text-muted m-0 mb-2 text-sm font-medium">
            {group.label}
          </h2>
          <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
            {group.items.map((item) => {
              const active = item.href === current || Boolean(item.children?.some((child) => child.href === current));
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-card focus-visible:ring-focus-ring flex h-20 flex-col items-center justify-center gap-1.5 border px-1.5 text-center focus-visible:ring-2 focus-visible:outline-none",
                      active
                        ? "bg-primary-subtle text-primary-subtle-fg border-transparent font-semibold"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <Icon icon={item.icon} className="text-primary text-xl" />
                    <span className="line-clamp-2 text-xs leading-snug">{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="border-border flex flex-col border-t pt-2">
        <LanguageSwitch zone="owner" variant="row" />
        <MenuRow
          icon={IconLogOut}
          tone="danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await signOut();
              window.location.assign(loginHref);
            })
          }
        >
          {t("auth.signOut")}
        </MenuRow>
      </div>
    </div>
  );
}
