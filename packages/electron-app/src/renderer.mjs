// @ts-check

import fs from "node:fs/promises";
import url from "node:url";
import { initWasm } from "@resvg/resvg-wasm";

const geistPixelSquareFontPath = url.fileURLToPath(
  new URL("./fonts/geist-pixel/GeistPixel-Square.woff2", import.meta.resolve("geist/font/pixel")),
);

const resvgWasmPath = url.fileURLToPath(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"));

/** @type {Uint8Array} */
let geistPixelSquareFont;

/**
 * Initialize the SVG renderer and load the package-owned font.
 *
 * @returns {Promise<void>}
 */
export async function initializeRenderer() {
  const [wasmBinary, fontBuffer] = await Promise.all([
    fs.readFile(resvgWasmPath),
    fs.readFile(geistPixelSquareFontPath),
  ]);

  await initWasm(wasmBinary);
  geistPixelSquareFont = fontBuffer;
}

export async function getFontBuffers() {
  return [geistPixelSquareFont];
}
