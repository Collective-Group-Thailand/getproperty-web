"use client";

import { useSyncExternalStore } from "react";

import { PhoneActionBar } from "../Layout";

const QUERY = "(max-width: 1023.98px)";
const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

/**
 * A tool's result kept at the bottom of a phone's screen (the form is long; the result sits under it). Rendered only
 * below `lg`, after hydration, so the figure is never in the page twice where the result panel is already in view.
 */
export function PhoneResultBar({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  const phone = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  if (!phone) return null;
  return <PhoneActionBar summary={summary}>{children}</PhoneActionBar>;
}
