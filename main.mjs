// @ts-check

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, nativeImage, session, Tray } from "electron";
import { buildNextServer } from "./build-next-server.mjs";
import { startNextServer } from "./start-next-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only run on macOS
if (process.platform !== "darwin") {
  console.error("This application only runs on macOS");
  app.quit();
}

const abortController = new AbortController();
const abortSignal = abortController.signal;

// const isDev = !app.isPackaged;
// const PORT = 3000;
// const SERVER_URL = `http://localhost:${PORT}`;

// // Stable UUID for tray icon position persistence between relaunches
// const TRAY_GUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// let tray = null;
// let mainWindow = null;
// let forceQuit = false;
// let nextServer /** @type {import("node:child_process").ChildProcessWithoutNullStreams | null} */ =
//   null;

// async function startNextServer() {
//   if (isDev) {
//     // In dev mode, Next.js is started externally via turbo
//     return;
//   }

//   // In production, start the standalone Next.js server
//   const serverPath = path.join(__dirname, ".next", "standalone", "server.js");

//   return new Promise((resolve, reject) => {
//     nextServer = spawn(process.execPath, [serverPath], {
//       cwd: path.join(__dirname, ".next", "standalone"),
//       env: {
//         ...process.env,
//         HOSTNAME: "localhost",
//         PORT: String(PORT),
//       },
//     });

//     nextServer.stdout.on("data", (data) => {
//       console.log(`[Next.js] ${data}`);
//       // Resolve when server is ready
//       if (
//         data.toString().includes("Ready") ||
//         data.toString().includes("started")
//       ) {
//         resolve(void 0);
//       }
//     });

//     nextServer.stderr.on("data", (data) => {
//       console.error(`[Next.js] ${data}`);
//     });

//     nextServer.on("error", (err) => {
//       console.error("Failed to start Next.js server:", err);
//       reject(err);
//     });

//     // Fallback: resolve after a short delay if no "Ready" message
//     setTimeout(() => resolve(void 0), 2000);
//   });
// }

// function stopNextServer() {
//   if (nextServer) {
//     nextServer.kill();
//     nextServer = null;
//   }
// }

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     height: 600,
//     webPreferences: {
//       contextIsolation: true,
//       nodeIntegration: false,
//     },
//     width: 800,
//   });

//   mainWindow.loadURL(SERVER_URL);

//   // Hide window instead of closing when user clicks close button
//   mainWindow.on("close", (event) => {
//     if (!forceQuit) {
//       event.preventDefault();
//       mainWindow.hide();
//     }
//   });

//   mainWindow.on("closed", () => {
//     mainWindow = null;
//   });
// }

// async function getRandomNumber() {
//   const response = await fetch(`${SERVER_URL}/api/random-number`);
//   const data = await response.json();
//   console.log("Fetched random number:", data.number);
//   return data.number;
// }

// async function getImage() {
//   const response = await fetch(`${SERVER_URL}/api/random-number`);
//   // const data = await response.buffer();
// 	const data = await response.arrayBuffer();
//   console.log("Fetched image", data);
//   return data;
// }

// let useCircle = true;

// function formatTrayTitle(number, isCircle) {
//   if (isCircle) {
//     return `(${number})`;
//   } else {
//     return `[${number}]`;
//   }
// }

// async function updateTray() {
//   const number = await getRandomNumber();
//   const image = await getImage();
//   console.log("got image", image);
//   tray.setTitle(formatTrayTitle(number, useCircle));
//   useCircle = !useCircle;
// }

// function createTrayIcon() {
//   // Create a 16x16 RGBA buffer with a small dot in the center
//   // Template images use black for visible parts (macOS inverts for dark mode)
//   const size = 16;
//   const buffer = Buffer.alloc(size * size * 4, 0); // RGBA, all transparent

//   // Draw a small 4x4 dot in the center
//   const dotSize = 4;
//   const offset = (size - dotSize) / 2;
//   for (let y = offset; y < offset + dotSize; y++) {
//     for (let x = offset; x < offset + dotSize; x++) {
//       const idx = (y * size + x) * 4;
//       buffer[idx] = 0; // R
//       buffer[idx + 1] = 0; // G
//       buffer[idx + 2] = 0; // B
//       buffer[idx + 3] = 255; // A (fully opaque)
//     }
//   }

//   const icon = nativeImage.createFromBuffer(buffer, {
//     height: size,
//     width: size,
//   });
//   icon.setTemplateImage(true);
//   return icon;
// }

// async function createTray() {
//   const icon = createTrayIcon();
//   tray = new Tray(icon, TRAY_GUID);

//   // Set initial title with number (displayed next to the icon)
//   const initialNumber = await getRandomNumber();
//   tray.setTitle(formatTrayTitle(initialNumber, useCircle));

//   // Create a simple context menu
//   const contextMenu = Menu.buildFromTemplate([
//     {
//       click: () => {
//         if (mainWindow === null) {
//           createWindow();
//         } else {
//           mainWindow.show();
//         }
//       },
//       label: "Show Window",
//     },
//     { type: "separator" },
//     {
//       click: () => {
//         forceQuit = true;
//         app.quit();
//       },
//       label: "Quit",
//     },
//   ]);
//   tray.setContextMenu(contextMenu);

//   // Update the number every 2 seconds, alternating shapes
//   setInterval(updateTray, 2000);
// }

async function getImage(baseUrl) {
  console.log("Fetching image from", baseUrl);
  const imageUrl = new URL("/api/image", baseUrl).toString();
  const response = await fetch(imageUrl);
  // const data = await response.text();
  console.log("Fetched image", response.headers);
}

app.whenReady().then(async () => {
  console.log("Building Next.js server...");
  await buildNextServer();
  console.log("Starting Next.js server...");
  const url = await startNextServer({ signal: abortSignal });
  console.log("Next.js server started at", url);
  setInterval(async () => {
    await getImage(url);
  }, 2000);
});
//   // Set Content-Security-Policy header
//   // In dev mode, we need unsafe-eval for Next.js HMR
//   const scriptSrc = isDev
//     ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
//     : "script-src 'self' 'unsafe-inline'";
//   const csp = `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;`;

//   session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
//     callback({
//       responseHeaders: {
//         ...details.responseHeaders,
//         "Content-Security-Policy": [csp],
//       },
//     });
//   });

//   // Start Next.js server first (in production)
//   await startNextServer();

//   await createTray();

//   createWindow();

//   app.on("activate", () => {
//     if (mainWindow === null) {
//       createWindow();
//     }
//   });
// });

// Don't quit when all windows are closed - keep running in menu bar
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray
});

// Clean up Next.js server on quit
app.on("before-quit", () => {
  console.log("Quitting app, aborting Next.js server...");
  abortController.abort("App is quitting");
});
