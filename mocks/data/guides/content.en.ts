import type { Guide } from "../../../src/features/owner/marketing/guides/types";

/* English guides (D-271): the same slugs, sections and facts as the Thai ones, written for English readers. */
export const GUIDES_EN: Guide[] = [
  {
    slug: "rental-income-tax",
    locale: "en",
    category: "tax",
    title: "Tax on rental income in Thailand: when to file and what you can deduct",
    summary:
      "Rent is income under Section 40(5): deduct a flat 30% or actual expenses, file PND 94 mid-year and PND 90 for the year, plus withholding tax and lease stamp duty.",
    answer:
      "Rent from a house or condo is type-5 income under Section 40(5) of the Revenue Code. Owners deduct either a flat 30% or actual, documented expenses. Income for January–June is filed on PND 94 by 30 September; the whole year on PND 90 by 31 March of the following year.",
    reviewed: "2026-10-24",
    published: "2026-10-24",
    readMinutes: 6,
    audience: "landlord",
    general: true,
    sections: [
      {
        id: "type",
        heading: "What kind of income is rent",
        blocks: [
          {
            p: "Money from renting out a house, condo, room or land is assessable income under Section 40(5) of the Thai Revenue Code. An individual owner adds it to their other income for personal income tax.",
          },
          {
            p: "Common fees, water and electricity collected from the tenant and passed on to the provider should be shown separately on the bill, with records kept, so the rent itself is clear.",
          },
        ],
      },
      {
        id: "deduct",
        heading: "How much you can deduct",
        blocks: [
          { p: "For renting out a house or building you choose one of two methods." },
          {
            ul: [
              "A flat 30% of the rent, with no receipts needed — right for most owners.",
              "Actual expenses that are necessary and reasonable, with evidence (repairs, furniture, common fees you pay) — worth it when they exceed 30%.",
            ],
          },
          {
            note: "Example: a condo let at 15,000 baht a month earns 180,000 baht a year; with the flat 30% the net income is 126,000 baht before personal allowances.",
            tone: "info",
          },
        ],
      },
      {
        id: "file",
        heading: "Which form, and when",
        blocks: [
          {
            ul: [
              "PND 94 (half-year): income from January to June, filed by 30 September of that year when type 5–8 income exceeds 60,000 baht (single) or 120,000 baht (married). Tax paid is credited at year end.",
              "PND 90 (full year): all rent plus your other income, filed by 31 March of the following year.",
              "Filing online on the Revenue Department's website usually gives a few extra days — check the dates announced each year.",
            ],
          },
        ],
      },
      {
        id: "withholding",
        heading: "Company tenants withhold 5%",
        blocks: [
          {
            p: "When the tenant is a juristic person (for example a company renting a condo for staff), it withholds 5% of the rent and gives you a withholding certificate (50 Tawi). Keep it: it is a credit on your PND 90.",
          },
        ],
      },
      {
        id: "stamp",
        heading: "Stamp duty on the lease",
        blocks: [
          {
            p: "A lease of land or a building carries stamp duty of 1 baht for every 1,000 baht (or part) of the rent over the whole term. By law the lessor pays; who actually bears it can be agreed in the lease. Pay online (e-Stamp Duty) within 15 days of signing.",
          },
          {
            note: "Example: a one-year lease at 10,000 baht a month totals 120,000 baht, so the duty is 120 baht.",
            tone: "info",
          },
        ],
      },
      {
        id: "records",
        heading: "Keep your records all year",
        blocks: [
          {
            ul: [
              "Every lease and its stamp-duty receipt",
              "Monthly rent receipts, with rent separated from utilities and service charges",
              "Withholding tax certificates, if any",
              "Expense evidence, if you deduct actual expenses",
            ],
          },
          {
            note: "getproperty issues a receipt every month in the owner's name, separates rent from service charges, and sums each unit's rental income for the year when you file.",
            tone: "product",
          },
        ],
      },
    ],
    faq: [
      {
        q: "I rent out one condo. Do I need to file tax?",
        a: "Rent is always Section 40(5) income. Whether you must also file PND 94 mid-year depends on whether your type 5–8 income for January–June exceeds 60,000 baht (single) or 120,000 baht (married).",
      },
      {
        q: "Flat 30% or actual expenses?",
        a: "If your documented expenses are below 30% of the rent, the flat deduction is simpler and larger. In a year with big repairs or furnishing, actual expenses may be worth more.",
      },
      {
        q: "Is the security deposit taxable?",
        a: "A deposit you must return is not income. An amount kept for unpaid rent or damage may be income in the year it is kept — ask a tax adviser about your case.",
      },
    ],
    sources: [
      { label: "Revenue Department", url: "https://www.rd.go.th/" },
      { label: "FlowAccount: stamp duty payment", url: "https://flowaccount.com/blog/stamp-duty-thailand-payment/" },
      {
        label: "FlowAccount: PND 94 explained (Thai)",
        url: "https://flowaccount.com/blog/pnd-94-personal-income-tax/",
      },
    ],
  },
  {
    slug: "tm30",
    locale: "en",
    category: "law",
    title: "TM30 for landlords: reporting a foreign tenant's address",
    summary:
      "TM30 is the foreigner address report under Section 38 of the Immigration Act: file within 24 hours, online or in person; a householder who fails faces a fine up to 2,000 baht.",
    answer:
      "TM30 is the report of where a foreigner stays, required by Section 38 of the Immigration Act B.E. 2522. The householder, occupier or hotel manager must file it within 24 hours after a foreign tenant moves in, online or at an immigration office. A householder who does not file can be fined up to 2,000 baht.",
    reviewed: "2026-10-24",
    published: "2026-10-24",
    readMinutes: 4,
    audience: "landlord",
    general: true,
    sections: [
      {
        id: "what",
        heading: "What TM30 is",
        blocks: [
          {
            p: "TM30 is the form that tells the Immigration Bureau where a foreigner is staying. The duty lies with whoever provides the accommodation, not with the foreigner.",
          },
        ],
      },
      {
        id: "who",
        heading: "Who files, and when",
        blocks: [
          {
            ul: [
              "The householder, the occupier of the residence, or the hotel manager who lets a foreigner stay.",
              "Within 24 hours after the foreign tenant starts staying.",
              "When you let a unit, say in the lease who files, and ask the tenant to tell you whenever another foreigner comes to stay.",
            ],
          },
          {
            note: "Late or missing reports: a fine up to 2,000 baht for a householder or occupier, 2,000–10,000 baht for a hotel manager — and the tenant may be unable to extend a visa until it is settled.",
            tone: "warning",
          },
        ],
      },
      {
        id: "how",
        heading: "How to file",
        blocks: [
          {
            ol: [
              "From the tenant's passport: name, nationality, passport number, visa type, date of entry.",
              "Details of the residence and proof of ownership or the lease.",
              "File through the Immigration Bureau's online system, or at the local immigration office (or a police station where there is none).",
              "Keep the receipt: the tenant needs it for visa extensions and reporting.",
            ],
          },
          {
            note: "getproperty alerts you when a foreign tenant moves in, prepares the TM30 details from the lease and counts down the 24 hours.",
            tone: "product",
          },
        ],
      },
    ],
    faq: [
      {
        q: "I own a condo and rent it to a foreigner. Do I file TM30?",
        a: "The householder or occupier who lets a foreigner stay must file. When you let a whole unit, agree in the lease who files — usually the owner.",
      },
      {
        q: "My tenant travelled abroad and came back. File again?",
        a: "Practice differs between offices. Ask the immigration office responsible for your area.",
      },
    ],
    sources: [
      { label: "Thai Law Online: TM30", url: "https://www.thailawonline.com/th/glossary/tm30/" },
      { label: "Immigration Bureau", url: "https://www.immigration.go.th/" },
    ],
  },
  {
    slug: "security-deposit",
    locale: "en",
    category: "law",
    title: "Security deposits in Thailand: what you may deduct and when to return it",
    summary:
      "The 2025 consumer-protection rules for landlords of three or more units: return the deposit within 7 days, deduct only proven damage, and how to avoid disputes from move-in day.",
    answer:
      "Under the Contract Committee notification of 2025 (in force since 4 September 2025), businesses letting three or more residential units must return the deposit within 7 days when the lease ends without dispute, may deduct only unpaid rent or proven damage, and may not charge for normal wear and tear.",
    reviewed: "2026-10-24",
    published: "2026-10-24",
    readMinutes: 5,
    audience: "landlord",
    general: true,
    sections: [
      {
        id: "rule",
        heading: "Who the 2025 rules apply to",
        blocks: [
          {
            p: "The Contract Committee's notification making residential leasing a contract-controlled business (B.E. 2568) took effect on 4 September 2025. It covers operators letting three or more houses, condo units or apartments; dormitories and hotels have their own laws.",
          },
          {
            p: "With fewer than three units your lease and the Civil and Commercial Code govern, but following the same principles builds trust and avoids disputes.",
          },
        ],
      },
      {
        id: "deduct",
        heading: "What you may and may not deduct",
        blocks: [
          {
            ul: [
              "May deduct: unpaid rent or charges, and damage the tenant caused, with clear evidence.",
              "May not deduct: normal wear and tear — faded paint, worn carpet, ageing furniture.",
              "May not deduct: damage from force majeure such as floods or earthquakes.",
              "May not keep the deposit without a justified reason.",
            ],
          },
        ],
      },
      {
        id: "evidence",
        heading: "Avoid disputes from move-in day",
        blocks: [
          {
            ol: [
              "Inspect the unit with the tenant on move-in day and photograph everything with date and time.",
              "Have the tenant confirm the inspection list in writing.",
              "On move-out, inspect against the same list and compare before and after photos.",
              "Send the deductions with photos and repair receipts, and return the rest on time.",
            ],
          },
          {
            note: "getproperty records the inspection with photos on the lease and works out the deposit refund from deductions that have evidence; the tenant sees the same details in LINE.",
            tone: "product",
          },
        ],
      },
      {
        id: "other",
        heading: "Other rules worth knowing",
        blocks: [
          {
            ul: [
              "No raising rent or charges during the lease unless agreed in advance.",
              "No entering the unit without permission or notice, except emergencies such as fire or leaks.",
              "No verbal termination with immediate eviction: notice must be in writing, with time to remedy as the law requires.",
              "Utility bills show the units used and the price per unit so the tenant can check them.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "How many days do I have to return the deposit?",
        a: "Under the 2025 notification, operators letting three or more units must return it within 7 days when the lease ends without dispute.",
      },
      {
        q: "Can I deduct for damage?",
        a: "Yes, for real damage you can prove — before and after photos and repair receipts — but not for normal wear and tear.",
      },
    ],
    sources: [
      {
        label: "Thansettakij: new residential lease rules (Thai)",
        url: "https://www.thansettakij.com/real-estate/650793",
      },
      { label: "Office of the Consumer Protection Board", url: "https://www.ocpb.go.th/" },
    ],
  },
  {
    slug: "lease-essentials",
    locale: "en",
    category: "landlord",
    title: "What a Thai residential lease should contain",
    summary:
      "A checklist for house and condo leases: parties, the unit, rent, deposit, charges, due dates, house rules, renewal and termination, and stamp duty.",
    answer:
      "A sound lease names the parties, the unit and its contents, the term, the rent and due date, the deposit and how it is returned, utilities and service charges, house rules, repairs, renewal and termination, with a move-in inspection attached — and stamp duty paid within 15 days.",
    reviewed: "2026-10-24",
    published: "2026-10-24",
    readMinutes: 5,
    audience: "landlord",
    general: true,
    sections: [
      {
        id: "checklist",
        heading: "A 10-point checklist",
        blocks: [
          {
            ol: [
              "Parties: names, addresses, ID or passport numbers, and an emergency contact.",
              "The unit: address, unit number, size, and the list of furniture and appliances.",
              "Term: start, end and minimum period.",
              "Rent: amount, due date, how to pay, and any late fee.",
              "Deposit and advance rent: amounts and how the deposit is returned.",
              "Utilities and service charges: how they are calculated and the unit rates.",
              "House rules: pets, smoking, extra occupants, common areas.",
              "Repairs: who is responsible for what, and how to report.",
              "Renewal and termination: how many days' notice and how it is given.",
              "Attachments: the inspection list with photos, and copies of both parties' documents.",
            ],
          },
        ],
      },
      {
        id: "law",
        heading: "If you let three or more units",
        blocks: [
          {
            p: "The Contract Committee notification of 2025 (in force 4 September 2025) makes letting three or more residential units a contract-controlled business: the lease must contain the prescribed terms and must not contain unfair ones. See the security deposit guide for the deposit rules.",
          },
        ],
      },
      {
        id: "stamp",
        heading: "Don't forget stamp duty",
        blocks: [
          {
            p: "A lease carries duty of 1 baht per 1,000 baht of the rent over the whole term, payable online within 15 days. An unstamped lease cannot be used as evidence in a civil case until the duty and surcharge are paid.",
          },
          {
            note: "getproperty drafts the lease from the unit and tenant details in Thai and English, lets both sides sign online, attaches the inspection and keeps it with the unit's bills and receipts.",
            tone: "product",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Is an online lease valid?",
        a: "A lease made and signed electronically is valid under the Electronic Transactions Act, and carries stamp duty like a paper one.",
      },
      {
        q: "Do the consumer-protection rules apply if I let fewer than three units?",
        a: "The 2025 notification covers operators letting three or more units. Below that, your lease and the Civil and Commercial Code govern — following the same approach still avoids disputes.",
      },
    ],
    sources: [
      {
        label: "Thansettakij: new residential lease rules (Thai)",
        url: "https://www.thansettakij.com/real-estate/650793",
      },
      { label: "Revenue Department (stamp duty)", url: "https://www.rd.go.th/" },
    ],
  },
  {
    slug: "first-time-landlord",
    locale: "en",
    category: "landlord",
    title: "Renting out your condo for the first time: a checklist",
    summary:
      "From preparing the unit and setting the rent to photos, listing, choosing a tenant, the lease, handover and collecting rent every month without chasing.",
    answer:
      "Work in order: get the unit ready, price it against similar units nearby, take at least five daylight photos, list it with the address and full terms, screen tenants and arrange viewings, sign the lease with a move-in inspection, then set up automatic bills and receipts.",
    reviewed: "2026-10-24",
    published: "2026-10-24",
    readMinutes: 5,
    audience: "landlord",
    general: false,
    sections: [
      {
        id: "prepare",
        heading: "1. Prepare the unit and set the rent",
        blocks: [
          {
            ul: [
              "Deep-clean, fix everything, replace bulbs and lock batteries.",
              "Compare rents of similar size and floor in the same building or area.",
              "Price to let within a month: an empty month costs more than a small discount.",
            ],
          },
        ],
      },
      {
        id: "list",
        heading: "2. Photos and listing",
        blocks: [
          {
            ul: [
              "Shoot in daylight with every light on, from the corners, at least five photos.",
              "Give what tenants ask first: rent, deposit, minimum term, utilities, pets, distance to transit.",
              "Show the real address: tenants trust it more and you get serious enquiries.",
            ],
          },
          {
            note: "List free on getproperty; enquiries reach you directly in LINE, with no agent.",
            tone: "product",
          },
        ],
      },
      {
        id: "tenant",
        heading: "3. Screen tenants and avoid scams",
        blocks: [
          {
            ul: [
              "Always show the unit in person before taking money.",
              "See an ID card or passport and ask about work.",
              "Take booking money or deposits only into an account in your own name, with a receipt every time.",
            ],
          },
        ],
      },
      {
        id: "move-in",
        heading: "4. Lease and handover",
        blocks: [
          {
            ol: [
              "Sign a lease following the lease checklist.",
              "Inspect the unit with the tenant and photograph everything.",
              "Record the water and electricity meter readings on handover.",
              "For a foreign tenant, file TM30 within 24 hours.",
            ],
          },
        ],
      },
      {
        id: "collect",
        heading: "5. Collect rent every month without chasing",
        blocks: [
          {
            p: "Send the bill on the same day every month with the amount and how to pay, confirm payment and issue the receipt at once. Tenants who get bills on time pay on time.",
          },
          {
            note: "getproperty sends bills with a QR to your tenant's LINE, confirms payments and issues receipts automatically — free, with no monthly fee.",
            tone: "product",
          },
        ],
      },
    ],
    faq: [
      {
        q: "How many months of deposit should I take?",
        a: "Condos and houses commonly take two months' deposit and one month in advance. State the amounts and how the deposit is returned in the lease.",
      },
      {
        q: "Do I need an agent?",
        a: "Not necessarily. If you can answer enquiries and show the unit, listing it yourself and talking to tenants directly saves the commission.",
      },
    ],
    sources: [],
  },
];
