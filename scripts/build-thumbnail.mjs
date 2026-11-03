// Build the paperly product thumbnail.
// Design decided with the owner: logo + wordmark only, no tagline or claims, on
// the app's near-white background. Square master, plus a 1280x640 social crop.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const VENV = "/private/var/folders/th/lh2mrd393q74jqght00cywc80000gn/T/opencode/fontvenv/bin/python";

const raw = execFileSync(VENV, ["scripts/make-thumbnail.py"], { encoding: "utf8" }).trim();
const { letters, dot, advance, dotX, bounds } = JSON.parse(raw);
if (!letters || !dot) throw new Error("wordmark outlines missing — refusing to render a fallback font");

const GRADE = {
  ink: "#30382d",     // --ink / .brand color
  dot: "#df7855",     // --orange, the .brand-dot
  bg: "#fafbf9",      // --background
  border: "#e7e9e3",  // --border
};

const ICON = (await readFile("public/icon.svg", "utf8"))
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

// Wordmark is drawn at 1000 units/em with the baseline on y=0. `bounds` gives the
// real ink extents so we can centre on ink rather than on the em box.
const inkHeight = bounds.yMax - bounds.yMin;      // e.g. ascender to descender
const capTop = bounds.yMin;                        // negative (above baseline)

function render({ width, height, iconSize, wordSize, gap, framed, opticalRise = 0 }) {
  const s = wordSize / 1000;
  const wordWidth = bounds.xMax * s - bounds.xMin * s;

  // Centre the icon+wordmark group horizontally, on true ink widths.
  const totalW = iconSize + gap + wordWidth;
  const left = (width - totalW) / 2;

  // Vertical: centre the *ink* band (ascender to descender), not the cap band.
  // Centring the cap band leaves the descenders of p/y hanging low and the whole
  // lockup reading above centre. opticalRise nudges it for the same reason.
  const inkTop = bounds.yMin * s;
  const inkBottom = bounds.yMax * s;
  const inkBandH = inkBottom - inkTop;
  const inkTopY = (height - inkBandH) / 2 + opticalRise;

  const baseline = inkTopY - inkTop;
  const iconY = inkTopY + (inkBandH - iconSize) / 2;

  const lettersX = left + iconSize + gap - bounds.xMin * s;

  const frame = framed
    ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${GRADE.border}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${GRADE.bg}"/>
  ${frame}
  <g transform="translate(${left} ${iconY}) scale(${iconSize / 512})">${ICON}</g>
  <g transform="translate(${lettersX} ${baseline}) scale(${s})">
    <path d="${letters}" fill="${GRADE.ink}"/>
    <path d="${dot}" fill="${GRADE.dot}"/>
  </g>
</svg>`;
}

// Square master, 1024x1024.
const square = render({ width: 1024, height: 1024, iconSize: 236, wordSize: 168, gap: 46, framed: false });
await writeFile("docs/thumbnail-square.svg", square);

// Social crop, 1280x640. Hairline frame so the tile reads on any background.
const og = render({ width: 1280, height: 640, iconSize: 190, wordSize: 136, gap: 38, framed: true });
await writeFile("docs/thumbnail-og.svg", og);

const squarePng = await sharp(Buffer.from(square)).png().toBuffer();
const ogPng = await sharp(Buffer.from(og)).png().toBuffer();
await writeFile("docs/thumbnail-square.png", squarePng);
await writeFile("docs/og-image.png", ogPng);
await writeFile("public/og-image.png", ogPng); // served for social previews

for (const [name, buf] of [["thumbnail-square.png", squarePng], ["og-image.png", ogPng]]) {
  const meta = await sharp(buf).metadata();
  console.log(`${name}: ${meta.width}x${meta.height} (${buf.length} bytes)`);
}

// Legibility ladder: does the coral dot survive as the tile gets small?
console.log("\nadvance:", advance, "dotX:", dotX, "ink:", JSON.stringify(bounds));
for (const size of [256, 128, 64, 48]) {
  await writeFile(`/tmp/dot-${size}.png`, await sharp(squarePng).resize(size, size).png().toBuffer());
}
console.log("small renders: /tmp/dot-{256,128,64,48}.png");