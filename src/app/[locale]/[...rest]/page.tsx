import { notFound } from "next/navigation";

/**
 * Any path this zone has no page for — including the ones the proxy refuses (another zone's segment,
 * the retired resident segments) — renders the zone's own not-found page with a 404 status, inside
 * the zone's root layout.
 */
export default function UnknownPath() {
  notFound();
}
