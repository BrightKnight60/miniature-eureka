import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const diagnosticMode =
  process.argv.includes("--pv-diagnostics") || process.env.PV_DIAGNOSTICS === "1";
const explicitDisableGpu =
  process.argv.includes("--pv-disable-gpu") || process.env.PV_DISABLE_GPU === "1";
const allowGpuFallbackRelaunch = process.env.PV_ALLOW_GPU_FALLBACK !== "0";

function log(...args) {
  if (!diagnosticMode) return;
  // eslint-disable-next-line no-console
  console.log("[pv-electron]", ...args);
}

if (explicitDisableGpu) {
  log("Hardware acceleration explicitly disabled.");
  app.disableHardwareAcceleration();
} else {
  // Prefer GPU locally; helps Plotly scattergl and large chart interactions.
  log("GPU-first mode enabled.");
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("enable-zero-copy");
}

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
  win.webContents.on("did-start-loading", () => log("Renderer started loading."));
  win.webContents.on("did-finish-load", () => log("Renderer finished loading."));
  win.webContents.on("did-fail-load", (_event, code, description, validatedURL) => {
    log("Renderer failed to load:", { code, description, validatedURL });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    log("Renderer process gone:", details);
  });
  win.webContents.on("unresponsive", () => log("Renderer unresponsive."));
  win.webContents.on("responsive", () => log("Renderer responsive again."));
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log("Renderer console:", { level, message, line, sourceId });
  });

  const distIndexPath = path.join(__dirname, "..", "dist", "index.html");
  if (!process.env.VITE_DEV_SERVER_URL && !fs.existsSync(distIndexPath)) {
    throw new Error(`Missing dist index file: ${distIndexPath}`);
  }

  // Packaged apps often have NODE_ENV unset; never treat that as "dev" or we load localhost and get a blank window.
  if (app.isPackaged) {
    log("Loading packaged index file:", distIndexPath);
    win.loadFile(distIndexPath);
  } else if (process.env.VITE_DEV_SERVER_URL) {
    log("Loading dev server URL:", process.env.VITE_DEV_SERVER_URL);
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    log("Loading local dist index file:", distIndexPath);
    win.loadFile(distIndexPath);
  }
}

app.on("child-process-gone", (_event, details) => {
  log("Child process gone:", details);
  const isGpuProcess = details.type === "GPU";
  const alreadyRetried = process.env.PV_GPU_RELAUNCHED === "1";
  if (
    isGpuProcess &&
    !explicitDisableGpu &&
    allowGpuFallbackRelaunch &&
    !alreadyRetried
  ) {
    log("GPU process crashed; relaunching once with software rendering fallback.");
    app.relaunch({
      args: [...process.argv.slice(1), "--pv-disable-gpu", "--pv-diagnostics"],
      env: { ...process.env, PV_GPU_RELAUNCHED: "1" },
    });
    app.exit(0);
  }
});

app.whenReady().then(() => {
  log("App ready; creating window.");
  createWindow();
});

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
