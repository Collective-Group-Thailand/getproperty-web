"use client";

import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** A count — open bills, unread tickets. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name for the tab list, from `src/i18n`. */
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel = TabsPrimitive.Content;

/** Sections of one entity (a lease: details, bills, documents). Underline style; arrow keys move. */
export function Tabs({ tabs, label, children, className, ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root className={className} {...props}>
      <TabsPrimitive.List aria-label={label} className="border-border flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className={cn(
              "text-muted -mb-px flex h-11 items-center gap-2 border-b-2 border-transparent px-3 font-medium whitespace-nowrap",
              "hover:text-fg data-[state=active]:border-primary data-[state=active]:text-fg disabled:opacity-50",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="bg-neutral-subtle text-neutral-subtle-fg rounded-full px-1.5 text-xs tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}
