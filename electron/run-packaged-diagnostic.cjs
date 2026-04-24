const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const appBinary = path.resolve(
  __dirname,
  "..",
  "release",
  "mac-arm64",
  "Prosperity Visualizer.app",
  "Contents",
  "MacOS",
  "Prosperity Visualizer",
);

if (!fs.existsSync(appBinary)) {
  console.error(`[run-packaged-diagnostic] Missing app binary: ${appBinary}`);
  console.error("[run-packaged-diagnostic] Build the app first with npm run dist:mac:unsigned");
  process.exit(1);
}

console.log(`[run-packaged-diagnostic] Launching ${appBinary}`);
console.log("[run-packaged-diagnostic] Press Ctrl+C to stop.");

const child = spawn(appBinary, ["--pv-diagnostics"], {
  stdio: "inherit",
  env: { ...process.env, PV_DIAGNOSTICS: "1" },
});

child.on("exit", (code, signal) => {
  console.log(`[run-packaged-diagnostic] Exited with code=${code} signal=${signal ?? "none"}`);
});
