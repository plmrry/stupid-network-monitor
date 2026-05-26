// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Resvg } from "@resvg/resvg-js";
import { app, Menu, nativeImage, Tray } from "electron";
import { getTrayImage, MAX_BARS, SCALE_FACTOR } from "./get-tray-image.mjs";
import { speedTest } from "./speed-test.mjs";

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{ inputBytes: number, outputBytes: number }} NetworkDatum
 */

// Should improve performance.
Menu.setApplicationMenu(null);

// Only run on macOS
if (process.platform !== "darwin") app.quit();

// File where history is stored
const HISTORY_FILE_NAME = "history.json";

// Stable UUID for tray icon position persistence between relaunches
const TRAY_GUID = "a1bcb3d4-e5f6-7890-abcd-ef1234567890";

/**
 * Store five minutes of history, at 1 second intervals.
 *
 * @constant {number}
 */
const MAX_HISTORY_LENGTH = 5 * 60;

/**
 * History is five minutes of history at 1 second intervals.
 *
 * Starts filled with empty data.
 *
 * @type {NetworkDatum[]}
 */
const emptyHistory = Array.from({ length: MAX_HISTORY_LENGTH }, () => ({
  inputBytes: 0,
  outputBytes: 0,
}));

/**
 * Attempt to read existing history from `userData` folder.
 *
 * @returns {Promise<NetworkDatum[] | undefined>}
 */
async function readHistory() {
  const userDataPath = app.getPath("userData");
  const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
  try {
    const fileContents = await fs.readFile(historyPath, "utf-8");
    const parsed = JSON.parse(fileContents);
    if (!parsed) return undefined;
    if (!Array.isArray(parsed)) return undefined;
    /** @type {NetworkDatum[]} */
    return parsed;
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
 * Start the network monitoring
 */
async function startNetworkMonitoring() {
  /**
   * Hide the app from the dock
   */
  if (app.dock) {
    app.dock.hide();
  }

  /**
   * Initialize the `Tray` a.k.a. the menu bar icon.
   */
  const emptyImage = nativeImage.createEmpty();
  const tray = new Tray(emptyImage, TRAY_GUID);

  /**
   * Ignore double-click events on the tray icon
   */
  tray.setIgnoreDoubleClickEvents(true);

  /**
   * Create a context menu for the tray icon
   */
  const contextMenu = Menu.buildFromTemplate([
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
   * Show context menu on left-click as well
   */
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    tray.popUpContextMenu(contextMenu);
  });

  /**
   * See if we have existing history to load.
   */
  const history = (await readHistory()) ?? emptyHistory;

  const netstatCommand = `netstat -I en0 -b -w 1`;

  const child = childProcess.spawn(netstatCommand, {
    shell: true,
    signal: abortController.signal,
  });

  /**
   * Output from `netstat` looks like this:
   *
   * ```bash
   *            input        (Total)           output
   *   packets  errs      bytes    packets  errs      bytes colls
   *        76     0      58112         58     0      12677     0
   *        48     0      17278         50     0      11179     0
   * ```
   */
  child.stdout.on("data", async (stdout) => {
    /**
     * Ignore the initial header lines
     */
    const split = stdout.toString().split(/\s+/).filter(Boolean);
    if (split.length !== 7) return;

    /**
     * Parse the output line into numbers
     */
    const parsed = split.map((s) => parseInt(s.trim(), 10));
    const [
      _packets,
      _inputErrs,
      inputBytes,
      _outputPackets,
      _outputErrs,
      outputBytes,
      _colls,
    ] = parsed;
    const bounds = tray.getBounds();
    const trayHeight = bounds.height;

    console.log(`Render: ${new Date().toLocaleTimeString()}`);

    /**
     * Push data into an array for charting history.
     * Limit to MAX_BARS entries.
     */
    history.push({ inputBytes, outputBytes });
    while (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }

    try {
      const svgString = getTrayImage({
        history,
        trayHeight,
      });
      const fontPath = app.isPackaged
        ? path.join(process.resourcesPath, "assets/GeistPixel-Grid.ttf")
        : path.join(import.meta.dirname, "assets/GeistPixel-Grid.ttf");

      const resvg = new Resvg(svgString, {
        dpi: 300,
        font: {
          defaultFontFamily: "Geist Pixel Grid",
          defaultFontSize: 30,
          fontFiles: [fontPath],
          fontDirs: [path.dirname(fontPath)],
          loadSystemFonts: true,
        },
        shapeRendering: 2,
        textRendering: 2,
      });
      const pngBuffer = resvg.render().asPng();
      const image = nativeImage.createFromBuffer(pngBuffer, {
        scaleFactor: SCALE_FACTOR,
      });
      image.setTemplateImage(true);
      tray.setImage(image);
    } catch (error) {
      console.error("Error generating tray image:", error);
      app.quit();
    }
  });

  child.on("error", () => {
    app.exit(0);
  });

  /**
   * Every `MAX_BARS` seconds:
   * - Write history to disk
   * - Run a speed test
   */
  setInterval(async () => {
    writeHistory({ history });
    await speedTest();
  }, MAX_BARS * 1e3);

  // Run speed test in background, don't block startup
  speedTest();
}

app.whenReady().then(async () => {
  console.log("App is ready");
  await startNetworkMonitoring();
});

// Don't quit when all windows are closed - keep running in menu bar
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray
});

// Kill the child process on app quit
app.on("before-quit", () => {
  abortController.abort("App is quitting");
});
