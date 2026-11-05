/**
 * The seeded values of the J2.1 settings (api `juristic-accounting-settings.ts` at c0a216c2): approval bands (assumed
 * defaults, D-329) and withholding-tax rates (⚖ O-041, `verified: false`). No imports, so both the settings list and
 * the accounting world can read them while the mock state is being created.
 */
export const DEFAULT_BANDS: { upTo: string | null; roles: ("owner" | "manager" | "committee")[]; approvals: number }[] =
  [
    { upTo: "10000.00", roles: ["owner", "manager", "committee"], approvals: 1 },
    { upTo: "100000.00", roles: ["owner", "manager", "committee"], approvals: 2 },
    { upTo: null, roles: ["owner", "committee"], approvals: 3 },
  ];

export const DEFAULT_WHT_RATES = [
  {
    key: "transport",
    labelTh: "ค่าขนส่ง",
    labelEn: "Transport",
    incomeType: "3 เตรส",
    ratePct: "1.00",
    verified: false,
  },
  {
    key: "advertising",
    labelTh: "ค่าโฆษณา",
    labelEn: "Advertising",
    incomeType: "3 เตรส",
    ratePct: "2.00",
    verified: false,
  },
  {
    key: "service",
    labelTh: "ค่าบริการ / ค่าจ้างทำของ",
    labelEn: "Services / hire of work",
    incomeType: "3 เตรส",
    ratePct: "3.00",
    verified: false,
  },
  {
    key: "professional",
    labelTh: "ค่าวิชาชีพอิสระ",
    labelEn: "Professional fees",
    incomeType: "40(6)",
    ratePct: "3.00",
    verified: false,
  },
  { key: "rent", labelTh: "ค่าเช่า", labelEn: "Rent", incomeType: "40(5)", ratePct: "5.00", verified: false },
];
