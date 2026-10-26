// `npm run icons`: draws the app icons from the header's tractor pictogram, in the Mitti colours, with the
// Chromium that Playwright already installed. Nothing is downloaded; the PNGs in public/icons are committed.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsx compiles the pictogram with the classic JSX runtime, which looks for a global React.
(globalThis as { React?: unknown }).React = React;
const { Pictogram } = await import("../components/pictograms/pictogram");

const INDIGO = "#223585";
const MUSTARD = "#FBC02D";
const WHITE = "#FFFFFF";

const art = renderToStaticMarkup(React.createElement(Pictogram, { name: "tractor", accent: true }))
  .replace(/ class="fill-\[[^"]*\]"/, ` fill="${MUSTARD}"`)
  .replace('width="32" height="32"', 'width="100%" height="100%"')
  .replace('stroke="currentColor"', `stroke="${WHITE}"`);

// glyph: share of the icon the pictogram fills; radius: corner share (0 = full bleed, for maskable and Apple).
const ICONS = [
  { file: "icon-192.png", size: 192, glyph: 0.62, radius: 0.22 },
  { file: "icon-512.png", size: 512, glyph: 0.62, radius: 0.22 },
  // Maskable icons keep the picture inside the central 80 % "safe zone".
  { file: "icon-maskable-512.png", size: 512, glyph: 0.5, radius: 0 },
  { file: "apple-touch-icon.png", size: 180, glyph: 0.56, radius: 0 },
];

const html = (glyph: number, radius: number) => `<!doctype html><style>
html,body{margin:0;height:100%}
.box{height:100%;display:grid;place-items:center;background:${INDIGO};border-radius:${radius * 100}%}
svg{width:${glyph * 100}%;height:${glyph * 100}%}
</style><div class="box">${art}</div>`;

await mkdir("public/icons", { recursive: true });
const browser = await chromium.launch();
try {
  for (const { file, size, glyph, radius } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(html(glyph, radius));
    await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
