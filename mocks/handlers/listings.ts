// `/v1/public/listings*` (D-252), areas (D-272) and owner pages (D-274) like getproperty-api's B7.2 / B7.9.
// Sample listings for `pnpm dev:mock` and the e2e suite only; production reads the API and shows an empty state
// until real owners publish.
import { http, HttpResponse, type HttpHandler } from "msw";

import type {
  PublicListingArea,
  PublicListingDetail,
  PublicListingSummary,
  PublicOwner,
} from "../../src/features/owner/marketing/listings/contract";

const photo = (id: string, caption: string | null = null) => ({
  url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`,
  width: 1600,
  height: 1067,
  caption,
});

const P = {
  living: "1665249934445-1de680641f50",
  green: "1738168246881-40f35f8aba0a",
  bedroom: "1649068559107-e5d936141e44",
  bedroomWhite: "1630699375019-c334927264df",
  kitchen: "1630699144641-72fa7a6b8aa1",
  tower: "1775027687637-6d09c3297137",
  skyline: "1629307015909-5fa16cb14a70",
  townhouse: "1790214120388-944c0187239c",
  townhouseTrees: "1774939234567-3bf081ab2bc0",
  bedroomDesk: "1652882860938-f90aa298e644",
};

const OG_BASE = "https://api.getproperty.test/v1/public/listings";

/** The API's schema.org Offer (G4, D-296) built from the facts on the page, like `listing-json-ld.ts`. */
const offerJsonLd = (listing: Omit<PublicListingDetail, "jsonLd">): PublicListingDetail["jsonLd"] => ({
  "@context": "https://schema.org",
  "@type": "Offer",
  url: `https://getproperty.test/rent/${listing.slug}`,
  price: listing.rent,
  priceCurrency: "THB",
  businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
  priceSpecification: {
    "@type": "UnitPriceSpecification",
    price: listing.rent,
    priceCurrency: "THB",
    unitCode: "MON",
    referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
  },
  ...(listing.availableFrom ? { availabilityStarts: listing.availableFrom } : {}),
  itemOffered: {
    "@type":
      listing.unitKind === "house" || listing.unitKind === "townhouse"
        ? "House"
        : listing.unitKind === "room"
          ? "Room"
          : "Apartment",
    name: listing.title,
    ...(listing.bedrooms !== null ? { numberOfBedrooms: listing.bedrooms } : {}),
    ...(listing.sizeSqm
      ? { floorSize: { "@type": "QuantitativeValue", value: listing.sizeSqm, unitCode: "MTK" } }
      : {}),
    petsAllowed: listing.petsAllowed,
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.district,
      addressRegion: listing.province,
      addressCountry: "TH",
    },
    image: [listing.ogImageUrl],
  },
});

const base = (
  slug: string,
  over: Partial<Omit<PublicListingDetail, "jsonLd" | "ogImageUrl">> &
    Pick<PublicListingDetail, "title" | "rent" | "cover">,
): PublicListingDetail => {
  const listing: Omit<PublicListingDetail, "jsonLd"> = {
    slug,
    unitKind: "condo_unit",
    depositMonths: 2,
    advanceMonths: 1,
    minTermMonths: 12,
    sizeSqm: "30.00",
    bedrooms: 1,
    bathrooms: 1,
    furnishing: "fully_furnished",
    petsAllowed: false,
    smokingAllowed: false,
    availableFrom: "2026-11-01",
    province: "กรุงเทพมหานคร",
    district: "พญาไท",
    address: "",
    nearestTransit: null,
    verifiedOwner: true,
    ownerIdentityVerified: false,
    publishedAt: "2026-10-20T09:00:00+07:00",
    description: "",
    facilities: ["สระว่ายน้ำ", "ฟิตเนส", "ที่จอดรถ", "รปภ. 24 ชม.", "คีย์การ์ด"],
    photos: [],
    floor: null,
    geo: null,
    ownerDisplayName: "คุณนภา",
    ownerProfileSlug: null,
    utility: null,
    verifiedVacant: false,
    vacantSince: null,
    sponsored: false,
    sponsoredLabel: null,
    ogImageUrl: `${OG_BASE}/${slug}/og-image`,
    ...over,
  };
  return { ...listing, jsonLd: offerJsonLd(listing) };
};

