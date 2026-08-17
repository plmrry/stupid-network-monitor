// @ts-check

import fs from "node:fs/promises";
import process from "node:process";
import url from "node:url";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { app, Menu, nativeImage, Tray } from "electron";
import { getTrayImage, MAX_BARS, SCALE_FACTOR } from "./get-tray-image.mjs";
import { speedTest } from "./speed-test.mjs";
import { sample } from "./sample.mjs";
import { monitor } from "./monitor.mjs";

/**
 * File where history is stored in the `userData` folder.
 */
const HISTORY_FILE_NAME = "history.json";

/**
 * Stable UUID for tray icon position persistence between relaunches
 */
const TRAY_GUID = "a1bcb3d4-e5f6-7890-abcd-ef1234567890";

/**
 * Store 1 minute of history.
 *
 * @constant {number}
 */
const MAX_HISTORY_LENGTH = 1 * 60;

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{ inputBytes: number, outputBytes: number, timestamp: string }} NetworkDatum
 */

/**
 * Create zero-value placeholders at one-second intervals.
 *
 * @returns {NetworkDatum[]}
 */
function createPlaceholderHistory() {
  const latestTimestamp = Date.now() - 1_000;

  return Array.from({ length: MAX_BARS }, (_, index) => ({
    inputBytes: 0,
    outputBytes: 0,
    timestamp: new Date(latestTimestamp - (MAX_BARS - index - 1) * 1_000).toISOString(),
  }));
}

// Should improve performance.
Menu.setApplicationMenu(null);

// Only run on macOS
if (process.platform !== "darwin") app.quit();

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
async function initializeRenderer() {
  const [wasmBinary, fontBuffer] = await Promise.all([
    fs.readFile(resvgWasmPath),
    fs.readFile(geistPixelSquareFontPath),
  ]);

  await initWasm(wasmBinary);
  geistPixelSquareFont = fontBuffer;
}

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

/**
 * @param {unknown} value
 * @returns {value is NetworkDatum}
 */
function isNetworkDatum(value) {
  if (!value || typeof value !== "object") return false;

  const datum = /** @type {Partial<NetworkDatum>} */ (value);

  return (
    typeof datum.inputBytes === "number" &&
    Number.isFinite(datum.inputBytes) &&
    typeof datum.outputBytes === "number" &&
    Number.isFinite(datum.outputBytes) &&
    typeof datum.timestamp === "string" &&
    Number.isFinite(Date.parse(datum.timestamp))
  );
}

/**
 * Attempt to read existing history from `userData` folder.
 *
 * @returns {Promise<NetworkDatum[] | undefined>}
 */
async function readHistory() {
  const userDataPath = app.getPath("userData");
  const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
  try {
    const parsed = await import(historyPath, { with: { type: "json" } }).then(
      (module) => module.default,
    );
    if (!parsed) return undefined;
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .filter(isNetworkDatum)
      .slice(-MAX_HISTORY_LENGTH)
      .map(({ inputBytes, outputBytes, timestamp }) => ({ inputBytes, outputBytes, timestamp }));
  } catch {
    return undefined;
  }
}

/**
 * Attempt to write history to the `userData` folder.
 *
 * @param {{ history: NetworkDatum[] }} param0
 * @returns {Promise<void>}
 */
async function writeHistory({ history }) {
  const userDataPath = app.getPath("userData");
  const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
  try {
    await fs.writeFile(historyPath, JSON.stringify(history), "utf-8");
  } catch {
    // Do nothing
  }
}

/**
 * Abort controller to kill child processes on app quit.
 */
const abortController = new AbortController();

/**
 * Start the network monitoring.
 */
async function startNetworkMonitoring() {
  monitor({ signal: abortController.signal });
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
   * See if we have existing history to load.
   */
  const storedHistory = await readHistory();
  const history = storedHistory?.length ? storedHistory : createPlaceholderHistory();

  /**
   * Create a context menu for the tray icon.
   */
  const contextMenu = Menu.buildFromTemplate([
    {
      click: async () => {
        history.length = 0;
        history.push(...createPlaceholderHistory());
        await writeHistory({ history });
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

  const onSample = async ({ inputBytes, outputBytes, timestamp }) => {
    /**
     * Push data into an array for charting history.
     * Limit to one minute of entries.
     */
    history.push({ inputBytes, outputBytes, timestamp });
    while (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }
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

  sample({
    onSample,
    signal: abortController.signal,
  });

  /**
   * Every `MAX_BARS` seconds:
   * - Write history to disk.
   * - Run a speed test.
   */
  setInterval(async () => {
    await writeHistory({ history });
    await speedTest();
  }, MAX_BARS * 1e3);

  /**
   * Run initial speed test.
   */
  void speedTest();
}

app.whenReady().then(async () => {
  await initializeRenderer();
  await startNetworkMonitoring();
});

// Don't quit when all windows are closed - keep running in menu bar.
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray.
});

// Kill the child process on app quit.
app.on("before-quit", () => {
  abortController.abort("App is quitting");
});
