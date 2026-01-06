// @ts-check

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import * as d3 from "d3";
import { app, Menu, nativeImage, nativeTheme, Tray } from "electron";
import { speedTest } from "./speed-test.mjs";

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
const MAX_BARS = 20;
const TEXT_WIDTH = 5;
const CHART_WIDTH = 2;

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

/**
 * Alternative SVG renderer using resvg-js (Rust-based, high performance)
 * @param {string} svgString
 * @returns {Electron.NativeImage}
 */
function createImageFromSvg(svgString) {
  if (!svgString) return nativeImage.createEmpty();
  const resvg = new Resvg(svgString, {
    font: {
      loadSystemFonts: true,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const image = nativeImage.createFromBuffer(pngBuffer);
  return image;
}

/**
 * @param {{ width: number | string, height: number | string, children: string }} options
 * @returns {string}
 */
function svgWrapper({ width, height, children }) {
  return /* html */ `
<svg 
  width="${width}" 
  height="${height}" 
  viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg" 
  xmlns:xlink="http://www.w3.org/1999/xlink"
>
  ${children}
</svg>
`;
}

/**
 * @param {{ x1: number | string, y1: number | string, x2: number | string, y2: number | string, stroke: string, strokeWidth: number }} options
 * @returns {string}
 */
function lineSvg({ x1, y1, x2, y2, stroke, strokeWidth }) {
  return /* html */ `
<line 
  x1="${x1}" 
  y1="${y1}"
  x2="${x2}" 
  y2="${y2}" 
  shape-rendering="crispEdges"
  stroke="${stroke}" 
  stroke-width="${strokeWidth}" 
  opacity="0.5" 
/>
`;
}

/**
 * @param {{ x: number | string, y: number | string, children: string, color: string }} options
 * @returns {string}
 */
function textSvg({ x, y, children, color }) {
  return /* html */ `
<text 
  alignment-baseline="middle" 
  fill="${color}"
  font-size="9"
  text-anchor="end" 
  x="${x}" 
  y="${y}" 
>
  ${children}
</text>`;
}

/**
 * @param {{ history: NetworkDatum[], trayHeight?: number, color?: string }} options
 * @returns {Promise<Electron.NativeImage>}
 */
async function getTrayImage({ history, trayHeight: fullTrayHeight, color }) {
  const trayHeight = fullTrayHeight * 0.8;

  const data = history.slice(-MAX_BARS);

  const totalHeight = trayHeight ?? 30;
  const textWidth = trayHeight * TEXT_WIDTH;
  const chartWidth = trayHeight * CHART_WIDTH;
  const totalWidth = textWidth + chartWidth;

  const halfHeight = totalHeight * 0.5;

  /**
   * Get max values for scaling the chart.
   * Use more than what's displayed to prevent big jumps.
   * Make vague assumptions about internet speeds if no data yet.
   */
  const maxOutput = d3.max(history, (d) => d.outputBytes) || 100_000;
  const maxInput = d3.max(history, (d) => d.inputBytes) || 10_000_000;

  const averageOutput = Math.floor(d3.mean(history, (d) => d.outputBytes) || 0);
  const averageInput = Math.floor(d3.mean(history, (d) => d.inputBytes) || 0);

  const strokeWidth = (totalWidth / MAX_BARS) * 0.4;

  const xScale = d3
    .scalePoint(d3.range(0, MAX_BARS), [totalWidth, textWidth])
    .padding(0.8);

  const heightScaleInput = d3.scaleLinear([0, maxInput], [0, halfHeight]);
  const heightScaleOutput = d3.scaleLinear([0, maxOutput], [0, halfHeight]);

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

    const outputBar = lineSvg({
      stroke: color,
      strokeWidth,
      x1: x,
      x2: x,
      y1: outputY1,
      y2: outputY2,
    });

    const inputBar = lineSvg({
      stroke: color,
      strokeWidth,
      x1: x,
      x2: x,
      y1: inputY1,
      y2: inputY2,
    });

    bars.push(outputBar);
    bars.push(inputBar);
  }

  const MARGIN = totalWidth * 0.05;

  const textX = textWidth - MARGIN;

  // Convert bytes/sec to Mbps
  /**
   * @param {number} bytes
   * @returns {string}
   */
  const bytesToMbps = (bytes) => {
    const bits = bytes * 8;
    const mbps = bits / 1_000_000;
    return `${mbps.toFixed(1)} Mbps`;
  };

  const outAvgString = bytesToMbps(averageOutput);
  const inAvgString = bytesToMbps(averageInput);

  const outMaxString = bytesToMbps(maxOutput);
  const inMaxString = bytesToMbps(maxInput);

  const pad = 15;

  const outString = `${outAvgString.padStart(pad)} / ${outMaxString.padStart(pad)}`;
  const inString = `${inAvgString.padStart(pad)} / ${inMaxString.padStart(pad)}`;

  const children = [
    /* html */ `<rect x="0" y="0" width="100%" height="90%" fill="none" stroke="${color}" />`,
    /* html */ `<rect x="0" y="0" width="${textWidth}" height="100%" fill="none" stroke="${color}" />`,
    /* html */ `<rect x="${textWidth}" y="0" width="${chartWidth}" height="100%" fill="none" stroke="${color}" />`,
    bars.join("\n"),
    textSvg({
      children: outString,
      color,
      x: textX,
      y: "30%",
    }),
    textSvg({
      children: inString,
      color,
      x: textX,
      y: "70%",
    }),
  ].join("\n");

  const svgString = svgWrapper({
    children,
    height: totalHeight,
    width: totalWidth,
  });

  return createImageFromSvg(svgString);
}

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

  /**
   * Every 20 seconds: write history to disk
   */
  setInterval(async () => {
    writeHistory({ history });
    await speedTest();
  }, 20_000);

  const netstatCommand = `netstat -I en0 -b -w 1`;

  const child = spawn(netstatCommand, {
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

    try {
      const color = nativeTheme.shouldUseDarkColors ? "white" : "black";
      const image = await getTrayImage({
        color,
        history,
        trayHeight,
      });
      tray.setImage(image);
    } catch (error) {
      console.error("Error generating tray image:", error);
      app.quit();
    }
  });

  child.on("error", () => {
    app.exit(0);
  });

  await speedTest();
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
