import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, nativeImage, session, Tray } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only run on macOS
if (process.platform !== "darwin") {
  console.error("This application only runs on macOS");
  app.quit();
}

const isDev = !app.isPackaged;
const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// Stable UUID for tray icon position persistence between relaunches
const TRAY_GUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

let tray = null;
let mainWindow = null;
let forceQuit = false;
let nextServer = null;

async function startNextServer() {
  if (isDev) {
    // In dev mode, Next.js is started externally via turbo
    return;
  }

  // In production, start the standalone Next.js server
  const serverPath = path.join(__dirname, ".next", "standalone", "server.js");

  return new Promise((resolve, reject) => {
    nextServer = spawn(process.execPath, [serverPath], {
      cwd: path.join(__dirname, ".next", "standalone"),
      env: {
        ...process.env,
        HOSTNAME: "localhost",
        PORT: String(PORT),
      },
    });

    nextServer.stdout.on("data", (data) => {
      console.log(`[Next.js] ${data}`);
      // Resolve when server is ready
      if (
        data.toString().includes("Ready") ||
        data.toString().includes("started")
      ) {
        resolve();
      }
    });

    nextServer.stderr.on("data", (data) => {
      console.error(`[Next.js] ${data}`);
    });

    nextServer.on("error", (err) => {
      console.error("Failed to start Next.js server:", err);
      reject(err);
    });

    // Fallback: resolve after a short delay if no "Ready" message
    setTimeout(resolve, 2000);
  });
}

function stopNextServer() {
  if (nextServer) {
    nextServer.kill();
    nextServer = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    width: 800,
  });

  mainWindow.loadURL(SERVER_URL);

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

function getRandomNumber() {
  return Math.floor(Math.random() * 100) + 1;
}

let useCircle = true;

function formatTrayTitle(number, isCircle) {
  if (isCircle) {
    return `(${number})`;
  } else {
    return `[${number}]`;
  }
}

function updateTray() {
  const number = getRandomNumber();
  tray.setTitle(formatTrayTitle(number, useCircle));
  useCircle = !useCircle;
}

function createTrayIcon() {
  // Create a 16x16 RGBA buffer with a small dot in the center
  // Template images use black for visible parts (macOS inverts for dark mode)
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4, 0); // RGBA, all transparent

  // Draw a small 4x4 dot in the center
  const dotSize = 4;
  const offset = (size - dotSize) / 2;
  for (let y = offset; y < offset + dotSize; y++) {
    for (let x = offset; x < offset + dotSize; x++) {
      const idx = (y * size + x) * 4;
      buffer[idx] = 0; // R
      buffer[idx + 1] = 0; // G
      buffer[idx + 2] = 0; // B
      buffer[idx + 3] = 255; // A (fully opaque)
    }
  }

  const icon = nativeImage.createFromBuffer(buffer, {
    height: size,
    width: size,
  });
  icon.setTemplateImage(true);
  return icon;
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon, TRAY_GUID);

  // Set initial title with number (displayed next to the icon)
  tray.setTitle(formatTrayTitle(getRandomNumber(), useCircle));

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

  // Update the number every 2 seconds, alternating shapes
  setInterval(updateTray, 2000);
}

app.whenReady().then(async () => {
  // Set Content-Security-Policy header
  // In dev mode, we need unsafe-eval for Next.js HMR
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const csp = `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;`;

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // Start Next.js server first (in production)
  await startNextServer();

  createTray();
  createWindow();

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

// Don't quit when all windows are closed - keep running in menu bar
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray
});

// Clean up Next.js server on quit
app.on("before-quit", () => {
  stopNextServer();
});
