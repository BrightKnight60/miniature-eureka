import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import Plot from '../PlotlyChart';
import type { Data, Layout, ModeBarDefaultButtons, PlotDatum, PlotHoverEvent, PlotRelayoutEvent } from 'plotly.js';
import { useStore } from '../store';
import type {
  IndicatorSeries,
  OrderBookSnapshot,
  Trade,
  TradeLabel,
} from '../types';
import { indicatorColor } from '../utils/indicatorColors';

const BG = '#FFFFFF';
const GRID = '#F0F0F0';
const FONT = '#1D1D1F';

const BID_COLOR = '#007AFF';
const BID_COLOR_ALPHA = 'rgba(0,122,255,0.35)';
const ASK_COLOR = '#FF3B30';
const ASK_COLOR_ALPHA = 'rgba(255,59,48,0.35)';
const DEFAULT_TRADE_GRAY = '#AEAEB2';

function tradeKey(timestamp: number, price: number, quantity: number): string {
  return `${timestamp}|${price}|${quantity}`;
}

function interpolateSorted(
  points: { timestamp: number; value: number }[],
  t: number,
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].value;
  if (t <= points[0].timestamp) return points[0].value;
  const last = points[points.length - 1];
  if (t >= last.timestamp) return last.value;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].timestamp <= t) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const span = b.timestamp - a.timestamp;
  if (span <= 0) return a.value;
  const w = (t - a.timestamp) / span;
  return a.value + w * (b.value - a.value);
}

function getSeriesPoints(series: IndicatorSeries): { timestamp: number; value: number }[] {
  return [...series.data].sort((x, y) => x.timestamp - y.timestamp);
}

function findNormalizationSeries(
  indicators: IndicatorSeries[], name: string, product: string, selectedDay: number | 'all',
): IndicatorSeries | null {
  const matches = indicators.filter((i) => i.name === name && i.product === product);
  if (matches.length === 0) return null;
  if (selectedDay === 'all') {
    const merged: { timestamp: number; value: number }[] = [];
    for (const s of matches) merged.push(...s.data);
    merged.sort((a, b) => a.timestamp - b.timestamp);
    return { name, product, day: -1, data: merged };
  }
  return matches.find((s) => s.day === selectedDay) ?? null;
}

function indicatorValueAt(series: IndicatorSeries | null, timestamp: number): number {
  if (!series || series.data.length === 0) return 0;
  return interpolateSorted(getSeriesPoints(series), timestamp);
}

function normOffsetForOB(
  indicators: IndicatorSeries[], normName: string, product: string,
  selectedDay: number | 'all', snapshot: OrderBookSnapshot,
): number {
  if (selectedDay === 'all') {
    const dayMatch = indicators.find(
      (i) => i.name === normName && i.product === product && i.day === snapshot.day,
    );
    return indicatorValueAt(dayMatch ?? findNormalizationSeries(indicators, normName, product, 'all'), snapshot.timestamp);
  }
  return indicatorValueAt(findNormalizationSeries(indicators, normName, product, selectedDay), snapshot.timestamp);
}

function normOffsetForTrade(
  indicators: IndicatorSeries[], normName: string, product: string,
  selectedDay: number | 'all', trade: Trade, dayTimeBounds: Map<number, { min: number; max: number }>,
): number {
  if (selectedDay !== 'all') {
    return indicatorValueAt(findNormalizationSeries(indicators, normName, product, selectedDay), trade.timestamp);
  }
  for (const [day, bounds] of dayTimeBounds) {
    if (trade.timestamp >= bounds.min && trade.timestamp <= bounds.max) {
      const series = indicators.find((i) => i.name === normName && i.product === product && i.day === day);
      if (series) return indicatorValueAt(series, trade.timestamp);
    }
  }
  return indicatorValueAt(findNormalizationSeries(indicators, normName, product, 'all'), trade.timestamp);
}

function buildDayBoundsForProduct(
  orderBook: OrderBookSnapshot[], product: string,
): Map<number, { min: number; max: number }> {
  const map = new Map<number, { min: number; max: number }>();
  for (const ob of orderBook) {
    if (ob.product !== product) continue;
    const cur = map.get(ob.day);
    if (!cur) map.set(ob.day, { min: ob.timestamp, max: ob.timestamp });
    else { cur.min = Math.min(cur.min, ob.timestamp); cur.max = Math.max(cur.max, ob.timestamp); }
  }
  return map;
}

