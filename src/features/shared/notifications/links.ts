import type { Zone } from "@/lib/zones";

/**
 * Where an in-app notification leads, by the domain event that caused it (`InboxItemDto.eventType`). The inbox
 * item carries no subject id, so each link opens the queue where the item waits — the owner decides there.
 * Paths are the zone's own (the owner zone adds its locale prefix: `/en/...` for English, none for Thai).
 */
const OWNER_LINKS: Record<string, string> = {
  // G7 (D-295): urgent self-viewing alerts open the viewing calendar (the attention list is at the top)
  "listing.self_viewing_entered": "/leads/viewings",
  "listing.self_viewing_incident": "/leads/viewings",
  "listing.self_viewing_overstayed": "/leads/viewings",
  // Release fixes (triage F7)
  "payment.held": "/payments/held", // D-220
  "party.link_requested": "/parties/link-requests", // D-226
  // B6.2 (D-215, D-216)
  "foreign_stay.due": "/tm30",
  "foreign_stay.file_generated": "/tm30",
  "etax.rejected": "/reports/etax?status=rejected",
  "etax.monthly_summary": "/reports/etax",
  // F2
  "slip.review_requested": "/payments/slips",
  "support_grant.requested": "/settings/support-access",
  "dsr.received": "/settings/privacy",
};

export function notificationHref(zone: Zone, eventType: string | null, locale: string): string | null {
  if (zone !== "owner" || !eventType) return null;
  const path = OWNER_LINKS[eventType];
  if (!path) return null;
  return locale === "th" ? path : `/${locale}${path}`;
}
