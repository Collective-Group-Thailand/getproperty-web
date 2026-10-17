/**
 * Writes the staff PWA's manifest icons (public/pwa/*.png) from src/app/icon.svg — the brand mark,
 * not a third-party asset. Run after the mark changes; the PNGs are committed (`--check` fails when
 * they are missing).
 *
 *   pnpm exec tsx scripts/build-pwa-icons.ts
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "src/app/icon.svg");
const OUT = resolve(ROOT, "public/pwa");
const ICONS = [
  { file: "staff-192.png", size: 192, padding: 0 },
  { file: "staff-512.png", size: 512, padding: 0 },
  // Maskable: the mark inside the 80 % safe zone on the brand colour.
  { file: "staff-maskable-512.png", size: 512, padding: 52 },
];

async function main() {
  if (process.argv.includes("--check")) {
    const missing = ICONS.filter((icon) => !existsSync(resolve(OUT, icon.file)));
    if (missing.length) {
      console.error(`missing PWA icons: ${missing.map((m) => m.file).join(", ")}`);
      process.exit(1);
    }
    return;
  }
  mkdirSync(OUT, { recursive: true });
  const svg = readFileSync(SOURCE);
  for (const icon of ICONS) {
    const inner = icon.size - icon.padding * 2;
    const mark = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: icon.size, height: icon.size, channels: 4, background: "#1f7a66" } })
      .composite([{ input: mark, top: icon.padding, left: icon.padding }])
      .png()
      .toFile(resolve(OUT, icon.file));
    console.info(`wrote public/pwa/${icon.file}`);
  }
}

void main();
