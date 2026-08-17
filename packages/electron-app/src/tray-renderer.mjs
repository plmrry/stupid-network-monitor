// @ts-check

import fs from "node:fs/promises";
import url from "node:url";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { app, Menu, nativeImage, Tray } from "electron";
import { getTrayImage, SCALE_FACTOR } from "./get-tray-image.mjs";
import { HistoryManager } from "./history-manager.mjs";

/**
 * Stable UUID for tray icon position persistence between relaunches
 */
const TRAY_GUID = "a1bcb3d4-e5f6-7890-abcd-ef1234567890";

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{ inputBytes: number, outputBytes: number, timestamp: string }} NetworkDatum
 */

/** @type {Uint8Array} */
let geistPixelSquareFont;

/**
 * Render a tray SVG using the package-owned Geist Pixel Square font.
 *
 * @param {string} svgString
 * @returns {Buffer}
 */
function renderTrayImage(svgString) {
  const resvg = new Resvg(svgString, {
    dpi: 300,
    font: {
      defaultFontFamily: "Geist Pixel Square",
      defaultFontSize: 30,
      fontBuffers: [geistPixelSquareFont],
    },
    shapeRendering: 2,
    textRendering: 2,
  });

  try {
    const renderedImage = resvg.render();

    try {
      return Buffer.from(renderedImage.asPng());
    } finally {
      renderedImage.free();
    }
  } finally {
    resvg.free();
  }
}

export const TrayRenderer = {
  async initialize() {
    const geistPixelSquareFontPath = url.fileURLToPath(
      new URL(
        "./fonts/geist-pixel/GeistPixel-Square.woff2",
        import.meta.resolve("geist/font/pixel"),
      ),
    );
    const resvgWasmPath = url.fileURLToPath(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"));
    const [wasmBinary, fontBuffer] = await Promise.all([
      fs.readFile(resvgWasmPath),
      fs.readFile(geistPixelSquareFontPath),
    ]);
    await initWasm(wasmBinary);
    geistPixelSquareFont = fontBuffer;
  },
  async start({ signal }) {
    /**
     * Initialize the `Tray` a.k.a. the menu bar icon.
     */
    const initialImage = nativeImage.createMenuSymbol("chart.bar");
    const tray = new Tray(initialImage, TRAY_GUID);

    /**
     * Ignore double-click events on the tray icon.
     */
    tray.setIgnoreDoubleClickEvents(true);

    /**
     * Create a context menu for the tray icon.
     */
    const contextMenu = Menu.buildFromTemplate([
      {
        click: async () => {
        },
        label: "Clear History",
      },
      { type: "separator" },
      {
        click: () => {
          app.quit();
        },
        label: "Quit",
      },
      { type: "separator" },
      {
        enabled: false,
        label: `v${app.getVersion()}`,
      },
    ]);

    /**
     * Show context menu on left-click as well.
     */
    tray.setContextMenu(contextMenu);
    tray.on("click", () => {
      tray.popUpContextMenu(contextMenu);
    });

    const drawTheTray = async () => {
      const history = await HistoryManager.read();
      /**
       * Get the Tray height.
       */
      const bounds = tray.getBounds();
      const trayHeight = bounds.height;
      /**
       * Generate a new Tray SVG string.
       */
      const svgString = getTrayImage({
        history,
        trayHeight,
      });
      const pngBuffer = renderTrayImage(svgString);
      const image = nativeImage.createFromBuffer(pngBuffer, {
        scaleFactor: SCALE_FACTOR,
      });
      image.setTemplateImage(true);
      tray.setImage(image);
    };

    const interval = setInterval(drawTheTray, 1_000);

    signal.addEventListener("abort", () => {
      clearInterval(interval);
    });
  },
};
