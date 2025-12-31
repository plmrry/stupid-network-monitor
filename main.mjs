// @ts-check

import fs from "node:fs";
import { Readable } from "node:stream";
import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import { buildNextServer } from "./build-next-server.mjs";
import { startNextServer } from "./start-next-server.mjs";

// Only run on macOS
if (process.platform !== "darwin") {
  console.error("This application only runs on macOS");
  app.quit();
}

// Stable UUID for tray icon position persistence between relaunches
const TRAY_GUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TRAY_IMAGE_PATH = `./tray-image.png`;

/** @type {import("electron").Tray | null} */
let tray = null;
const abortController = new AbortController();
const abortSignal = abortController.signal;
/** @type {import("electron").BrowserWindow | null} */
let mainWindow = null;
let forceQuit = false;

async function getImage(baseUrl) {
  // console.log("Fetching image from", baseUrl);
  const imageUrl = new URL("/api/image", baseUrl).toString();
  const response = await fetch(imageUrl);

  // Create a write stream
  const fileStream = fs.createWriteStream(TRAY_IMAGE_PATH);

  // Convert web stream to Node stream and pipe to file
  // @ts-ignore
  await Readable.fromWeb(response.body).pipe(fileStream);

  // Wait for the stream to finish
  await new Promise((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });

  // console.log(`Image saved successfully`);
}

function getTrayImage() {
  const icon = nativeImage.createFromPath(TRAY_IMAGE_PATH);
  icon.setTemplateImage(true);
  return icon;
}

async function updateTray() {
  const image = getTrayImage();
  tray.setImage(image);
}

async function createTray() {
  const image = getTrayImage();

  tray = new Tray(image, TRAY_GUID);

  tray.setImage(image);

  // Create a simple context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      },
      label: "Show Window",
    },
    { type: "separator" },
    {
      click: () => {
        forceQuit = true;
        app.quit();
      },
      label: "Quit",
    },
  ]);
  tray.setContextMenu(contextMenu);

  setInterval(updateTray, 1000);
}

function createWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    width: 800,
  });

  mainWindow.loadURL(serverUrl);

  // Hide window instead of closing when user clicks close button
  mainWindow.on("close", (event) => {
    if (!forceQuit) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log("Building Next.js server...");
  await buildNextServer();
  console.log("Starting Next.js server...");
  const url = await startNextServer({ signal: abortSignal });
  console.log("Next.js server started at", url);

  await createTray();

  if (mainWindow === null) {
    createWindow(url);
  }
  setInterval(async () => {
    await getImage(url);
  }, 2000);
});

// Don't quit when all windows are closed - keep running in menu bar
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray
});

// Clean up Next.js server on quit
app.on("before-quit", () => {
  console.log("Quitting app, aborting Next.js server...");
  abortController.abort("App is quitting");
});
