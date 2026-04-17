import { create } from 'zustand';
import type {
  AppMode,
  ParsedAlgoLog,
  ParsedHistoricalData,
  IndicatorSeries,
  TradeLabel,
  DownsampleThresholds,
} from './types';
import { snapTimestampToTick } from './utils/timestamp';

interface AppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  algoData: ParsedAlgoLog | null;
  setAlgoData: (data: ParsedAlgoLog | null) => void;

  historicalData: ParsedHistoricalData | null;
  setHistoricalData: (data: ParsedHistoricalData | null) => void;

  selectedProduct: string;
  setSelectedProduct: (product: string) => void;

  selectedDay: number | 'all';
  setSelectedDay: (day: number | 'all') => void;

  hoverTimestamp: number | null;
  setHoverTimestamp: (ts: number | null) => void;

  /** Multi-line hover summary for fullscreen main chart (Plotly tooltip suppressed there). */
  chartHoverDetail: string[] | null;
  setChartHoverDetail: (lines: string[] | null) => void;

  xRange: [number, number] | null;
  setXRange: (range: [number, number] | null) => void;

  showOB: boolean;
  setShowOB: (show: boolean) => void;

  obDisplayMode: 'dots' | 'histogram';
  setOBDisplayMode: (mode: 'dots' | 'histogram') => void;

  obLevelToggles: Record<string, boolean>;
  setOBLevelToggle: (key: string, val: boolean) => void;

  normalizationIndicator: string | null;
  setNormalizationIndicator: (name: string | null) => void;

  indicators: IndicatorSeries[];
  indicatorVisibility: Record<string, boolean>;
  addIndicator: (indicator: IndicatorSeries) => void;
  removeIndicator: (name: string) => void;
  setIndicatorVisible: (name: string, visible: boolean) => void;

  tradeLabels: TradeLabel[];
  setTradeLabels: (labels: TradeLabel[]) => void;

  labelToggles: Record<string, boolean>;
  setLabelToggle: (label: string, visible: boolean) => void;
  setAllLabelsVisible: (visible: boolean) => void;

  quantityFilter: { min: number; max: number };
  setQuantityFilter: (filter: { min: number; max: number }) => void;

  downsampleThresholds: DownsampleThresholds;
  setDownsampleThresholds: (thresholds: Partial<DownsampleThresholds>) => void;

  fullscreenPanel: string | null;
  setFullscreenPanel: (panel: string | null) => void;

  statusMessages: string[];
  addStatus: (msg: string) => void;
  clearStatus: () => void;
}

export const useStore = create<AppState>((set) => ({
  mode: 'historical',
  setMode: (mode) => set({ mode }),

  algoData: null,
  setAlgoData: (algoData) => set({ algoData }),

  historicalData: null,
  setHistoricalData: (historicalData) => set({ historicalData }),

  selectedProduct: '',
  setSelectedProduct: (selectedProduct) => set({ selectedProduct }),

  selectedDay: 'all',
  setSelectedDay: (selectedDay) => set({ selectedDay }),

  hoverTimestamp: null,
  setHoverTimestamp: (hoverTimestamp) =>
    set({ hoverTimestamp: hoverTimestamp == null ? null : snapTimestampToTick(hoverTimestamp) }),

  chartHoverDetail: null,
  setChartHoverDetail: (chartHoverDetail) => set({ chartHoverDetail }),

  xRange: null,
  setXRange: (xRange) => set({ xRange }),

  showOB: true,
  setShowOB: (showOB) => set({ showOB }),

  obDisplayMode: 'dots',
  setOBDisplayMode: (obDisplayMode) => set({ obDisplayMode }),

  obLevelToggles: {
    bid1: true, bid2: true, bid3: true,
    ask1: true, ask2: true, ask3: true,
  },
  setOBLevelToggle: (key, val) =>
    set((s) => ({ obLevelToggles: { ...s.obLevelToggles, [key]: val } })),

  normalizationIndicator: null,
  setNormalizationIndicator: (normalizationIndicator) => set({ normalizationIndicator }),

  indicators: [],
  addIndicator: (indicator) =>
    set((s) => ({
      indicators: [...s.indicators.filter((i) => i.name !== indicator.name), indicator],
      indicatorVisibility: { ...s.indicatorVisibility, [indicator.name]: s.indicatorVisibility[indicator.name] ?? true },
    })),
  removeIndicator: (name) =>
    set((s) => {
      const { [name]: _removed, ...rest } = s.indicatorVisibility;
      return { indicators: s.indicators.filter((i) => i.name !== name), indicatorVisibility: rest };
    }),
  indicatorVisibility: {},
  setIndicatorVisible: (name, visible) =>
    set((s) => ({ indicatorVisibility: { ...s.indicatorVisibility, [name]: visible } })),

  tradeLabels: [],
  setTradeLabels: (tradeLabels) => set({ tradeLabels }),

  labelToggles: {},
  setLabelToggle: (label, visible) =>
    set((s) => ({ labelToggles: { ...s.labelToggles, [label]: visible } })),
  setAllLabelsVisible: (visible) =>
    set((s) => {
      const toggles: Record<string, boolean> = {};
      for (const key of Object.keys(s.labelToggles)) toggles[key] = visible;
      return { labelToggles: toggles };
    }),

  quantityFilter: { min: 0, max: Infinity },
  setQuantityFilter: (quantityFilter) => set({ quantityFilter }),

  downsampleThresholds: { ds10: 60000, ds100: 60000, ob: 5000, trades: 60000 },
  setDownsampleThresholds: (thresholds) =>
    set((s) => ({ downsampleThresholds: { ...s.downsampleThresholds, ...thresholds } })),

  fullscreenPanel: null,
  setFullscreenPanel: (fullscreenPanel) => set({ fullscreenPanel }),

  statusMessages: [],
  addStatus: (msg) => set((s) => ({ statusMessages: [...s.statusMessages.slice(-19), msg] })),
  clearStatus: () => set({ statusMessages: [] }),
}));
