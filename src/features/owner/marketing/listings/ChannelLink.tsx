"use client";

import type { Schemas } from "@/lib/api/types";

/** Every channel the API counts an enquiry for (D-268; G4 `facebook_page`, G6 `line_sponsored` — D-300). */
const CHANNEL_LIST: Record<Schemas["ListingChannel"], true> = {
  line: true,
  facebook_group: true,
  facebook_marketplace: true,
  qr: true,
  link: true,
  facebook_page: true,
  line_sponsored: true,
};
const CHANNELS = new Set<string>(Object.keys(CHANNEL_LIST));

/** The LIFF link with the `ch` of this page's URL added, when there is a valid one. */
export function withChannel(href: string, search: string): string {
  const ch = new URLSearchParams(search).get("ch");
  if (!ch || !CHANNELS.has(ch) || !href.startsWith("https://liff.line.me/")) return href;
  const url = new URL(href);
  url.searchParams.set("ch", ch);
  return url.toString();
}

/**
 * A link to the LINE Mini App's page of a listing that carries the share-kit channel the visitor came from (`?ch=` of
 * the short link, D-268), so the enquiry is counted for that channel. Added in the browser as the link is followed:
 * the listing page itself stays cached for everyone.
 */
export function ChannelLink({
  href,
  onClick,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.currentTarget.href = withChannel(href, window.location.search);
        onClick?.(event);
      }}
      {...props}
    />
  );
}
