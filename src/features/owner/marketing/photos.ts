/**
 * Marketing photography (2026-10-24 redesign). Every photo is from Unsplash under the Unsplash License (free for
 * commercial use, no attribution required — credited anyway in the footer). Served through `next/image`, so the
 * visitor's browser only talks to our origin. Swap any entry for a photo of a customer's own building (with their
 * written permission) by pointing `src` at `/marketing/<file>.jpg` in `public/`.
 */
export interface MarketingPhoto {
  src: string;
  width: number;
  height: number;
  /** i18n key under `owner.marketing.photos` for the alt text. */
  alt: "living" | "livingGreen" | "bedroom" | "bedroomWarm" | "kitchen" | "tower" | "skyline" | "townhouse" | "keys";
  /** Unsplash photo page, for the credits list. */
  page: string;
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2000&q=80`;

export const PHOTOS = {
  living: {
    src: unsplash("1665249934445-1de680641f50"),
    width: 2000,
    height: 1333,
    alt: "living",
    page: "https://unsplash.com/photos/a-living-room-with-a-large-window",
  },
  livingGreen: {
    src: unsplash("1738168246881-40f35f8aba0a"),
    width: 2000,
    height: 1333,
    alt: "livingGreen",
    page: "https://unsplash.com/photos/a-living-room-with-a-large-green-couch",
  },
  bedroom: {
    src: unsplash("1649068559107-e5d936141e44"),
    width: 2000,
    height: 1333,
    alt: "bedroom",
    page: "https://unsplash.com/photos/a-bed-sitting-in-a-bedroom-next-to-a-window",
  },
  bedroomWarm: {
    src: unsplash("1630699375019-c334927264df"),
    width: 2000,
    height: 1333,
    alt: "bedroomWarm",
    page: "https://unsplash.com/photos/white-bed-with-white-and-black-throw-pillows",
  },
  kitchen: {
    src: unsplash("1630699144641-72fa7a6b8aa1"),
    width: 2000,
    height: 1333,
    alt: "kitchen",
    page: "https://unsplash.com/photos/white-and-black-kitchen-cabinet",
  },
  tower: {
    src: unsplash("1775027687637-6d09c3297137"),
    width: 2000,
    height: 1333,
    alt: "tower",
    page: "https://unsplash.com/photos/modern-high-rise-apartment-buildings-with-lush-green-trees-Dns4MIWvPxg",
  },
  skyline: {
    src: unsplash("1629307015909-5fa16cb14a70"),
    width: 2000,
    height: 1333,
    alt: "skyline",
    page: "https://unsplash.com/photos/high-rise-buildings-near-green-trees-during-daytime-wGB96b2nb0c",
  },
  townhouse: {
    src: unsplash("1790214120388-944c0187239c"),
    width: 2000,
    height: 1333,
    alt: "townhouse",
    page: "https://unsplash.com/photos/modern-apartment-building-with-wooden-louvers",
  },
  keys: {
    src: unsplash("1741156386380-0236c72eb6f9"),
    width: 2000,
    height: 1333,
    alt: "keys",
    page: "https://unsplash.com/photos/holding-house-keys-in-front-of-the-entrance",
  },
} satisfies Record<string, MarketingPhoto>;
