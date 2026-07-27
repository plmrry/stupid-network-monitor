// @ts-check

import childProcess from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  app,
  BaseWindow,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  Tray,
  WebContentsView,
} from "electron";
import { Resvg } from "@resvg/resvg-js";
import { getTrayImage, MAX_BARS, SCALE_FACTOR } from "./get-tray-image.mjs";
import { speedTest } from "./speed-test.mjs";

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{ inputBytes: number, outputBytes: number }} NetworkDatum
 */

// Only run on macOS
if (process.platform !== "darwin") app.quit();

// File where history is stored
const HISTORY_FILE_NAME = "history.json";

// Stable UUID for tray icon position persistence between relaunches
const TRAY_GUID = "a1bcb3d4-e5f6-7890-abcd-ef1234567890";

const APP_SCHEME = "stupid-network-monitor";
const MAIN_WINDOW_URL = `${APP_SCHEME}://bundle/index.html`;

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

let networkMonitoringStarted = false;

// /**
//  * Open the app's main window.
//  */
// async function createMainWindow() {
//   const mainWindow = new BrowserWindow({
//     backgroundColor: "#000000",
//     height: 600,
//     show: true,
//     title: "Stupid Network Monitor",
//     webPreferences: {
//       contextIsolation: false,
//       nodeIntegration: true,
//       sandbox: false,
//     },
//     width: 800,
//   });

//   mainWindow.once("ready-to-show", () => {
//     mainWindow.show();
//   });

//   mainWindow.once("closed", () => {
//     // Do nothing - mainWindow will be garbage collected
//   });

//   await mainWindow.loadURL(MAIN_WINDOW_URL);

//   return mainWindow;
// }

/**
 * Start the network monitoring
 */
async function startNetworkMonitoring() {
  /**
   * Initialize the `Tray` a.k.a. the menu bar icon.
   */
  const initialImage = nativeImage.createMenuSymbol("chart.bar");
  const tray = new Tray(initialImage, TRAY_GUID);

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
    const splitLine = split.map((s) => parseInt(s.trim(), 10));
    const inputBytes = splitLine.at(2);
    const outputBytes = splitLine.at(5);
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
      console.log(`Tray image updated at ${new Date().toLocaleTimeString()}`);
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

// Don't quit when all windows are closed - keep running in menu bar
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray
});

// Kill the child process on app quit
app.on("before-quit", () => {
  abortController.abort("App is quitting");
});

app.whenReady().then(async () => {
  // await ipcMain.handle("start-network-monitoring", async (event) => {
  //   if (event.senderFrame?.url !== MAIN_WINDOW_URL) {
  //     throw new Error("Unauthorized monitoring request");
  //   }

  //   if (networkMonitoringStarted) return;
  //   networkMonitoringStarted = true;

  //   try {
  //     await startNetworkMonitoring();
  //   } catch (error) {
  //     networkMonitoringStarted = false;
  //     throw error;
  //   }
  // });
  const mainWindow = new BaseWindow({
    backgroundColor: "#000000",
    height: 600,
    resizable: false,
    width: 800,
  });

  const webContentsView = new WebContentsView({
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.contentView.addChildView(webContentsView);

  mainWindow.on("closed", () => {
    webContentsView.webContents.close();
  });

  const setBounds = async () => {
    const [width, height] = mainWindow.getContentSize();
    webContentsView.setBounds({ x: 0, y: 0, width, height });
  };

  mainWindow.on("resize", async () => {
    await setBounds();
  });

  // ipcMain.on("start-network-monitoring", async (event) => {
  //   console.log("boobs");
  // });

  //   const renderMainWindow = async () => {
  //     const html = /* html */ `
  // <!DOCTYPE html>
  //   <html lang="en">
  //   <head>
  //     <meta charset="UTF-8">
  //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
  //     <title>Network Monitor</title>
  //   </head>
  //   <body style="color: white; background-color: black; width: 100dvw; height: 100dvh; font-family: monospace; display: grid; justify-content: center; align-content: center;">
  //     <h1>Network Monitor</h1>
  //     <button>Start</button>
  //     <script>
  //       const { ipcRenderer } = require("electron");
  //       const startButton = document.querySelector("button");

  //       startButton.addEventListener("click", async () => {
  //         startButton.textContent = "Stop";

  //         try {
  //           await ipcRenderer.invoke("start-network-monitoring");
  //           startButton.textContent = "Started";
  //         } catch (error) {
  //           console.error("Failed to start network monitoring:", error);
  //           startButton.disabled = false;
  //           startButton.textContent = "Start";
  //         }
  //       });
  //     </script>
  //   </body>
  // </html>`;
  //     await webContentsView.webContents.loadURL(
  //       `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  //     );
  //     await setBounds();
  //   };

  const renderMainWindow = async () => {
    const html = /* html */ `
<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Monitor</title>
  </head>
  <body style="color: white; background-color: black; width: 100dvw; height: 100dvh; font-family: monospace; display: grid; justify-content: center; align-content: center;">
    <h1>Network Monitor</h1>
    <button>Start</button>
    <script>
      console.log(Object.keys(window?.electronAPI));
    </script>
  </body>
</html>`;
    await webContentsView.webContents.loadURL(
      `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
    );
    await setBounds();
  };

  const openMainWindow = async () => {
    const window = BrowserWindow.fromId(mainWindow.id);
    if (window) {
      window.show();
      window.focus();
    } else {
      await renderMainWindow().catch((error) => {
        console.error("Failed to open main window:", error);
      });
    }
  };

  app.on("activate", async () => {
    await openMainWindow();
  });

  await openMainWindow();
});
