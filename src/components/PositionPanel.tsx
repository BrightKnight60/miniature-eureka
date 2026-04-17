import { useCallback, useMemo } from 'react';
import Plot from '../PlotlyChart';
import type { PlotHoverEvent, PlotRelayoutEvent } from 'plotly.js';
import { useStore } from '../store';
import ChartPanel from './ChartPanel';
import { snapTimestampToTick } from '../utils/timestamp';

const BG = '#FFFFFF';
const GRID = '#F0F0F0';
const FONT = '#1D1D1F';

function parseXRangeFromRelayout(event: Readonly<PlotRelayoutEvent>): [number, number] | null | 'autorange' {
  if (event['xaxis.autorange'] === true) return 'autorange';
  const x0 = event['xaxis.range[0]'];
  const x1 = event['xaxis.range[1]'];
  if (typeof x0 === 'number' && typeof x1 === 'number') return [x0, x1];
  return null;
}

function hoverSyncShapes(ts: number | null): NonNullable<import('plotly.js').Layout['shapes']> {
  if (ts == null || !Number.isFinite(ts)) return [];
  return [{
    type: 'line', xref: 'x', yref: 'paper',
    x0: ts, y0: 0, x1: ts, y1: 1,
    line: { color: 'rgba(0,0,0,0.15)', width: 1 },
    layer: 'above',
  }];
}

function valueAtOrBefore(points: { timestamp: number; value: number }[], ts: number | null): number | null {
  if (ts == null || !Number.isFinite(ts) || points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  if (ts < points[0].timestamp) return points[0].value;
  if (ts >= points[hi].timestamp) return points[hi].value;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].timestamp <= ts) lo = mid;
    else hi = mid;
  }
  return points[lo].value;
}

export default function PositionPanel() {
  const mode = useStore((s) => s.mode);
  const algoData = useStore((s) => s.algoData);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const xRange = useStore((s) => s.xRange);
  const hoverTimestamp = useStore((s) => s.hoverTimestamp);
  const setXRange = useStore((s) => s.setXRange);
  const setHoverTimestamp = useStore((s) => s.setHoverTimestamp);

  const data = useMemo(() => {
    const logs = algoData?.logs ?? [];
    const x: number[] = [];
    const y: number[] = [];
    for (const entry of logs) {
      x.push(entry.timestamp);
      const pos = entry.position[selectedProduct];
      y.push(pos !== undefined ? pos : 0);
    }
    return [{
      type: 'scattergl' as const, mode: 'lines' as const, x, y,
      line: { color: '#FF9500', width: 1.5, shape: 'hv' as const },
      hovertemplate: '%{x}<br>Position: %{y}<extra></extra>',
    }];
  }, [algoData?.logs, selectedProduct]);

  const headerValue = useMemo(() => {
    const logs = algoData?.logs ?? [];
    const pts: { timestamp: number; value: number }[] = [];
    for (const entry of logs) {
      const pos = entry.position[selectedProduct];
      pts.push({ timestamp: entry.timestamp, value: pos !== undefined ? pos : 0 });
    }
    const v = valueAtOrBefore(pts, hoverTimestamp);
    if (v == null) return null;
    return String(Math.trunc(v));
  }, [algoData?.logs, selectedProduct, hoverTimestamp]);

  const makeLayout = useCallback((h: number) => ({
    uirevision: 'position',
    paper_bgcolor: BG, plot_bgcolor: BG, font: { color: FONT, size: 11 },
    margin: { l: 50, r: 10, t: 8, b: 32 }, height: h, showlegend: false,
    shapes: hoverSyncShapes(hoverTimestamp),
    xaxis: xRange
      ? { range: xRange, autorange: false, gridcolor: GRID, zerolinecolor: GRID }
      : { autorange: true, gridcolor: GRID, zerolinecolor: GRID },
    yaxis: { title: { text: 'Position', font: { color: FONT, size: 11 } }, gridcolor: GRID, zerolinecolor: GRID },
  } satisfies Partial<import('plotly.js').Layout>), [xRange, hoverTimestamp]);

  const onRelayout = useCallback((event: Readonly<PlotRelayoutEvent>) => {
    const parsed = parseXRangeFromRelayout(event);
    if (parsed === 'autorange') { setXRange(null); return; }
    if (parsed) setXRange(parsed);
  }, [setXRange]);

  const onHover = useCallback((event: Readonly<PlotHoverEvent>) => {
    const pt = event.points[0];
    if (pt && typeof pt.x === 'number') setHoverTimestamp(snapTimestampToTick(pt.x));
  }, [setHoverTimestamp]);

  const onUnhover = useCallback(() => { setHoverTimestamp(null); }, [setHoverTimestamp]);

  if (mode !== 'algo' || !algoData) return null;

  return (
    <ChartPanel id="position" title="Position" headerValue={headerValue}>
      {(fullscreen) => {
        const h = fullscreen ? window.innerHeight - 40 : 140;
        return (
          <Plot data={data} layout={makeLayout(h)}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: h }} useResizeHandler
            onRelayout={onRelayout} onHover={onHover} onUnhover={onUnhover} />
        );
      }}
    </ChartPanel>
  );
}
