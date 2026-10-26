"use client";

const CHANNELS = new Set(["line", "facebook_group", "facebook_marketplace", "qr", "link"]);

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
