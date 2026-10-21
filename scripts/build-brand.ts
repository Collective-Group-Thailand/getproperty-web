/**
 * The brand pipeline: the founder's logo files (docs/brand, traced from the founder's PNG and approved
 * 2026-10-21) → everything the app serves or draws.
 *
 *   pnpm brand          write every output below (the Open Graph image needs Chromium: PW_CHROMIUM_EXECUTABLE)
 *   pnpm brand:check    fail if a generated or copied file is stale, missing, or the wrong size (no browser needed)
 *
 * Outputs (all committed):
 *   src/ui/brand/geometry.ts           the logo's path data and colours, for the React components (generated)
 *   public/brand/getproperty-*.svg     the founder's SVGs, byte for byte (logo, white logo, mark, white mark, app icon)
 *   public/brand/favicon.svg           the mark; turns white in a dark browser UI (the founder's white version)
 *   public/brand/favicon-{16,32,48}.png, public/favicon.ico   raster fallbacks — the app icon (white house on blue)
 *   public/brand/apple-touch-icon.png, public/apple-touch-icon.png   180 × 180, full bleed (iOS rounds it)
 *   public/brand/getproperty-logo{,-white}.png   880 px wide, for e-mail and JSON-LD (clients that drop SVG)
 *   public/brand/og-image.png          1200 × 630 Open Graph card for the owner host's public pages
 *   public/pwa/staff-{192,512}.png, public/pwa/staff-maskable-512.png   the staff PWA's manifest icons
 *
 * The logo is never re-drawn or re-coloured here: every raster is rendered from the founder's paths and
 * colours; the gradient of the chimney is kept exactly.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "docs/brand");
const PUBLIC = join(ROOT, "public");
const GEOMETRY = join(ROOT, "src/ui/brand/geometry.ts");

const COPIED = [
  "getproperty-logo.svg",
  "getproperty-logo-white.svg",
  "getproperty-mark.svg",
  "getproperty-mark-white.svg",
  "getproperty-app-icon.svg",
] as const;

// ---------------------------------------------------------------------------------------------------
// Reading the founder's files
// ---------------------------------------------------------------------------------------------------

interface Geometry {
  wordmarkViewBox: string;
  markViewBox: string;
  inkPath: string;
  housePath: string;
  chimneyPath: string;
  gradient: { x1: string; y1: string; x2: string; y2: string };
  colours: { navy: string; blue: string; sky: string; azure: string };
  appIcon: { viewBox: string; x: string; y: string; size: string; rx: string; fill: string; chimney: [string, string] };
}

const read = (file: string) => readFileSync(join(SOURCE, file), "utf8");
const attr = (tag: string, name: string) => {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  if (!match) throw new Error(`missing ${name} in ${tag.slice(0, 80)}`);
  return match[1]!;
};
const tags = (svg: string, name: string) => svg.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];

export function readGeometry(): Geometry {
  const logo = read("getproperty-logo.svg");
  const mark = read("getproperty-mark.svg");
  const icon = read("getproperty-app-icon.svg");
  const paths = tags(logo, "path");
  if (paths.length !== 3) throw new Error(`getproperty-logo.svg: expected 3 paths, found ${paths.length}`);
  const [ink, house, chimney] = paths as [string, string, string];
  if (attr(chimney, "fill") !== "url(#gp-chimney)") throw new Error("the third path of the logo is not the chimney");
  const gradient = tags(logo, "linearGradient")[0]!;
  const stops = tags(logo, "stop").map((stop) => attr(stop, "stop-color"));
  const geometry: Geometry = {
    wordmarkViewBox: attr(tags(logo, "svg")[0]!, "viewBox"),
    markViewBox: attr(tags(mark, "svg")[0]!, "viewBox"),
    inkPath: attr(ink, "d"),
    housePath: attr(house, "d"),
    chimneyPath: attr(chimney, "d"),
    gradient: {
      x1: attr(gradient, "x1"),
      y1: attr(gradient, "y1"),
      x2: attr(gradient, "x2"),
      y2: attr(gradient, "y2"),
    },
    colours: { navy: attr(ink, "fill"), blue: attr(house, "fill"), sky: stops[0]!, azure: stops[1]! },
    appIcon: (() => {
      const rect = tags(icon, "rect")[0]!;
      const iconStops = tags(icon, "stop").map((stop) => attr(stop, "stop-color"));
      return {
        viewBox: attr(tags(icon, "svg")[0]!, "viewBox"),
        x: attr(rect, "x"),
        y: attr(rect, "y"),
        size: attr(rect, "width"),
        rx: attr(rect, "rx"),
        fill: attr(rect, "fill"),
        chimney: [iconStops[0]!, iconStops[1]!] as [string, string],
      };
    })(),
  };
  // The mark, the app icon and the white versions must be the same drawing as the logo.
  for (const file of ["getproperty-mark.svg", "getproperty-mark-white.svg", "getproperty-app-icon.svg"]) {
    const d = tags(read(file), "path").map((p) => attr(p, "d"));
    if (d[0] !== geometry.housePath || d[1] !== geometry.chimneyPath)
      throw new Error(`${file}: house differs from the logo`);
  }
  const white = tags(read("getproperty-logo-white.svg"), "path").map((p) => attr(p, "d"));
  if (white.join() !== [geometry.inkPath, geometry.housePath, geometry.chimneyPath].join()) {
    throw new Error("getproperty-logo-white.svg differs from the logo");
  }
  return geometry;
}

// ---------------------------------------------------------------------------------------------------
// Generated sources
// ---------------------------------------------------------------------------------------------------

/** A number as Prettier prints it (`22.50` → `22.5`), so the generated module is already formatted. */
const num = (value: string) => String(Number(value));

