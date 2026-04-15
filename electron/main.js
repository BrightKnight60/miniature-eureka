import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#ffffff",
    webPreferences: {
      webSecurity: false,
    },
  });

  win.setTitle("Prosperity Visualizer");

  const isDev =
    process.env.NODE_ENV !== "production" ||
    process.env.VITE_DEV_SERVER_URL;

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
    win.loadURL(url);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
