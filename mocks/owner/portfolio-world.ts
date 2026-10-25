import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";

type Schemas = components["schemas"];

const STUB_ARI = "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a01";
const STUB_THONGLOR = "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a02";
const HOUSE = "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a03";

/** This month as the API's `YYYY-MM` (Bangkok). */
export function portfolioMonth(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
}

/**
 * The landlord persona's units (B7.1): a leased condo with this month paid, a condo moving out with an overdue
 * balance, and a vacant house — the three states a portfolio card shows. Amounts are decimal strings.
 */
export function initialPortfolios(): Record<string, Schemas["PortfolioUnitDto"][]> {
  return {
    [TENANTS.landlord.profile.id]: [
      {
        unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c01",
        unitNo: "12/345",
        kind: "condo_unit",
        building: { id: STUB_ARI, name: "ไอดีโอ โมบิ อารีย์", external: true },
        address: { line1: "ถนนพหลโยธิน", district: "พญาไท", province: "กรุงเทพมหานคร", postcode: "10400" },
        areaSqm: "28.50",
        bedrooms: 1,
        bathrooms: 1,
        floorLabel: "12",
        furnishing: "fully_furnished",
        defaultRent: "15000.00",
        state: "leased",
        leaseId: "8c3f2e5a-4d6b-4a7c-8d1e-2f3a4b5c6d01",
        leaseEndDate: "2027-05-31",
        invoice: { id: "9d4a3f6b-5e7c-4b8d-9e2f-3a4b5c6d7e01", status: "paid", total: "15000.00", balance: "0.00" },
        openServiceRequests: 0,
      },
      {
        unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c02",
        unitNo: "8/101",
        kind: "condo_unit",
        building: { id: STUB_THONGLOR, name: "เดอะ ลอฟท์ ทองหล่อ", external: false },
        address: { line1: "ซอยสุขุมวิท 55", district: "วัฒนา", province: "กรุงเทพมหานคร", postcode: "10110" },
        areaSqm: "35.00",
        bedrooms: 1,
        bathrooms: 1,
        floorLabel: "8",
        furnishing: "partly_furnished",
        defaultRent: "22000.00",
        state: "notice_given",
        leaseId: "8c3f2e5a-4d6b-4a7c-8d1e-2f3a4b5c6d02",
        leaseEndDate: "2026-11-30",
        invoice: {
          id: "9d4a3f6b-5e7c-4b8d-9e2f-3a4b5c6d7e02",
          status: "overdue",
          total: "22000.00",
          balance: "22000.00",
        },
        openServiceRequests: 1,
      },
      {
        unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c03",
        unitNo: "1",
        kind: "house",
        building: { id: HOUSE, name: "บ้านสวนนนทบุรี", external: false },
        address: { line1: "99/12 ถนนรัตนาธิเบศร์", district: "เมืองนนทบุรี", province: "นนทบุรี", postcode: "11000" },
        areaSqm: "180.00",
        bedrooms: 3,
        bathrooms: 2,
        floorLabel: null,
        furnishing: "unfurnished",
        defaultRent: "35000.00",
        state: "vacant",
        leaseId: null,
        leaseEndDate: null,
        invoice: null,
        openServiceRequests: 0,
      },
    ],
    [TENANTS.fresh.profile.id]: [],
  };
}

/** The month's totals as the API computes them (invoiced, paid on them, overdue balance) — mock arithmetic only. */
export function portfolioTotals(units: Schemas["PortfolioUnitDto"][]): Schemas["PortfolioTotalsDto"] {
  const cents = (value: string) => Math.round(Number(value) * 100);
  const money = (value: number) => (value / 100).toFixed(2);
  let expected = 0;
  let collected = 0;
  let overdue = 0;
  for (const unit of units) {
    if (!unit.invoice) continue;
    expected += cents(unit.invoice.total);
    collected += cents(unit.invoice.total) - cents(unit.invoice.balance);
    if (unit.invoice.status === "overdue") overdue += cents(unit.invoice.balance);
  }
  return { month: portfolioMonth(), expected: money(expected), collected: money(collected), overdue: money(overdue) };
}