export function geometryModule(g: Geometry): string {
  return `// Generated by scripts/build-brand.ts from docs/brand/*.svg (the founder's logo) — do not edit; run \`pnpm brand\`.

/** The full logo — "getproper" lettering, the house "ty" and its chimney. */
export const WORDMARK_VIEWBOX = "${g.wordmarkViewBox}";
/** The house "ty" and chimney on their own (same coordinates as in the logo). */
export const MARK_VIEWBOX = "${g.markViewBox}";

export const INK_PATH =
  "${g.inkPath}";
export const HOUSE_PATH =
  "${g.housePath}";
export const CHIMNEY_PATH = "${g.chimneyPath}";

/** The chimney's vertical gradient (user space), top stop → bottom stop. Part of the logo — keep it. */
export const CHIMNEY_GRADIENT = { x1: ${num(g.gradient.x1)}, y1: ${num(g.gradient.y1)}, x2: ${num(g.gradient.x2)}, y2: ${num(g.gradient.y2)} } as const;

/** The founder's colours. The app reads them through the \`logo-*\` tokens; rasters and e-mail use these. */
export const LOGO_COLOURS = {
  navy: "${g.colours.navy}",
  blue: "${g.colours.blue}",
  sky: "${g.colours.sky}",
  azure: "${g.colours.azure}",
} as const;

/** The app icon: a white house on a rounded square of the house blue. */
export const APP_ICON = {
  viewBox: "${g.appIcon.viewBox}",
  rect: { x: ${num(g.appIcon.x)}, y: ${num(g.appIcon.y)}, size: ${num(g.appIcon.size)}, rx: ${num(g.appIcon.rx)} },
  fill: "${g.appIcon.fill}",
  chimney: ["${g.appIcon.chimney[0]}", "${g.appIcon.chimney[1]}"],
} as const;
`;
}

const gradientDef = (g: Geometry, id: string, from: string, to: string) =>
  `<linearGradient id="${id}" x1="${g.gradient.x1}" y1="${g.gradient.y1}" x2="${g.gradient.x2}" y2="${g.gradient.y2}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;

/** The browser-tab icon: the mark, switching to the founder's white version when the browser UI is dark. */
export function faviconSvg(g: Geometry): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g.markViewBox}">` +
    `<style>.h{fill:${g.colours.blue}}.t{stop-color:${g.colours.sky}}.b{stop-color:${g.colours.azure}}` +
    `@media (prefers-color-scheme:dark){.h{fill:#FFFFFF}.t,.b{stop-color:#FFFFFF}}</style>` +
    `<defs><linearGradient id="c" x1="${g.gradient.x1}" y1="${g.gradient.y1}" x2="${g.gradient.x2}" y2="${g.gradient.y2}" gradientUnits="userSpaceOnUse"><stop offset="0" class="t"/><stop offset="1" class="b"/></linearGradient></defs>` +
    `<path class="h" fill-rule="evenodd" d="${g.housePath}"/><path fill="url(#c)" fill-rule="evenodd" d="${g.chimneyPath}"/></svg>\n`
  );
}

