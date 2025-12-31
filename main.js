const { app, Tray, Menu, nativeImage } = require("electron");

// Only run on macOS
if (process.platform !== "darwin") {
  console.error("This application only runs on macOS");
  app.quit();
}

// Hide dock icon since this is a background app
app.dock.hide();

let tray = null;

function getRandomNumber() {
  return Math.floor(Math.random() * 100) + 1;
}

function createTray() {
  // Create a transparent 1x1 image for the tray icon (required, but we only show text)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  // Set initial number
  tray.setTitle(String(getRandomNumber()));

  // Create a simple context menu
  const contextMenu = Menu.buildFromTemplate([
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);

  // Update the number every 2 seconds
  setInterval(() => {
    tray.setTitle(String(getRandomNumber()));
  }, 2000);
}

app.whenReady().then(() => {
  createTray();
});
