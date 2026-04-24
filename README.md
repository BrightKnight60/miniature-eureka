# Prosperity Visualizer

Desktop + web visualizer for IMC Prosperity data (Electron + React + Vite + Plotly).

## Development

- Install deps: `npm install`
- Web dev mode: `npm run dev`
- Electron dev mode: `npm run electron:dev`
- Production web build: `npm run build`

## macOS desktop build (team/local)

For local team use, unsigned DMGs are supported.

- Verify web bundle integrity: `npm run verify:dist`
- Build unsigned mac app: `npm run dist:mac:unsigned`
- Output DMG: `release/Prosperity Visualizer-0.0.0-arm64.dmg`

### Diagnosing packaged startup issues

Run the packaged app with Electron diagnostics enabled:

- `npm run diagnose:packaged`

This prints startup/load events, renderer load failures, GPU/child-process exits, and renderer console messages.

### If macOS says the app is corrupted/damaged

Unsigned apps are frequently blocked by Gatekeeper and shown as \"damaged\" even when the bundle is valid.

Recommended sequence:

1. Finder: right-click app -> `Open` -> confirm.
2. If blocked, go to `System Settings -> Privacy & Security` and click `Open Anyway` for the app.
3. If still blocked after copying/unzipping from another machine, remove quarantine metadata:
   - `xattr -dr com.apple.quarantine \"release/mac-arm64/Prosperity Visualizer.app\"`
4. Re-open the app.

Notes:
- Only run `xattr -dr` on trusted local artifacts.
- This bypasses Gatekeeper checks; do not use for untrusted binaries.
- For wide external distribution, use signed + notarized builds instead of unsigned DMGs.

## GitHub Pages deployment

This project is configured to deploy from the repository root workflow at:

- `.github/workflows/prosperity-visualizer-pages.yml`

### One-time setup in GitHub

1. Go to `Settings -> Pages` in your repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

### How it deploys

- Every push to `main` that changes `prosperity-visualizer/**` triggers deployment.
- The workflow runs `npm ci` and `npm run build` inside `prosperity-visualizer`.
- Vite uses the repository name automatically in CI so asset paths resolve correctly on Pages.
