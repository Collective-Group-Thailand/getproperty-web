import type { AnchorHTMLAttributes } from "react";

/** `next/link` for Storybook: a plain anchor. */
export default function Link({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string | { pathname?: string } }) {
  return <a href={typeof href === "string" ? href : (href.pathname ?? "#")} {...props} />;
}