const LISTINGS: PublicListingDetail[] = [
  base("condo-ari-1br-sunlit", {
    title: "คอนโดแสงดีใกล้ BTS อารีย์ 1 ห้องนอน วิวสวน",
    rent: "16500.00",
    sizeSqm: "34.50",
    floor: "18",
    district: "พญาไท",
    address: "ซอยพหลโยธิน 7 แขวงพญาไท เขตพญาไท กรุงเทพฯ 10400",
    nearestTransit: { name: "อารีย์", line: "BTS สายสุขุมวิท", distanceM: 350 },
    ownerProfileSlug: "landlord-0a1b2c3d4e",
    ownerIdentityVerified: true,
    // D-296: the last lease on getproperty ended at the end of September, nobody lives there since.
    verifiedVacant: true,
    vacantSince: "2026-10-01",
    utility: {
      electricity: {
        kind: "tiered",
        pricePerUnit: null,
        tiers: [
          { fromUnits: "0", toUnits: "150", pricePerUnit: "4.0000" },
          { fromUnits: "150", toUnits: null, pricePerUnit: "5.0000" },
        ],
        minimumCharge: null,
      },
      water: { kind: "flat", pricePerUnit: "18.0000", tiers: [], minimumCharge: "100.00" },
      fixedCharges: [{ kind: "common_fee", name: "ค่าส่วนกลาง", amount: "1200.00" }],
      averageBill3m: "1385.00",
      basedOnBills: 3,
    },
    cover: photo(P.living),
    photos: [
      photo(P.living, "ห้องนั่งเล่น"),
      photo(P.bedroom, "ห้องนอน"),
      photo(P.kitchen, "ครัว"),
      photo(P.tower, "ตัวอาคาร"),
    ],
    description:
      "ห้องหันทิศตะวันออก แดดเช้าเข้าเต็มห้อง ช่วงบ่ายไม่ร้อน เฟอร์นิเจอร์ครบ เครื่องซักผ้าในห้อง เดินไป BTS อารีย์ 5 นาที ใกล้ร้านอาหารและคาเฟ่ย่านอารีย์",
    geo: { lat: 13.7797, lng: 100.5446 },
  }),
  base("condo-onnut-studio-near-bts", {
    title: "สตูดิโอใหม่ ห้อง 26 ตร.ม. ติด BTS อ่อนนุช",
    rent: "9800.00",
    sizeSqm: "26.00",
    bedrooms: 0,
    floor: "9",
    district: "วัฒนา",
    address: "ถนนสุขุมวิท 77 แขวงพระโขนงเหนือ เขตวัฒนา กรุงเทพฯ 10110",
    nearestTransit: { name: "อ่อนนุช", line: "BTS สายสุขุมวิท", distanceM: 180 },
    cover: photo(P.bedroomWhite),
    photos: [photo(P.bedroomWhite, "ห้องนอน"), photo(P.kitchen, "มุมครัว"), photo(P.skyline, "วิวจากระเบียง")],
    description: "ห้องสะอาด เพิ่งทาสีใหม่ มีเครื่องทำน้ำอุ่น ไมโครเวฟ ตู้เย็น เหมาะกับคนทำงานคนเดียว ค่าน้ำตามมิเตอร์",
    ownerDisplayName: "คุณต้น",
  }),
  base("townhouse-srinakarin-3br", {
    verifiedVacant: true,
    vacantSince: "2026-09-16",
    title: "ทาวน์โฮม 3 ห้องนอน ศรีนครินทร์ จอดรถได้ 2 คัน",
    unitKind: "townhouse",
    rent: "28000.00",
    sizeSqm: "140.00",
    bedrooms: 3,
    bathrooms: 3,
    furnishing: "partly_furnished",
    petsAllowed: true,
    province: "สมุทรปราการ",
    district: "เมืองสมุทรปราการ",
    address: "ถนนศรีนครินทร์ ตำบลบางเมือง อำเภอเมืองสมุทรปราการ สมุทรปราการ 10270",
    nearestTransit: { name: "ศรีลาซาล", line: "MRT สายสีเหลือง", distanceM: 1200 },
    cover: photo(P.townhouse),
    photos: [
      photo(P.townhouse, "หน้าบ้าน"),
      photo(P.green, "ห้องนั่งเล่น"),
      photo(P.bedroom, "ห้องนอนใหญ่"),
      photo(P.kitchen, "ครัว"),
    ],
    description:
      "ทาวน์โฮม 3 ชั้น ในโครงการมีรปภ. เลี้ยงสัตว์เล็กได้ มีแอร์ 3 เครื่อง ครัวปิด ใกล้เมกาบางนาและพาราไดซ์พาร์ค",
    facilities: ["ที่จอดรถ 2 คัน", "รปภ. 24 ชม.", "สวนส่วนกลาง", "เลี้ยงสัตว์ได้"],
    ownerDisplayName: "คุณวิภา",
  }),
  base("condo-ladprao-2br-family", {
    title: "คอนโด 2 ห้องนอน ลาดพร้าว เหมาะกับครอบครัว",
    rent: "22000.00",
    sizeSqm: "56.00",
    bedrooms: 2,
    bathrooms: 2,
    floor: "21",
    district: "จตุจักร",
    address: "ถนนลาดพร้าว แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900",
    nearestTransit: { name: "ลาดพร้าว", line: "MRT สายสีน้ำเงิน", distanceM: 450 },
    cover: photo(P.green),
    photos: [photo(P.green, "ห้องนั่งเล่น"), photo(P.bedroom, "ห้องนอน"), photo(P.tower, "ตัวอาคาร")],
    description: "ห้องมุม ลมโกรก มีห้องนอนเล็กใช้เป็นห้องทำงานได้ ใกล้เซ็นทรัลลาดพร้าวและสวนจตุจักร",
    ownerDisplayName: "คุณสมชาย",
  }),
  base("room-ngamwongwan-dorm", {
    title: "ห้องพักรายเดือน งามวงศ์วาน ใกล้มหาวิทยาลัย",
    unitKind: "room",
    rent: "4500.00",
    depositMonths: 1,
    minTermMonths: 6,
    sizeSqm: "24.00",
    bedrooms: 0,
    province: "นนทบุรี",
    district: "เมืองนนทบุรี",
    address: "ถนนงามวงศ์วาน ตำบลบางกระสอ อำเภอเมืองนนทบุรี นนทบุรี 11000",
    nearestTransit: { name: "แยกติวานนท์", line: "MRT สายสีม่วง", distanceM: 900 },
    cover: photo(P.bedroomDesk),
    photos: [photo(P.bedroomDesk, "ห้องพัก")],
    description:
      "หอพักเงียบสงบ มีโต๊ะทำงาน แอร์ เครื่องทำน้ำอุ่น อินเทอร์เน็ตไฟเบอร์ บิลส่งทาง LINE ทุกเดือน แจ้งซ่อมผ่าน LINE ได้",
    facilities: ["อินเทอร์เน็ต", "คีย์การ์ด", "ที่จอดมอเตอร์ไซค์", "เครื่องซักผ้าหยอดเหรียญ"],
    ownerDisplayName: "หอพักตัวอย่าง",
  }),
  base("house-nonthaburi-garden", {
    title: "บ้านเดี่ยวมีสวน 3 ห้องนอน นนทบุรี เลี้ยงสัตว์ได้",
    unitKind: "house",
    rent: "35000.00",
    sizeSqm: "180.00",
    bedrooms: 3,
    bathrooms: 2,
    furnishing: "unfurnished",
    petsAllowed: true,
    province: "นนทบุรี",
    district: "บางใหญ่",
    address: "ถนนกาญจนาภิเษก ตำบลเสาธงหิน อำเภอบางใหญ่ นนทบุรี 11140",
    nearestTransit: null,
    cover: photo(P.townhouseTrees),
    photos: [photo(P.townhouseTrees, "หน้าบ้าน"), photo(P.green, "ห้องนั่งเล่น")],
    description: "บ้านในหมู่บ้าน สวนหน้าบ้านกว้าง เหมาะกับครอบครัวที่มีสัตว์เลี้ยง ใกล้เซ็นทรัลเวสต์เกต",
    facilities: ["สวน", "ที่จอดรถ 2 คัน", "รปภ. หมู่บ้าน"],
    verifiedOwner: false,
    ownerDisplayName: "คุณเอก",
  }),
];

