import type { components } from "../src/lib/api/schema";
import { TENANTS } from "./fixtures";

type Schemas = components["schemas"];

/**
 * Storage of pack G1 (D-285, D-286, D-292) shared by the owner and the admin mocks: the package definitions the
 * platform admin keeps (price-plan add-ons — no price until the founder sets one, O-022), the packages tenants
 * bought, every tenant's stored files with their legal hold and reclaim state, per-tenant free-quota overrides and
 * the reconciliation reports. Reset with the owner part `storage` (the platform reset leaves it, so owner and admin specs run in parallel).
 */

export const GIB = 1024 ** 3;
const MB = 1024 ** 2;
export const SAMPLE_TENANT = TENANTS.sample.profile.id;
/** Platform default free allowance (`storage.free_gb`, D-285). */
export const DEFAULT_FREE_GB = "5";
/** `storage.reclaim.purge_after_days` (D-292). */
export const PURGE_AFTER_DAYS = 7;

export type MockStoredFile = Schemas["StoredFileDto"] & { tenantId: string };

export interface MockStorageWorld {
  definitions: Schemas["StoragePackageDefinitionDto"][];
  packages: (Schemas["OwnerStoragePackageDto"] & { tenantId: string })[];
  files: MockStoredFile[];
  /** Tenant id → free GB (tenant version of `storage.free_gb`). */
  quota: Record<string, { freeGb: string; versionId: string; effectiveFrom: string }>;
  reconciliations: Schemas["StorageReconciliationDto"][];
}

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function file(
  n: number,
  input: Pick<Schemas["StoredFileDto"], "kind" | "title" | "mimeType" | "category"> & {
    mb: number;
    objects?: number;
    age: number;
    hold?: { until: string | null };
    refusal?: Schemas["ReclaimRefusal"];
  },
): MockStoredFile {
  const held = Boolean(input.hold);
  const refusal = held ? "legal_hold" : (input.refusal ?? null);
  return {
    tenantId: SAMPLE_TENANT,
    id: `0199f2a0-0000-7000-8000-0000000005${String(n).padStart(2, "0")}`,
    kind: input.kind,
    title: input.title,
    mimeType: input.mimeType,
    category: input.category,
    bytes: String(Math.round(input.mb * MB)),
    objects: input.objects ?? 1,
    createdAt: daysAgo(input.age),
    deletedAt: null,
    purgeAfter: null,
    held,
    retainUntil: input.hold?.until ?? null,
    deletable: refusal === null,
    notDeletableReason: refusal,
  };
}

