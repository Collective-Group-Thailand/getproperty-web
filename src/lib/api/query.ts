import type { Zone } from "@/lib/zones";

/**
 * Query-key factory (TanStack Query). Keys start with the zone so one tab of one zone never reads
 * another's cache, and with the tenant where data is tenant-scoped so switching tenants cannot show
 * the previous tenant's rows. Realtime events invalidate by these prefixes (F1 1.3 §6).
 */
export const queryKeys = {
  all: (zone: Zone) => [zone] as const,
  me: (zone: Zone) => [zone, "me"] as const,
  tenant: (zone: Zone, tenantId: string | null) => [zone, "tenant", tenantId ?? "-"] as const,
  notifications: (zone: Zone) => [zone, "notifications"] as const,
  notificationsUnread: (zone: Zone) => [zone, "notifications", "unread"] as const,
  buildings: (zone: Zone, tenantId: string | null) => [zone, "tenant", tenantId ?? "-", "buildings"] as const,
  search: (zone: Zone, tenantId: string | null, q: string) => [zone, "tenant", tenantId ?? "-", "search", q] as const,
} as const;
