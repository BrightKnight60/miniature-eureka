# AGENTS.md — IMC Prosperity Visualizer

**Update protocol:** If you modify this project, you **MUST** update this file to reflect your changes.

This document is for agents building or maintaining the visualizer. Keep it accurate as the codebase evolves.

---

## Project purpose

A custom **desktop visualizer** (Electron + React + Vite + Plotly.js) for the **IMC Prosperity 4** trading competition. The competition uses simulated markets with hidden patterns. The visualizer helps identify those patterns so they can be exploited in a trading algorithm.

---

## Architecture

- **Electron** wraps a **React + Vite** app for macOS desktop packaging.
- **Vite web build** is also configured for **GitHub Pages** deployment (repo-name base path is set automatically in CI).
- **Plotly.js** `scattergl` for WebGL-accelerated rendering of order book scatter plots and trade markers.
- **Zustand** for global state management.
- **Tailwind CSS** for minimal, functional styling.

---

## Two modes

1. **Algo log mode**  
   Loads `.log` / `.json` files from the competition portal. Shows:
   - Order book scatter plot  
   - Trade markers  
   - PnL panel  
   - Position panel  
   - Log viewer  

2. **Historical data mode**  
   Loads price and trade CSVs from competition data releases. Shows:
   - Order book scatter plot  
   - Trade markers only (no algo-specific panels)

---

## Data flow

```
File upload → parser (parseLog.ts or parseCsv.ts) → Zustand store → chart rendering
```

Indicator CSVs and trade label CSVs are loaded separately and **merged** into the visualization.

---

## Key file guide

| Path | Role |
|------|------|
| `src/types.ts` | All TypeScript interfaces (`OrderBookSnapshot`, `Trade`, `TradeLabel`, `IndicatorSeries`, `LogEntry`, etc.) |
| `src/store.ts` | Zustand store with state slices: mode, data, filters, hover, zoom range |
| `src/parsers/parseLog.ts` | Parses `.log` and `.json` algo files from the competition portal |
| `src/parsers/parseCsv.ts` | Parses semicolon-delimited historical price and trade CSVs |
| `src/parsers/parseIndicators.ts` | Parses comma-delimited indicator overlay CSVs |
| `src/parsers/parseTradeLabels.ts` | Parses comma-delimited trade label CSVs |
| `src/components/MainChart.tsx` | Plotly `scattergl` chart: order book as scatter dots (blue bids, red asks) with trade markers overlaid |
| `src/components/PnLPanel.tsx` | PnL line chart; X-axis synced with main chart |
| `src/components/PositionPanel.tsx` | Position line chart; X-axis synced |
| `src/components/LogViewer.tsx` | Structured log viewer for parsed `lambdaLog` entries; hover-synced |
| `src/components/Controls.tsx` | File picker, product/day selector, normalization, OB toggles |
| `src/components/TradeFilters.tsx` | Dynamic label toggle grid + quantity filter |
| `src/components/DownsampleControls.tsx` | Threshold inputs for ds10, ds100, ob, trades |
| `src/utils/downsample.ts` | Viewport-aware downsampling logic |
| `electron/main.js` | Electron entry point; production loads `dist/index.html` when `app.isPackaged` (avoids treating unset `NODE_ENV` as dev and loading localhost) |
| `vite.config.ts` | Uses `base: './'` so built assets resolve correctly on both custom domains and project pages |
| `.github/workflows/prosperity-visualizer-pages.yml` (repo root) | Builds from `prosperity-visualizer/` and deploys `dist/` to GitHub Pages on pushes to `main` |
| `prosperity-visualizer/.github/workflows/pages.yml` | Standalone Pages workflow for subtree-split repo that builds at repo root, validates no `/src/main.tsx` in `dist/index.html`, and deploys `dist/` |

---

## Data schemas

### 1. `OrderBookSnapshot`

Semicolon-delimited rows with **up to three bid and three ask levels** per timestamp per product. Missing levels may be empty between delimiters.

### 2. `Trade`

Fields: **timestamp**, **buyer**, **seller**, **symbol**, **currency**, **price**, **quantity**.

### 3. `lambdaLog` format

A **JSON string** encoding a **5-element array**:

`[state, orders, conversions, trader_data, debug_logs]`

**`state`** is an **8-element array**:

`[timestamp, traderData, listings, order_depths, own_trades, market_trades, position, observations]`

Parsing must treat each tick’s string as potentially malformed (see Known gotchas).

### 4. Indicator CSV

- **Delimiter:** comma  
- **First column:** `timestamp` (same scale as price data timestamps)  
- **Additional columns:** named indicator series (one column per indicator)

### 5. Trade label CSV

- **Delimiter:** comma  
- **Join key:** `timestamp` + `price` + `quantity` (together match a trade)  
- **Columns:** label (string), **color** (hex, e.g. `#00ff00`), **shape** — one of: `circle`, `square`, `triangle-up`, `triangle-down`, `cross`, `diamond`

---

## Design decisions

- **Single `scattergl` trace** for trades with **per-point** `color`, `symbol`, and `size` arrays — **not** one trace per label — to avoid **O(N traces)** hover performance degradation.
- **Order book as scatter plot** because Prosperity markets have **at most three** bid/ask levels per side.
- **Notebook-export pattern** for indicators and trade labels: compute in Python, export CSV, load into the visualizer.
- **X-axis zoom** synced across the main chart, PnL panel, and position panel via **Plotly `relayout`** (or equivalent) events.

---

## Known gotchas

- **`lambdaLog` strings may be truncated** (e.g. logger `max_log_length`). The parser should **try/catch per tick** and handle partial JSON gracefully.
- **Historical CSVs use semicolons** as delimiters, not commas.
- **Multi-day historical data:** timestamps **reset per day**; combining days requires an **offset** (or explicit day dimension) for a coherent X-axis.
- **Trade CSVs in historical mode** may have **empty** `buyer` / `seller` fields.
