/**
 * Regenerates the two committed brand binaries from source:
 *
 *   src/app/favicon.ico        — 16/32/48px, built from src/app/icon.svg
 *   src/app/opengraph-image.png — 1200x630 social card
 *
 * Run with `node scripts/brand-assets.mjs` after editing `icon.svg` or the
 * card copy below. Both outputs are committed, so this never runs in CI; it
 * exists so the binaries have a source and can be rebuilt rather than being
 * undocumented blobs nobody dares touch.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "src", "app");
const iconSvg = fs.readFileSync(path.join(APP, "icon.svg"));

// ── favicon.ico ─────────────────────────────────────────────────────────────
// Hand-rolled ICO container holding one PNG per size. PNG-in-ICO is understood
// by every browser in use and by Windows since Vista, and it avoids pulling in
// an encoder dependency for a 2KB file.
async function buildFavicon() {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(
    sizes.map((s) =>
      sharp(iconSvg, { density: 384 }).resize(s, s).png({ compressionLevel: 9 }).toBuffer(),
    ),
  );

  const dir = Buffer.alloc(6 + 16 * pngs.length);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // 1 = icon
  dir.writeUInt16LE(pngs.length, 4);

  let offset = dir.length;
  pngs.forEach((png, i) => {
    const o = 6 + 16 * i;
    dir.writeUInt8(sizes[i], o); // width
    dir.writeUInt8(sizes[i], o + 1); // height
    dir.writeUInt8(0, o + 2); // palette size (0 = truecolour)
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });

  const out = path.join(APP, "favicon.ico");
  fs.writeFileSync(out, Buffer.concat([dir, ...pngs]));
  return `${path.relative(ROOT, out)} (${sizes.join("/")}px)`;
}

// ── opengraph-image.png ─────────────────────────────────────────────────────
// Copy mirrors the homepage hero. A static PNG rather than a runtime
// `ImageResponse` because the card never changes per request, and a social
// crawler should never wait on us to render one.
const FONT = "Space Grotesk, Segoe UI, Inter, Arial, sans-serif";

const cardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="22%" cy="8%" r="78%">
      <stop offset="0%" stop-color="#2B50F5" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#0C1326" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0C1326"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect y="624" width="1200" height="6" fill="#2B50F5"/>

  <text x="176" y="118" font-family="${FONT}" font-size="38" font-weight="700"
        letter-spacing="-0.6" fill="#ffffff">GYAANVERSE<tspan fill="#2B50F5">.</tspan></text>

  <text x="80" y="258" font-family="${FONT}" font-size="21" font-weight="600"
        letter-spacing="2.4" fill="#4a6cf7">THE ALL-IN-ONE EDTECH OS</text>

  <text x="80" y="356" font-family="${FONT}" font-size="62" font-weight="700"
        letter-spacing="-1.8" fill="#ffffff">Run your coaching\u2019s entire</text>
  <text x="80" y="432" font-family="${FONT}" font-size="62" font-weight="700"
        letter-spacing="-1.8" fill="#ffffff">test program. <tspan fill="#4a6cf7">Online.</tspan></text>

  <text x="80" y="502" font-family="${FONT}" font-size="25" font-weight="400"
        fill="#8b97ad">Host batches, automate fees, and analyze performance with AI.</text>

  <text x="80" y="576" font-family="${FONT}" font-size="22" font-weight="500"
        letter-spacing="0.4" fill="#5A6B85">gyaanverse.com</text>
</svg>`;

async function buildOgImage() {
  // The mark is composited rather than re-drawn so `icon.svg` stays the single
  // source of the logo geometry.
  const mark = await sharp(iconSvg, { density: 768 }).resize(76, 76).png().toBuffer();
  const out = path.join(APP, "opengraph-image.png");
  await sharp(Buffer.from(cardSvg))
    .composite([{ input: mark, top: 60, left: 80 }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  return `${path.relative(ROOT, out)} (1200x630)`;
}

const results = await Promise.all([buildFavicon(), buildOgImage()]);
for (const r of results) console.log("wrote", r);