function filterOrderBook(rows: OrderBookSnapshot[], product: string, selectedDay: number | 'all'): OrderBookSnapshot[] {
  return rows.filter((ob) => ob.product === product && (selectedDay === 'all' || ob.day === selectedDay));
}

function filterTrades(trades: Trade[], product: string, selectedDay: number | 'all', dayBounds: Map<number, { min: number; max: number }>): Trade[] {
  return trades.filter((tr) => {
    if (tr.symbol !== product) return false;
    if (selectedDay === 'all') return true;
    if (tr.day !== undefined) return tr.day === selectedDay;
    const b = dayBounds.get(selectedDay);
    return b ? tr.timestamp >= b.min && tr.timestamp <= b.max : false;
  });
}

function formatChartHoverLines(pt: PlotDatum): string[] {
  const traceName = (pt.data as { name?: string } | undefined)?.name ?? '';
  const x = pt.x;
  const y = pt.y;
  const lines: string[] = [`Time: ${x}`];
  if (traceName === 'bids') {
    lines.push('Bid', `Price: ${y}`, `Volume: ${pt.customdata}`);
    return lines;
  }
  if (traceName === 'asks') {
    lines.push('Ask', `Price: ${y}`, `Volume: ${pt.customdata}`);
    return lines;
  }
  if (traceName === 'trades') {
    const cd = pt.customdata as unknown;
    const pair = Array.isArray(cd) ? cd as [string, number] : undefined;
    lines.push(pair?.[0] ?? 'Trade', `Quantity: ${pair?.[1] ?? '—'}`, `Price: ${y}`);
    return lines;
  }
  if (traceName === '_ob_hover') {
    const s = typeof pt.customdata === 'string' ? pt.customdata : undefined;
    if (s) lines.push(s);
    return lines;
  }
  if (traceName) {
    lines.push(traceName, `Value: ${y}`);
    return lines;
  }
  lines.push(`Y: ${y}`);
  return lines;
}

function mapShapeToPlotly(shape: string): string {
  const s = shape.toLowerCase().trim();
  const allowed = new Set(['circle','circle-open','square','square-open','diamond','diamond-open','cross','x','triangle-up','triangle-down','triangle-left','triangle-right','star','hexagon','hexagon2']);
  if (allowed.has(s)) return s;
  if (s === 'plus') return 'cross';
  return 'circle';
}

function downsampleStep(count: number, threshold: number): number {
  if (count <= threshold || threshold <= 0) return 1;
  return Math.max(1, Math.ceil(count / threshold));
}

function thinIndices(length: number, step: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < length; i += step) out.push(i);
  return out;
}

interface OBLevel {
  timestamp: number;
  price: number;
  volume: number;
  side: 'bid' | 'ask';
}

function extractOBLevels(
  obInView: OrderBookSnapshot[], obLevelToggles: Record<string, boolean>,
  normName: string | null, indicators: IndicatorSeries[],
  selectedProduct: string, selectedDay: number | 'all',
): OBLevel[] {
  const levels: OBLevel[] = [];
  const push = (ob: OrderBookSnapshot, price: number | undefined, volume: number | undefined, key: string, side: 'bid' | 'ask') => {
    if (price == null || !Number.isFinite(price)) return;
    if (volume == null || !Number.isFinite(volume)) return;
    if (obLevelToggles[key] === false) return;
    const y = normName ? price - normOffsetForOB(indicators, normName, selectedProduct, selectedDay, ob) : price;
    levels.push({ timestamp: ob.timestamp, price: y, volume, side });
  };
  for (const ob of obInView) {
    push(ob, ob.bidPrice1, ob.bidVolume1, 'bid1', 'bid');
    push(ob, ob.bidPrice2, ob.bidVolume2, 'bid2', 'bid');
    push(ob, ob.bidPrice3, ob.bidVolume3, 'bid3', 'bid');
    push(ob, ob.askPrice1, ob.askVolume1, 'ask1', 'ask');
    push(ob, ob.askPrice2, ob.askVolume2, 'ask2', 'ask');
    push(ob, ob.askPrice3, ob.askVolume3, 'ask3', 'ask');
  }
  return levels;
}

