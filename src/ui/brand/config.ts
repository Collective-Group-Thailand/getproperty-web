/**
 * Brand values are configuration, not copy scattered through the app (design-system.md §2, D-001,
 * docs/ui/brand.md). The logo is the founder's artwork (docs/brand → `pnpm brand` → `geometry.ts`); its
 * colours are `BRAND` in `src/ui/tokens/primitives.ts`, reached through the semantic `primary` and
 * `logo-*` tokens, so the logo and every button follow one source.
 *
 * The Thai tagline is kept here because it is the brand's legal identity, the same in both locales
 * (D-001: the Latin name is kept in Thai copy); it is also exposed through `src/i18n` for screens.
 */
export const BRAND_NAME = "getproperty";
export const BRAND_TAGLINE = "บิลทำเอง เก็บเงินเอง ถูกกฎหมาย";
export const BRAND_COMPANY = "Collective Group (Thailand)";
export const BRAND_DOMAIN = "getproperty.co";
