// @ts-check

import process from "node:process";
import { app, Menu } from "electron";
import { NetworkMonitor } from "./network-monitor.mjs";
import { TrayRenderer } from "./tray-renderer.mjs";

// Should improve performance.
Menu.setApplicationMenu(null);

// Only run on macOS
if (process.platform !== "darwin") app.quit();

/**
 * Abort controller to kill child processes on app quit.
 */
const abortController = new AbortController();

app.whenReady().then(async () => {
  await TrayRenderer.initialize();
  NetworkMonitor.start({ signal: abortController.signal });
  TrayRenderer.start({ signal: abortController.signal });
});

// Don't quit when all windows are closed - keep running in menu bar.
app.on("window-all-closed", () => {
  // Do nothing - app stays running with tray.
});

// Kill the child process on app quit.
app.on("before-quit", () => {
  abortController.abort("App is quitting");
});