const summary = ({
  description,
  facilities,
  photos,
  floor,
  geo,
  ownerDisplayName,
  ownerProfileSlug,
  smokingAllowed,
  utility,
  jsonLd,
  ogImageUrl,
  ...rest
}: PublicListingDetail): PublicListingSummary => {
  void [description, facilities, photos, floor, geo, ownerDisplayName, ownerProfileSlug, smokingAllowed, utility];
  void [jsonLd, ogImageUrl];
  return rest;
};

/**
 * G5 (D-297): the boosted sample — paid, in force — takes the sponsored slot on top of the first search page when it
 * matches the query (`boost.search.max_per_page` slots; one boosted listing in the mock), labelled by Accept-Language;
 * its organic duplicate is dropped from that page. The detail and the owner page never carry a sponsored slot.
 */
const BOOSTED = "condo-ladprao-2br-family";
const adLabel = (request: Request) =>
  (request.headers.get("accept-language") ?? "th").toLowerCase().startsWith("en") ? "Ad" : "โฆษณา";

/** Areas (D-272): districts and transit stations with published listings, like `GET /v1/public/listings/areas`. */
const AREAS: (Omit<PublicListingArea, "count" | "band" | "indexable"> & {
  match: (l: PublicListingDetail) => boolean;
})[] = [
  {
    slug: "ari",
    kind: "station",
    name: "อารีย์",
    nameEn: "Ari",
    province: "กรุงเทพมหานคร",
    provinceEn: "Bangkok",
    line: "BTS สายสุขุมวิท",
    match: (l) => l.nearestTransit?.name === "อารีย์",
  },
  {
    slug: "on-nut",
    kind: "station",
    name: "อ่อนนุช",
    nameEn: "On Nut",
    province: "กรุงเทพมหานคร",
    provinceEn: "Bangkok",
    line: "BTS สายสุขุมวิท",
    match: (l) => l.nearestTransit?.name === "อ่อนนุช",
  },
  {
    slug: "lat-phrao",
    kind: "station",
    name: "ลาดพร้าว",
    nameEn: "Lat Phrao",
    province: "กรุงเทพมหานคร",
    provinceEn: "Bangkok",
    line: "MRT สายสีน้ำเงิน",
    match: (l) => l.nearestTransit?.name === "ลาดพร้าว",
  },
  {
    slug: "phaya-thai",
    kind: "district",
    name: "พญาไท",
    nameEn: "Phaya Thai",
    province: "กรุงเทพมหานคร",
    provinceEn: "Bangkok",
    line: null,
    match: (l) => l.district === "พญาไท",
  },
  {
    slug: "chatuchak",
    kind: "district",
    name: "จตุจักร",
    nameEn: "Chatuchak",
    province: "กรุงเทพมหานคร",
    provinceEn: "Bangkok",
    line: null,
    match: (l) => l.district === "จตุจักร",
  },
  {
    slug: "nonthaburi",
    kind: "district",
    name: "นนทบุรี",
    nameEn: "Nonthaburi",
    province: "นนทบุรี",
    provinceEn: "Nonthaburi",
    line: null,
    match: (l) => l.province === "นนทบุรี",
  },
];

