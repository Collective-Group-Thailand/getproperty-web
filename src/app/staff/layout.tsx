import { ZoneDocument, zoneMetadata } from "@/features/shared/shell/ZoneDocument";

/** Staff zone root layout — `staff.localhost:3000`, rewritten onto `/staff` by src/proxy.ts (00-master-plan.md §2). */
export async function generateMetadata() {
  return zoneMetadata("staff");
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <ZoneDocument zone="staff">{children}</ZoneDocument>;
}
