/**
 * Brand values are configuration, not copy scattered through the app (design-system.md §2, D-001,
 * docs/ui/brand.md). The brand *hue* lives in `src/ui/tokens/primitives.ts` as the `teal` palette,
 * reached through the semantic `primary` tokens, so the mark and every button follow one placeholder
 * value until the brand kit lands (D-100).
 *
 * The Thai tagline is kept here because it is the brand's legal identity, the same in both locales
 * (D-001: the Latin name is kept in Thai copy); it is also exposed through `src/i18n` for screens.
 */
export const BRAND_NAME = "getproperty";
export const BRAND_TAGLINE = "บิลทำเอง เก็บเงินเอง ถูกกฎหมาย";
export const BRAND_COMPANY = "Collective Group (Thailand)";
export const BRAND_DOMAIN = "getproperty.co";