/** The house in white on the brand blue, the mark scaled to `scale` of a square; `rounded` keeps the founder's corner. */
function iconSvg(g: Geometry, { scale, rounded }: { scale: number; rounded: boolean }): string {
  const [mx, my, mw] = g.markViewBox.split(" ").map(Number) as [number, number, number];
  const side = mw / scale;
  const x = mx - (side - mw) / 2;
  const y = my - (side - mw) / 2;
  const rx = rounded ? (Number(g.appIcon.rx) / Number(g.appIcon.size)) * side : 0;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${side} ${side}"><defs>${gradientDef(g, "c", ...g.appIcon.chimney)}</defs>` +
    `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${rx}" fill="${g.appIcon.fill}"/>` +
    `<path fill="#FFFFFF" fill-rule="evenodd" d="${g.housePath}"/><path fill="url(#c)" fill-rule="evenodd" d="${g.chimneyPath}"/></svg>`
  );
}

// ---------------------------------------------------------------------------------------------------
// Rasters
// ---------------------------------------------------------------------------------------------------

/** The founder's app icon: mark at 74 % of a rounded square. */
const APP_ICON_SCALE = (g: Geometry) => Number(g.markViewBox.split(" ")[2]) / Number(g.appIcon.size);
/** Maskable icons keep everything inside the 80 % safe circle; the house's corners fit at 62 %. */
const MASKABLE_SCALE = 0.62;

interface Raster {
  file: string;
  width: number;
  height: number;
}

export const RASTERS: Raster[] = [
  { file: "public/brand/favicon-16.png", width: 16, height: 16 },
  { file: "public/brand/favicon-32.png", width: 32, height: 32 },
  { file: "public/brand/favicon-48.png", width: 48, height: 48 },
  { file: "public/brand/apple-touch-icon.png", width: 180, height: 180 },
  { file: "public/apple-touch-icon.png", width: 180, height: 180 },
  { file: "public/brand/getproperty-logo.png", width: 880, height: 188 },
  { file: "public/brand/getproperty-logo-white.png", width: 880, height: 188 },
  { file: "public/brand/og-image.png", width: 1200, height: 630 },
  { file: "public/pwa/staff-192.png", width: 192, height: 192 },
  { file: "public/pwa/staff-512.png", width: 512, height: 512 },
  { file: "public/pwa/staff-maskable-512.png", width: 512, height: 512 },
];