export interface MainChartProps {
  /** Pixel height; omit to fill parent (flex / percentage — avoids stale height after fullscreen). */
  height?: number;
  className?: string;
  /** When true, Plotly hover labels are hidden and details go to the sidebar (fullscreen). */
  externalHover?: boolean;
}

function MainChartInner({ height, className, externalHover = false }: MainChartProps) {
  const [dragMode, setDragMode] = useState<'zoom' | 'pan'>('zoom');

  const mode = useStore((s) => s.mode);
  const algoData = useStore((s) => s.algoData);
  const historicalData = useStore((s) => s.historicalData);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const selectedDay = useStore((s) => s.selectedDay);
  const showOB = useStore((s) => s.showOB);
  const obDisplayMode = useStore((s) => s.obDisplayMode);
  const obLevelToggles = useStore((s) => s.obLevelToggles);
  const normalizationIndicator = useStore((s) => s.normalizationIndicator);
  const indicators = useStore((s) => s.indicators);
  const indicatorVisibility = useStore((s) => s.indicatorVisibility);
  const tradeLabels = useStore((s) => s.tradeLabels);
  const labelToggles = useStore((s) => s.labelToggles);
  const quantityFilter = useStore((s) => s.quantityFilter);
  const xRange = useStore((s) => s.xRange);
  const hoverTimestamp = useStore((s) => s.hoverTimestamp);
  const downsampleThresholds = useStore((s) => s.downsampleThresholds);
  const setXRange = useStore((s) => s.setXRange);
  const setHoverTimestamp = useStore((s) => s.setHoverTimestamp);
  const setChartHoverDetail = useStore((s) => s.setChartHoverDetail);

  useEffect(() => {
    if (!externalHover) setChartHoverDetail(null);
  }, [externalHover, setChartHoverDetail]);

  const rawOrderBook = useMemo(() => {
    if (mode === 'algo') return algoData?.orderBook ?? [];
    return historicalData?.orderBook ?? [];
  }, [mode, algoData?.orderBook, historicalData?.orderBook]);

  const rawTrades = useMemo(() => {
    if (mode === 'algo') return algoData?.tradeHistory ?? [];
    return historicalData?.trades ?? [];
  }, [mode, algoData?.tradeHistory, historicalData?.trades]);

  const dayBounds = useMemo(() => buildDayBoundsForProduct(rawOrderBook, selectedProduct), [rawOrderBook, selectedProduct]);

  const filteredOB = useMemo(() => filterOrderBook(rawOrderBook, selectedProduct, selectedDay), [rawOrderBook, selectedProduct, selectedDay]);
  const filteredTrades = useMemo(() => filterTrades(rawTrades, selectedProduct, selectedDay, dayBounds), [rawTrades, selectedProduct, selectedDay, dayBounds]);

  const labelMap = useMemo(() => {
    const m = new Map<string, TradeLabel>();
    for (const L of tradeLabels) m.set(tradeKey(L.timestamp, L.price, L.quantity), L);
    return m;
  }, [tradeLabels]);

  const tradesQtyFiltered = useMemo(() => {
    const { min, max } = quantityFilter;
    return filteredTrades.filter((t) => t.quantity >= min && t.quantity <= max);
  }, [filteredTrades, quantityFilter]);

  const xExtent = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const ob of filteredOB) { lo = Math.min(lo, ob.timestamp); hi = Math.max(hi, ob.timestamp); }
    for (const t of tradesQtyFiltered) { lo = Math.min(lo, t.timestamp); hi = Math.max(hi, t.timestamp); }
    if (!Number.isFinite(lo)) return null;
    return [lo, hi] as [number, number];
  }, [filteredOB, tradesQtyFiltered]);

  const visibleXMin = xRange?.[0] ?? xExtent?.[0] ?? 0;
  const visibleXMax = xRange?.[1] ?? xExtent?.[1] ?? 1;

  const obMarkerSize = useMemo(() => {
    if (!xExtent) return 4;
    const full = xExtent[1] - xExtent[0];
    const vis = visibleXMax - visibleXMin;
    if (full <= 0 || vis <= 0) return 4;
    const ratio = Math.min(Math.max(full / vis, 1), 50);
    return Math.min(18, Math.max(4, Math.round(4 * Math.sqrt(ratio))));
  }, [xExtent, visibleXMin, visibleXMax]);

  const obInView = useMemo(() => filteredOB.filter((ob) => ob.timestamp >= visibleXMin && ob.timestamp <= visibleXMax), [filteredOB, visibleXMin, visibleXMax]);
  const tradesInView = useMemo(() => tradesQtyFiltered.filter((t) => t.timestamp >= visibleXMin && t.timestamp <= visibleXMax), [tradesQtyFiltered, visibleXMin, visibleXMax]);

  const normName = normalizationIndicator;

  const obLevels = useMemo(() => {
    if (!showOB || !selectedProduct) return [];
    return extractOBLevels(obInView, obLevelToggles, normName, indicators, selectedProduct, selectedDay);
  }, [showOB, selectedProduct, obInView, obLevelToggles, normName, indicators, selectedDay]);

  const obDotsTraces = useMemo((): Data[] => {
    if (obDisplayMode !== 'dots' || obLevels.length === 0) return [];
    const bids = obLevels.filter((l) => l.side === 'bid');
    const asks = obLevels.filter((l) => l.side === 'ask');
    const stepB = downsampleStep(bids.length, downsampleThresholds.ob);
    const stepA = downsampleStep(asks.length, downsampleThresholds.ob);
    const idxB = thinIndices(bids.length, stepB);
    const idxA = thinIndices(asks.length, stepA);
    const traces: Data[] = [];
    const hi = externalHover ? ('none' as const) : undefined;
    if (idxB.length > 0) {
      traces.push({
        type: 'scattergl', mode: 'markers',
        x: idxB.map((i) => bids[i].timestamp),
        y: idxB.map((i) => bids[i].price),
        customdata: idxB.map((i) => bids[i].volume),
        marker: { size: obMarkerSize, color: BID_COLOR },
        hovertemplate: 'Bid %{y} Vol: %{customdata}<extra></extra>',
        ...(hi ? { hoverinfo: hi } : {}),
        name: 'bids',
      });
    }
    if (idxA.length > 0) {
      traces.push({
        type: 'scattergl', mode: 'markers',
        x: idxA.map((i) => asks[i].timestamp),
        y: idxA.map((i) => asks[i].price),
        customdata: idxA.map((i) => asks[i].volume),
        marker: { size: obMarkerSize, color: ASK_COLOR },
        hovertemplate: 'Ask %{y} Vol: %{customdata}<extra></extra>',
        ...(hi ? { hoverinfo: hi } : {}),
        name: 'asks',
      });
    }
    return traces;
  }, [obDisplayMode, obLevels, downsampleThresholds.ob, obMarkerSize, externalHover]);

  const timestepSpacing = useMemo(() => {
    if (obInView.length < 2) return 100;
    const timestamps = new Set<number>();
    for (const ob of obInView) timestamps.add(ob.timestamp);
    const sorted = [...timestamps].sort((a, b) => a - b);
    if (sorted.length < 2) return 100;
    let totalGap = 0, count = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGap += sorted[i] - sorted[i - 1];
      count++;
    }
    return totalGap / count;
  }, [obInView]);

  const TRADE_HIST_COLOR = 'rgba(128,0,255,0.45)';
  const TRADE_HIST_LINE = '#8000FF';

  const obHistogramData = useMemo((): { shapes: Partial<Layout>['shapes']; hoverTrace: Data | null } => {
    if (obDisplayMode !== 'histogram' || obLevels.length === 0) return { shapes: [], hoverTrace: null };
    const step = downsampleStep(obLevels.length, downsampleThresholds.ob);
    const sampled = thinIndices(obLevels.length, step).map((i) => obLevels[i]);

    const barMaxWidth = timestepSpacing * 0.85;
    const MAX_VOL = 30;

    const shapes: Layout['shapes'] = [];
    const hx: number[] = [], hy: number[] = [], hcustom: string[] = [], hcolors: string[] = [];

    for (const lv of sampled) {
      const w = (Math.min(lv.volume, MAX_VOL) / MAX_VOL) * barMaxWidth;
      const color = lv.side === 'bid' ? BID_COLOR_ALPHA : ASK_COLOR_ALPHA;
      const lineColor = lv.side === 'bid' ? BID_COLOR : ASK_COLOR;
      shapes.push({
        type: 'rect', xref: 'x', yref: 'y',
        x0: lv.timestamp, x1: lv.timestamp + w,
        y0: lv.price - 0.4, y1: lv.price + 0.4,
        fillcolor: color,
        line: { width: 0.5, color: lineColor },
        layer: 'below',
      });
      hx.push(lv.timestamp + w / 2);
      hy.push(lv.price);
      hcustom.push(`${lv.side === 'bid' ? 'Bid' : 'Ask'} ${lv.price} Vol: ${lv.volume}`);
      hcolors.push(lineColor);
    }

    for (const tr of tradesInView) {
      const normY = normName
        ? tr.price - normOffsetForTrade(indicators, normName, selectedProduct, selectedDay, tr, dayBounds)
        : tr.price;
      const w = (Math.min(tr.quantity, MAX_VOL) / MAX_VOL) * barMaxWidth;
      shapes.push({
        type: 'rect', xref: 'x', yref: 'y',
        x0: tr.timestamp, x1: tr.timestamp + w,
        y0: normY - 0.4, y1: normY + 0.4,
        fillcolor: TRADE_HIST_COLOR,
        line: { width: 0.5, color: TRADE_HIST_LINE },
        layer: 'above',
      });
      hx.push(tr.timestamp + w / 2);
      hy.push(normY);
      hcustom.push(`Trade ${tr.price} Qty: ${tr.quantity}`);
      hcolors.push(TRADE_HIST_LINE);
    }

    const hoverTrace: Data = {
      type: 'scattergl', mode: 'markers',
      x: hx, y: hy,
      customdata: hcustom,
      marker: { size: 6, color: hcolors, opacity: 0 },
      hovertemplate: '%{customdata}<extra></extra>',
      ...(externalHover ? { hoverinfo: 'none' as const } : {}),
      name: '_ob_hover',
      showlegend: false,
    };

    return { shapes: shapes as Layout['shapes'], hoverTrace };
  }, [obDisplayMode, obLevels, downsampleThresholds.ob, timestepSpacing, tradesInView, normName, indicators, selectedProduct, selectedDay, dayBounds, externalHover]);

  const tradeTrace = useMemo((): Data | null => {
    if (!selectedProduct || tradesInView.length === 0) return null;
    const obSz = obMarkerSize;
    const tradeMin = Math.min(26, Math.max(8, Math.round(obSz * 1.55)));
    const tradeMax = Math.min(34, Math.max(11, Math.round(obSz * 2.05)));
    const ownSize = Math.min(40, Math.max(14, Math.round(obSz * 2.35)));

    const qtys = tradesInView.map((t) => t.quantity);
    const qMin = Math.min(...qtys);
    const qMax = Math.max(...qtys);
    const scaleSize = (q: number) => {
      if (qMax <= qMin) return (tradeMin + tradeMax) / 2;
      const t = (q - qMin) / (qMax - qMin);
      return tradeMin + t * (tradeMax - tradeMin);
    };

    const xs: number[] = [], ys: number[] = [];
    const colors: string[] = [], symbols: string[] = [], sizes: number[] = [];
    const customdata: [string, number][] = [];

    const nFull = tradesInView.length;
    const step = downsampleStep(nFull, downsampleThresholds.trades);
    const sampled = thinIndices(nFull, step).map((i) => tradesInView[i]);

    for (const tr of sampled) {
      const ownBuy = tr.buyer === 'SUBMISSION';
      const ownSell = tr.seller === 'SUBMISSION';
      const own = ownBuy || ownSell;
      const normY = normName
        ? tr.price - normOffsetForTrade(indicators, normName, selectedProduct, selectedDay, tr, dayBounds)
        : tr.price;

      xs.push(tr.timestamp);
      ys.push(normY);
      sizes.push(own ? ownSize : scaleSize(tr.quantity));

      if (own) {
        if (ownBuy) {
          colors.push('#34C759');
          symbols.push('triangle-up');
          customdata.push(['OWN BUY', tr.quantity]);
        } else {
          colors.push('#FF3B30');
          symbols.push('triangle-down');
          customdata.push(['OWN SELL', tr.quantity]);
        }
        continue;
      }

      const lab = labelMap.get(tradeKey(tr.timestamp, tr.price, tr.quantity));
      if (lab && (labelToggles[lab.label] === undefined || labelToggles[lab.label] !== false)) {
        colors.push(lab.color);
        symbols.push(mapShapeToPlotly(lab.shape));
        customdata.push([lab.label, tr.quantity]);
      } else {
        colors.push(DEFAULT_TRADE_GRAY);
        symbols.push('circle');
        customdata.push(['Trade', tr.quantity]);
      }
    }

    return {
      type: 'scattergl', mode: 'markers',
      x: xs, y: ys,
      customdata,
      marker: { color: colors, symbol: symbols, size: sizes, line: { width: 0 } },
      hovertemplate: '%{customdata[0]} %{customdata[1]} @ %{y}<extra></extra>',
      ...(externalHover ? { hoverinfo: 'none' as const } : {}),
      name: 'trades',
    };
  }, [selectedProduct, tradesInView, normName, indicators, selectedDay, dayBounds, labelMap, labelToggles, downsampleThresholds.trades, externalHover, obMarkerSize]);

  const indicatorTraces = useMemo((): Data[] => {
    const list = indicators.filter((ind) => {
      if (ind.product !== selectedProduct) return false;
      if (selectedDay === 'all') return true;
      return ind.day === selectedDay;
    }).filter((ind) => indicatorVisibility[ind.name] ?? true);
    return list.map((ind) => {
      const pts = getSeriesPoints(ind);
      const step = downsampleStep(pts.length, downsampleThresholds.ds100);
      const indices = thinIndices(pts.length, step);
      const sampled = indices.map((ix) => pts[ix]);
      const xs = sampled.map((p) => p.timestamp);
      let ys = sampled.map((p) => p.value);
      if (normName) {
        const normSeries = findNormalizationSeries(indicators, normName, selectedProduct, selectedDay);
        ys = sampled.map((p) => p.value - indicatorValueAt(normSeries, p.timestamp));
      }
      return {
        type: 'scattergl', mode: 'lines',
        x: xs, y: ys,
        line: { width: 1.5, color: indicatorColor(ind.name) },
        hovertemplate: `${ind.name}: %{y:.2f}<extra></extra>`,
        ...(externalHover ? { hoverinfo: 'none' as const } : {}),
        name: ind.name,
      } as Data;
    });
  }, [indicators, selectedProduct, selectedDay, normName, externalHover, indicatorVisibility, downsampleThresholds.ds100]);

  const data = useMemo(() => {
    const traces: Data[] = [];
    traces.push(...obDotsTraces);
    if (obHistogramData.hoverTrace) traces.push(obHistogramData.hoverTrace);
    traces.push(...indicatorTraces);
    if (tradeTrace) traces.push(tradeTrace);
    return traces;
  }, [obDotsTraces, obHistogramData.hoverTrace, indicatorTraces, tradeTrace]);

  const yAxisTitle = useMemo(() => {
    if (normName) return `Deviation from ${normName}`;
    return 'Price';
  }, [normName]);

  const yRange = useMemo((): [number, number] | null => {
    let lo = Infinity, hi = -Infinity;
    for (const lv of obLevels) {
      lo = Math.min(lo, lv.price);
      hi = Math.max(hi, lv.price);
    }
    for (const tr of tradesInView) {
      const normY = normName
        ? tr.price - normOffsetForTrade(indicators, normName, selectedProduct, selectedDay, tr, dayBounds)
        : tr.price;
      lo = Math.min(lo, normY);
      hi = Math.max(hi, normY);
    }
    if (!Number.isFinite(lo)) return null;
    const pad = Math.max((hi - lo) * 0.05, 1);
    return [lo - pad, hi + pad];
  }, [obLevels, tradesInView, normName, indicators, selectedProduct, selectedDay, dayBounds]);

  const yGridDtick = useMemo(() => {
    if (!yRange) return undefined;
    const span = yRange[1] - yRange[0];
    if (span <= 5) return 0.5;
    if (span <= 15) return 1;
    if (span <= 50) return 2;
    if (span <= 100) return 5;
    if (span <= 500) return 10;
    return undefined;
  }, [yRange]);

  const layout = useMemo((): Partial<Layout> => {
    const shapes: Layout['shapes'] = [];
    if (hoverTimestamp != null && Number.isFinite(hoverTimestamp)) {
      shapes.push({
        type: 'line', xref: 'x', yref: 'paper',
        x0: hoverTimestamp, y0: 0, x1: hoverTimestamp, y1: 1,
        line: { color: 'rgba(0,0,0,0.15)', width: 1 },
        layer: 'above',
      });
    }
    if (obHistogramData.shapes) {
      shapes.push(...(obHistogramData.shapes as typeof shapes));
    }
    return {
      uirevision: 'main',
      paper_bgcolor: BG, plot_bgcolor: BG,
      font: { color: FONT, size: 11 },
      margin: { l: 60, r: 10, t: 10, b: 52 },
      showlegend: false,
      dragmode: dragMode,
      autosize: true,
      xaxis: {
        gridcolor: GRID, zerolinecolor: GRID,
        exponentformat: 'none' as const,
        separatethousands: true,
        ...(xRange ? { range: [xRange[0], xRange[1]] as [number, number] } : {}),
      },
      yaxis: {
        title: { text: yAxisTitle },
        gridcolor: GRID, zerolinecolor: GRID,
        fixedrange: true,
        exponentformat: 'none' as const,
        separatethousands: true,
        ...(yRange ? { range: yRange, autorange: false } : { autorange: true }),
        ...(yGridDtick ? { dtick: yGridDtick } : {}),
      },
      shapes,
      hovermode: 'closest',
    };
  }, [hoverTimestamp, xRange, yAxisTitle, obHistogramData.shapes, yRange, yGridDtick, dragMode]);

  const onRelayout = useCallback(
    (event: Readonly<PlotRelayoutEvent>) => {
      const ev = event as Record<string, unknown>;
      const dm = ev['dragmode'];
      if (dm === 'pan' || dm === 'zoom') setDragMode(dm);

      const r0 = ev['xaxis.range[0]'];
      const r1 = ev['xaxis.range[1]'];
      if (typeof r0 === 'number' && typeof r1 === 'number' && Number.isFinite(r0) && Number.isFinite(r1)) {
        setXRange([r0, r1]);
        return;
      }
      if (ev['xaxis.autorange'] === true) {
        setXRange(null);
      }
    },
    [setXRange, setDragMode],
  );

  const onHover = useCallback(
    (event: Readonly<PlotHoverEvent>) => {
      const pt = event.points?.[0];
      if (pt && externalHover) setChartHoverDetail(formatChartHoverLines(pt as PlotDatum));
    },
    [setChartHoverDetail, externalHover],
  );

  const onUnhover = useCallback(() => {
    if (externalHover) setChartHoverDetail(null);
  }, [setChartHoverDetail, externalHover]);

  const onCursorX = useCallback((x: number | null) => {
    if (useStore.getState().hoverTimestamp === x) return;
    setHoverTimestamp(x);
  }, [setHoverTimestamp]);

  const onPan = useCallback(
    (deltaX: number) => {
      const lo = xRange?.[0] ?? xExtent?.[0] ?? 0;
      const hi = xRange?.[1] ?? xExtent?.[1] ?? 1;
      const width = hi - lo;
      const shift = deltaX * width * 0.001;
      setXRange([lo + shift, hi + shift]);
    },
    [xRange, xExtent, setXRange],
  );

  const onScrollZoom = useCallback(
    (deltaY: number) => {
      const lo = xRange?.[0] ?? xExtent?.[0] ?? 0;
      const hi = xRange?.[1] ?? xExtent?.[1] ?? 1;
      const width = hi - lo;
      if (dragMode === 'pan') {
        const shift = -deltaY * width * 0.001;
        setXRange([lo + shift, hi + shift]);
        return;
      }
      const center = (lo + hi) / 2;
      const factor = deltaY > 0 ? 1.08 : 0.92;
      const newWidth = width * factor;
      setXRange([center - newWidth / 2, center + newWidth / 2]);
    },
    [xRange, xExtent, setXRange, dragMode],
  );

  const config = useMemo(() => ({
    responsive: true,
    displaylogo: false,
    scrollZoom: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'] as ModeBarDefaultButtons[],
  }), []);

  const plotStyle = useMemo(
    () =>
      height !== undefined
        ? ({ width: '100%', minHeight: 0, height } as const)
        : ({ width: '100%', minHeight: 0, height: '100%' } as const),
    [height],
  );

  return (
    <Plot
      className={className}
      data={data}
      layout={layout}
      config={config}
      style={plotStyle}
      useResizeHandler
      onRelayout={onRelayout}
      onHover={onHover}
      onUnhover={onUnhover}
      onPan={onPan}
      onScrollZoom={onScrollZoom}
      onCursorX={onCursorX}
    />
  );
}

export const MainChart = memo(MainChartInner);
