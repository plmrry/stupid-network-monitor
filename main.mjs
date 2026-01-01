// @ts-check

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import * as d3 from "d3";
import { app, Menu, nativeImage, Tray } from "electron";
import sharp from "sharp";

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{ inputBytes: number, outputBytes: number }} NetworkDatum
 */

// Only run on macOS
if (process.platform !== "darwin") {
  console.error("This application only runs on macOS");
  app.quit();
}

// Maximum number of bars to show in the chart
const MAX_BARS = 10;

// File where history is stored
const HISTORY_FILE_NAME = "history.json";

// Stable UUID for tray icon position persistence between relaunches
const TRAY_GUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

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

async function createImageFromSvg(svgString = "<svg></svg>") {
  const svgBuffer = Buffer.from(svgString);
  const pngBuffer = await sharp(svgBuffer).png().toBuffer();
  const image = nativeImage.createFromBuffer(pngBuffer);
  return image;
}

function barSvg({ x1, y1, x2, y2, stroke, strokeWidth }) {
  return /* html */ `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" />
`;
}

/**
 * @param {{ history: NetworkDatum[], trayHeight?: number }} param0
 * @returns {Promise<Electron.NativeImage>}
 */
async function getTrayImage({ history, trayHeight }) {
  const averageInput = Math.floor(d3.mean(history, (d) => d.inputBytes) || 0);
  const averageOutput = Math.floor(d3.mean(history, (d) => d.outputBytes) || 0);

  const data = history.slice(-MAX_BARS);

  /**
   * Get max values for scaling the chart.
   * Use more than what's displayed to prevent big jumps.
   * Make vague assumptions about internet speeds if no data yet.
   */
  const maxData = history.slice(-MAX_BARS * 3);
  const maxInput = d3.max(maxData, (d) => d.inputBytes) || 10_000_000;
  const maxOutput = d3.max(maxData, (d) => d.outputBytes) || 100_000;

  const totalHeight = trayHeight ?? 30;
  const totalWidth = totalHeight;
  const halfHeight = totalHeight * 0.5;

  const strokeWidth = totalWidth / MAX_BARS;

  const xScale = d3.scalePoint(d3.range(0, MAX_BARS), [totalWidth, 0]);

  const heightScaleInput = d3.scaleLinear([0, maxInput], [0, halfHeight]);
  const heightScaleOutput = d3.scaleLinear([0, maxOutput], [0, halfHeight]);

  const latest = data.at(-1);

  const latestInputBytes = latest?.inputBytes ?? 0;
  const latestOutputBytes = latest?.outputBytes ?? 0;

  /** @type {string[]} */
  const bars = [];

  for (const [index, datum] of data.entries()) {
    const x = xScale(index);
    const { inputBytes, outputBytes } = datum;

    const outputHeight = heightScaleOutput(outputBytes);
    const inputHeight = heightScaleInput(inputBytes);

    /**
     * Output is on top, pointing upwards.
     * Input is on bottom, pointing downwards.
     */

    const outputY1 = halfHeight;
    const outputY2 = outputY1 - outputHeight;

    const inputY1 = halfHeight;
    const inputY2 = halfHeight + inputHeight;

    const outputBar = barSvg({
      stroke: "red",
      strokeWidth,
      x1: x,
      x2: x,
      y1: outputY1,
      y2: outputY2,
    });

    const inputBar = barSvg({
      stroke: "blue",
      strokeWidth,
      x1: x,
      x2: x,
      y1: inputY1,
      y2: inputY2,
    });

    bars.push(outputBar);
    bars.push(inputBar);
  }

  const svgString = /* html */ `
<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
	${bars.join("\n")}
  <text stroke="black">hahah</text>
</svg>
`;

  return createImageFromSvg(svgString);
}

app.whenReady().then(async () => {
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
  ]);
  tray.setContextMenu(contextMenu);

  /**
   * See if we have existing history to load.
   */
  const history = (await readHistory()) ?? emptyHistory;

  /**
   * Write history to disk every five seconds.
   */
  setInterval(() => {
    writeHistory({ history });
  }, 5_000);

  const child = spawn(`netstat -i -b -w 1`, {
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

    /**
     * Push data into an array for charting history.
     * Limit to MAX_BARS entries.
     */
    history.push({ inputBytes, outputBytes });
    while (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }

    const image = await getTrayImage({
      history,
      trayHeight,
    });
    tray.setImage(image);
  });

  child.on("error", (error) => {
    // Do nothing
  });
});

// Don't quit when all windows are closed - keep running in menu bar
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray
});

// Kill the child process on app quit
app.on("before-quit", () => {
  abortController.abort("App is quitting");
});