function band(rents: number[]): PublicListingArea["band"] {
  if (rents.length < 2) return null;
  const sorted = [...rents].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1)))]!.toFixed(2);
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
}

const areaRows = (): PublicListingArea[] =>
  AREAS.map(({ match, ...area }) => {
    const rows = LISTINGS.filter(match);
    return { ...area, count: rows.length, indexable: rows.length >= 2, band: band(rows.map((l) => Number(l.rent))) };
  }).filter((area) => area.count > 0);

/** The verified owner of the first listing (D-274); every other owner's page is closed. */
const OWNER_PAGE = (): PublicOwner => {
  const listings = LISTINGS.filter((l) => l.ownerProfileSlug === "landlord-0a1b2c3d4e").map(summary);
  return {
    slug: "landlord-0a1b2c3d4e",
    displayName: "คุณนภา",
    verification: { level: "unit_ownership", verifiedUnits: 2, identityVerified: true },
    memberSince: "2026-10-01",
    medianReplyMinutes: 42,
    listings,
    listingCount: listings.length,
  };
};

export const listingHandlers: HttpHandler[] = [
  // D-268: a share-kit short link of the Ari listing (posted in a Facebook group); every other code is unknown.
  http.post("*/v1/public/share-links/:code/open", ({ params }) =>
    params.code === "ab12cd34"
      ? HttpResponse.json({
          slug: "condo-ari-1br-sunlit",
          channel: "facebook_group",
          utm: { source: "facebook_group", medium: "share", campaign: "listing" },
        })
      : HttpResponse.json(
          { type: "about:blank", title: "Not found", status: 404, code: "http.not_found" },
          { status: 404, headers: { "content-type": "application/problem+json" } },
        ),
  ),
  http.get("*/v1/public/owners/:slug", ({ params }) =>
    params.slug === "landlord-0a1b2c3d4e"
      ? HttpResponse.json(OWNER_PAGE())
      : HttpResponse.json(
          { type: "about:blank", title: "Not found", status: 404, code: "http.not_found" },
          { status: 404, headers: { "content-type": "application/problem+json" } },
        ),
  ),
  http.get("*/v1/public/listings/areas", () => HttpResponse.json({ data: areaRows() })),
  http.get("*/v1/public/listings/sitemap", () =>
    HttpResponse.json({ data: LISTINGS.map((l) => ({ slug: l.slug, updatedAt: l.publishedAt })) }),
  ),
  http.get("*/v1/public/listings/:slug", ({ params }) => {
    const found = LISTINGS.find((l) => l.slug === params.slug);
    return found
      ? HttpResponse.json(found)
      : HttpResponse.json(
          { type: "about:blank", title: "Not found", status: 404, code: "http.not_found" },
          { status: 404, headers: { "content-type": "application/problem+json" } },
        );
  }),
  http.get("*/v1/public/listings", ({ request }) => {
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").trim();
    const area = AREAS.find((a) => a.slug === p.get("area"));
    let rows = LISTINGS.filter(
      (l) =>
        (!p.get("area") || (area?.match(l) ?? false)) &&
        (!q ||
          [l.title, l.district, l.province, l.address, l.nearestTransit?.name ?? ""].some((v) =>
            (v ?? "").includes(q),
          )) &&
        (!p.get("kind") || l.unitKind === p.get("kind")) &&
        (!p.get("minRent") || Number(l.rent) >= Number(p.get("minRent"))) &&
        (!p.get("maxRent") || Number(l.rent) <= Number(p.get("maxRent"))) &&
        (!p.get("bedrooms") || (l.bedrooms ?? 0) >= Number(p.get("bedrooms"))) &&
        (p.get("pets") !== "1" || l.petsAllowed),
    );
    const sort = p.get("sort");
    if (sort === "rent_asc") rows = [...rows].sort((a, b) => Number(a.rent) - Number(b.rent));
    if (sort === "rent_desc") rows = [...rows].sort((a, b) => Number(b.rent) - Number(a.rent));
    const boosted = !p.get("cursor") ? rows.find((l) => l.slug === BOOSTED) : undefined;
    const data = boosted
      ? [
          { ...summary(boosted), sponsored: true, sponsoredLabel: adLabel(request) },
          ...rows.filter((l) => l !== boosted).map(summary),
        ]
      : rows.map(summary);
    return HttpResponse.json({ data, total: rows.length, nextCursor: null });
  }),
];