const png = (svg: string | Buffer, width: number, height = width) =>
  sharp(Buffer.from(svg), { density: 1200 })
    .resize(width, height, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();

/** An ICO holding PNG images (Windows Vista+ and every current browser read PNG-in-ICO). */
export function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

function fontFace(family: string, file: string, range: string): string {
  const data = readFileSync(join(ROOT, "src/ui/fonts/files", file)).toString("base64");
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:100 900;unicode-range:${range}}`;
}

/**
 * The Open Graph card: the logo on white, the Thai tagline in the display face (never the brand name — the
 * logo carries its own lettering), a sky → blue rule taken from the chimney.
 */
async function ogImage(logoSvg: string, tagline: string, colours: Geometry["colours"]): Promise<Buffer> {
  const { chromium } = await import("@playwright/test");
  const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    const fonts =
      fontFace("Display", "anuphan-latin.woff2", "U+0000-00FF") +
      fontFace("Display", "anuphan-thai.woff2", "U+0E00-0E7F");
    await page.setContent(
      `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>${fonts}
      *{box-sizing:border-box;margin:0}
      body{width:1200px;height:630px;background:#FFFFFF;font-family:Display,sans-serif;display:flex;flex-direction:column;
        justify-content:center;padding:0 120px;position:relative;overflow:hidden}
      .logo{width:640px;height:auto;display:block}
      p{margin-top:44px;font-size:46px;font-weight:600;color:${colours.navy};letter-spacing:-0.01em}
      .rule{position:absolute;left:0;right:0;bottom:0;height:18px;background:linear-gradient(90deg,${colours.sky},${colours.azure} 55%,${colours.blue})}
      </style></head><body>
      <img class="logo" alt="" src="data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}">
      <p>${tagline}</p><div class="rule"></div></body></html>`,
    );
    await page.evaluate(() => document.fonts.ready);
    return await page.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------------

async function write(): Promise<void> {
  const g = readGeometry();
  writeFileSync(GEOMETRY, geometryModule(g));
  mkdirSync(join(PUBLIC, "brand"), { recursive: true });
  mkdirSync(join(PUBLIC, "pwa"), { recursive: true });
  for (const file of COPIED) copyFileSync(join(SOURCE, file), join(PUBLIC, "brand", file));
  writeFileSync(join(PUBLIC, "brand/favicon.svg"), faviconSvg(g));

  const out = async (file: string, data: Buffer) => {
    writeFileSync(join(ROOT, file), data);
    console.info(`wrote ${file}`);
  };
  const appIcon = iconSvg(g, { scale: APP_ICON_SCALE(g), rounded: true });
  const fullBleed = iconSvg(g, { scale: APP_ICON_SCALE(g), rounded: false });
  const maskable = iconSvg(g, { scale: MASKABLE_SCALE, rounded: false });

  const favicons = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(appIcon, size) })));
  for (const { size, data } of favicons) await out(`public/brand/favicon-${size}.png`, data);
  await out("public/favicon.ico", ico(favicons));
  const apple = await png(fullBleed, 180);
  await out("public/brand/apple-touch-icon.png", apple);
  await out("public/apple-touch-icon.png", apple);
  await out("public/brand/getproperty-logo.png", await png(read("getproperty-logo.svg"), 880, 188));
  await out("public/brand/getproperty-logo-white.png", await png(read("getproperty-logo-white.svg"), 880, 188));
  await out("public/pwa/staff-192.png", await png(appIcon, 192));
  await out("public/pwa/staff-512.png", await png(appIcon, 512));
  await out("public/pwa/staff-maskable-512.png", await png(maskable, 512));

  const { BRAND_TAGLINE } = await import("../src/ui/brand/config");
  await out("public/brand/og-image.png", await ogImage(read("getproperty-logo.svg"), BRAND_TAGLINE, g.colours));
}

async function check(): Promise<void> {
  const problems: string[] = [];
  const g = readGeometry();
  if (!existsSync(GEOMETRY) || readFileSync(GEOMETRY, "utf8") !== geometryModule(g)) {
    problems.push("src/ui/brand/geometry.ts is stale or hand-edited");
  }
  for (const file of COPIED) {
    const copy = join(PUBLIC, "brand", file);
    if (!existsSync(copy) || !readFileSync(copy).equals(readFileSync(join(SOURCE, file)))) {
      problems.push(`public/brand/${file} differs from docs/brand/${file}`);
    }
  }
  const favicon = join(PUBLIC, "brand/favicon.svg");
  if (!existsSync(favicon) || readFileSync(favicon, "utf8") !== faviconSvg(g))
    problems.push("public/brand/favicon.svg is stale");
  for (const raster of RASTERS) {
    const path = join(ROOT, raster.file);
    if (!existsSync(path)) {
      problems.push(`${raster.file} is missing`);
      continue;
    }
    const meta = await sharp(path).metadata();
    if (meta.width !== raster.width || meta.height !== raster.height) {
      problems.push(`${raster.file} is ${meta.width}×${meta.height}, expected ${raster.width}×${raster.height}`);
    }
  }
  const icoFile = join(PUBLIC, "favicon.ico");
  if (!existsSync(icoFile) || readFileSync(icoFile).readUInt16LE(4) !== 3)
    problems.push("public/favicon.ico is missing or not 16/32/48");
  if (problems.length) {
    console.error(`${problems.join("\n")}\nrun pnpm brand`);
    process.exit(1);
  }
  console.info("brand assets are up to date");
}

if (process.argv[1]?.endsWith("build-brand.ts")) {
  void (process.argv.includes("--check") ? check() : write()).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
