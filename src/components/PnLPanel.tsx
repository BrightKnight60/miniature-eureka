import { useCallback, useMemo } from 'react';
import Plot from '../PlotlyChart';
import type { Data, PlotHoverEvent, PlotRelayoutEvent } from 'plotly.js';
import { useStore } from '../store';
import ChartPanel from './ChartPanel';
import { extractProductPnlSeries } from '../parsers/productPnlSeries';

const BG = '#FFFFFF';
const GRID = '#F0F0F0';
const FONT = '#1D1D1F';
const PRODUCT_LINE = '#34C759';
const TOTAL_LINE = '#86868B';

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

export default function PnLPanel() {
  const mode = useStore((s) => s.mode);
  const algoData = useStore((s) => s.algoData);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const xRange = useStore((s) => s.xRange);
  const hoverTimestamp = useStore((s) => s.hoverTimestamp);
  const setXRange = useStore((s) => s.setXRange);
  const setHoverTimestamp = useStore((s) => s.setHoverTimestamp);

  const data = useMemo((): Data[] => {
    const orderBook = algoData?.orderBook ?? [];
    const productSeries = extractProductPnlSeries(orderBook, selectedProduct);
    const totalPnl = algoData?.pnl ?? [];

    const traces: Data[] = [];

    if (productSeries.length > 0) {
      traces.push({
        type: 'scattergl',
        mode: 'lines',
        name: selectedProduct || 'Product',
        x: productSeries.map((p) => p.timestamp),
        y: productSeries.map((p) => p.value),
        line: { color: PRODUCT_LINE, width: 2 },
        hovertemplate: '%{fullData.name}<br>%{x}<br>PnL: %{y:.4f}<extra></extra>',
      });
    }

    if (totalPnl.length > 0) {
      traces.push({
        type: 'scattergl',
        mode: 'lines',
        name: 'Total',
        x: totalPnl.map((p) => p.timestamp),
        y: totalPnl.map((p) => p.value),
        line: { color: TOTAL_LINE, width: 1.5, dash: 'dash' },
        hovertemplate: '%{fullData.name}<br>%{x}<br>PnL: %{y:.4f}<extra></extra>',
      });
    }

    return traces;
  }, [algoData?.orderBook, algoData?.pnl, selectedProduct]);

  const headerValue = useMemo(() => {
    const orderBook = algoData?.orderBook ?? [];
    const productSeries = extractProductPnlSeries(orderBook, selectedProduct);
    const v = valueAtOrBefore(productSeries, hoverTimestamp);
    if (v == null) return null;
    return v.toFixed(2);
  }, [algoData?.orderBook, selectedProduct, hoverTimestamp]);

  const makeLayout = useCallback((h: number) => ({
    uirevision: 'pnl',
    paper_bgcolor: BG, plot_bgcolor: BG, font: { color: FONT, size: 11 },
    margin: { l: 50, r: 72, t: 8, b: 32 },
    height: h,
    showlegend: true,
    legend: {
      x: 1,
      xanchor: 'right',
      y: 1,
      yanchor: 'top',
      font: { size: 10, color: FONT },
      bgcolor: 'rgba(255,255,255,0.8)',
      bordercolor: 'rgba(0,0,0,0.08)',
      borderwidth: 1,
    },
    shapes: hoverSyncShapes(hoverTimestamp),
    xaxis: xRange
      ? { range: xRange, autorange: false, gridcolor: GRID, zerolinecolor: GRID }
      : { autorange: true, gridcolor: GRID, zerolinecolor: GRID },
    yaxis: { title: { text: 'PnL', font: { color: FONT, size: 11 } }, gridcolor: GRID, zerolinecolor: GRID },
  } satisfies Partial<import('plotly.js').Layout>), [xRange, hoverTimestamp]);

  const onRelayout = useCallback((event: Readonly<PlotRelayoutEvent>) => {
    const parsed = parseXRangeFromRelayout(event);
    if (parsed === 'autorange') { setXRange(null); return; }
    if (parsed) setXRange(parsed);
  }, [setXRange]);

  const onHover = useCallback((event: Readonly<PlotHoverEvent>) => {
    const pt = event.points[0];
    if (pt && typeof pt.x === 'number') {
      setHoverTimestamp(pt.x);
    }
  }, [setHoverTimestamp]);

  const onUnhover = useCallback(() => {
    setHoverTimestamp(null);
  }, [setHoverTimestamp]);

  if (mode !== 'algo' || !algoData) return null;

  return (
    <ChartPanel id="pnl" title="P&L" headerValue={headerValue}>
      {(fullscreen) => {
        const h = fullscreen ? window.innerHeight - 40 : 140;
        return (
          <div className="relative w-full" style={{ height: h }}>
            <Plot data={data} layout={makeLayout(h)}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: h }} useResizeHandler
              onRelayout={onRelayout} onHover={onHover} onUnhover={onUnhover} />
          </div>
        );
      }}
    </ChartPanel>
  );
}