/** The sample apartment's files: optional uploads that may go, and evidence / legal / system files that stay. */
function initialFiles(): MockStoredFile[] {
  return [
    file(1, {
      kind: "other",
      title: "วิดีโอแนะนำหอพัก.mp4",
      mimeType: "video/mp4",
      category: "attachment",
      mb: 352,
      age: 210,
    }),
    file(2, {
      kind: "as_built",
      title: "แบบก่อสร้างอาคาร A.pdf",
      mimeType: "application/pdf",
      category: "attachment",
      mb: 384,
      age: 400,
    }),
    file(3, {
      kind: "export",
      title: "รายงานประจำปี 2568.zip",
      mimeType: "application/zip",
      category: "system_other",
      mb: 418,
      age: 30,
      refusal: "system_file",
    }),
    file(4, {
      kind: "floor_plan",
      title: "ผังชั้น 3.pdf",
      mimeType: "application/pdf",
      category: "attachment",
      mb: 24,
      age: 300,
    }),
    file(5, {
      kind: "other",
      title: "ใบเสนอราคาแอร์ 2568.pdf",
      mimeType: "application/pdf",
      category: "attachment",
      mb: 12,
      age: 120,
    }),
    file(6, {
      kind: "inspection_photo",
      title: "ตรวจห้อง A-201 ก่อนเข้าอยู่.jpg",
      mimeType: "image/jpeg",
      category: "attachment",
      mb: 3.2,
      objects: 3,
      age: 90,
      refusal: "evidence",
    }),
    file(7, {
      kind: "listing_photo",
      title: "ห้อง 205 วิวระเบียง.jpg",
      mimeType: "image/webp",
      category: "listing_media",
      mb: 2.1,
      objects: 4,
      age: 12,
      refusal: "listing_in_use",
    }),
    file(8, {
      kind: "listing_photo",
      title: "ห้อง 301 มุมนั่งเล่น.jpg",
      mimeType: "image/webp",
      category: "listing_media",
      mb: 1.8,
      objects: 4,
      age: 60,
    }),
    file(9, {
      kind: "listing_photo",
      title: "ห้อง 301 ห้องน้ำ.jpg",
      mimeType: "image/webp",
      category: "listing_media",
      mb: 1.6,
      objects: 4,
      age: 60,
    }),
    file(10, {
      kind: "contract",
      title: "สัญญาเช่า A-201.pdf",
      mimeType: "application/pdf",
      category: "system_legal",
      mb: 0.9,
      age: 200,
      hold: { until: null },
    }),
    file(11, {
      kind: "slip",
      title: "สลิป A-201 ตุลาคม.jpg",
      mimeType: "image/jpeg",
      category: "system_legal",
      mb: 0.6,
      age: 20,
      hold: { until: "2031-10-05" },
    }),
    file(12, {
      kind: "meter_photo",
      title: "มิเตอร์ไฟ A-201 ตุลาคม.jpg",
      mimeType: "image/jpeg",
      category: "attachment",
      mb: 0.4,
      age: 25,
      refusal: "evidence",
    }),
    file(13, {
      kind: "pdf_receipt",
      title: "ใบเสร็จ RC-2569-0012.pdf",
      mimeType: "application/pdf",
      category: "system_legal",
      mb: 0.2,
      age: 20,
      hold: { until: "2031-10-01" },
    }),
  ];
}

function definition(
  n: number,
  key: string,
  nameTh: string,
  nameEn: string,
  gb: number,
  period: Schemas["StoragePackagePeriod"],
): Schemas["StoragePackageDefinitionDto"] {
  return {
    id: `0199f2a0-0000-7000-8000-0000000006${String(n).padStart(2, "0")}`,
    key,
    nameTh,
    nameEn,
    tenantType: null,
    isActive: true,
    sizeBytes: String(gb * GIB),
    period,
    visibility: "public",
    // O-022: defined without a price → shown "ยังไม่เปิดขาย"; a control publishes one for tests.
    onSale: false,
    versionId: `0199f2a0-0000-7000-8000-0000000007${String(n).padStart(2, "0")}`,
    versionState: "draft",
    unitPrice: null,
    vatRate: "0.0700",
    effectiveFrom: today(),
    effectiveTo: null,
  };
}

export function initialStorageWorld(): MockStorageWorld {
  return {
    definitions: [
      definition(1, "storage_plus_20", "พื้นที่เพิ่ม 20 GB", "Extra 20 GB", 20, "month"),
      definition(2, "storage_plus_100", "พื้นที่เพิ่ม 100 GB", "Extra 100 GB", 100, "year"),
    ],
    packages: [],
    files: initialFiles(),
    quota: {},
    reconciliations: [
      {
        id: "0199f2a0-0000-7000-8000-000000000801",
        tenantId: SAMPLE_TENANT,
        ranAt: daysAgo(0.4),
        s3Bytes: "1263540000",
        s3Objects: "1206",
        dbBytes: "1263440000",
        dbObjects: "1205",
        driftBytes: "100000",
        corrected: true,
        details: {
          countedAfter: "1263540000",
          missing: [],
          missingCount: 0,
          orphanCount: 1,
          orphans: [],
          resizedDocuments: 0,
        },
      },
    ],
  };
}

/** Price incl. VAT as the API would compute it (mock only; the web never does money maths). */
export function vatTotal(price: string, vatRate: string): string {
  const satang = Math.round(Number(price) * 100);
  return ((satang + Math.round(satang * Number(vatRate))) / 100).toFixed(2);
}

export function storageToday(): string {
  return today();
}
