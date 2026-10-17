import type { ShellNavGroup } from "@/features/shared/shell/types";
import type { Schemas } from "@/lib/api/types";

/** Shell story data in the contract's shapes (generated types), with the contract's example values. */
export const TENANTS: Schemas["OperatorTenantDto"][] = [
  {
    id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c11",
    displayName: "หอพักตัวอย่าง",
    type: "apartment",
    status: "active",
    role: "owner",
  },
  {
    id: "0d0c7a4e-5b0e-4c55-9d7c-3f2b8a1e6c22",
    displayName: "อาคารสาขาสอง",
    type: "pm_company",
    status: "active",
    role: "manager",
  },
];

export const CURRENT_TENANT: Schemas["CurrentTenantDto"] = { ...TENANTS[0]!, buildingIds: null };

export const BUILDINGS: Schemas["BuildingDto"][] = [
  {
    id: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c",
    code: "A",
    name: "อาคาร A",
    floorsCount: 5,
    operatorTenantId: CURRENT_TENANT.id,
    ownerTenantId: CURRENT_TENANT.id,
    propertyId: "7b9f1c2e-3d4a-4f5b-8c6d-9e0f1a2b3c4d",
    status: "active",
    access: "operator",
  } as Schemas["BuildingDto"],
  {
    id: "5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6d",
    code: "B",
    name: "อาคาร B",
    floorsCount: 4,
    operatorTenantId: CURRENT_TENANT.id,
    ownerTenantId: CURRENT_TENANT.id,
    propertyId: "7b9f1c2e-3d4a-4f5b-8c6d-9e0f1a2b3c4d",
    status: "active",
    access: "operator",
  } as Schemas["BuildingDto"],
];

export const OWNER_GROUPS: ShellNavGroup[] = [
  {
    key: "operations",
    label: "งานประจำวัน",
    items: [
      { key: "dashboard", href: "/dashboard", icon: "dashboard", label: "เช้านี้", group: "operations" },
      { key: "buildings", href: "/buildings", icon: "building", label: "อาคาร", group: "operations" },
      { key: "units", href: "/units", icon: "room", label: "ห้อง", group: "operations" },
      { key: "leases", href: "/leases", icon: "lease", label: "สัญญาเช่า", group: "operations" },
      { key: "readings", href: "/meters", icon: "meter", label: "มิเตอร์", group: "operations" },
    ],
  },
  {
    key: "money",
    label: "การเงิน",
    items: [
      { key: "invoices", href: "/invoices", icon: "bill", label: "บิล", group: "money" },
      { key: "payments", href: "/payments", icon: "payment", label: "รับชำระเงิน", group: "money" },
    ],
  },
  {
    key: "settings",
    label: "องค์กร",
    items: [{ key: "settings", href: "/settings", icon: "settings", label: "ตั้งค่า", group: "settings" }],
  },
];

export const ADMIN_GROUPS: ShellNavGroup[] = [
  {
    key: "customers",
    label: "ลูกค้า",
    items: [
      { key: "tenants", href: "/tenants", icon: "building", label: "องค์กรลูกค้า", group: "customers" },
      { key: "support_grants", href: "/support", icon: "chat", label: "สิทธิ์ซัพพอร์ต", group: "customers" },
    ],
  },
  {
    key: "platform",
    label: "แพลตฟอร์ม",
    items: [
      { key: "utility_tariffs", href: "/tariffs", icon: "electric", label: "อัตราค่าไฟ-น้ำ", group: "platform" },
      { key: "devices", href: "/devices", icon: "gateway", label: "อุปกรณ์", group: "platform" },
    ],
  },
  {
    key: "operations",
    label: "ปฏิบัติการ",
    items: [{ key: "audit_log", href: "/audit", icon: "history", label: "บันทึกตรวจสอบ", group: "operations" }],
  },
];
