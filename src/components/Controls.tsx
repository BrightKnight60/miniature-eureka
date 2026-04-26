import { useRef } from 'react';
import { useStore } from '../store';
import type { IndicatorSeries } from '../types';
import { parseAlgoLog, mergeAlgoLogs } from '../parsers/parseLog';
import { parseHistoricalFiles, inferSimulationDayFromFilename, type HistoricalTradeFile } from '../parsers/parseCsv';
import { parseIndicatorCsv } from '../parsers/parseIndicators';
import { parseTradeLabels } from '../parsers/parseTradeLabels';
import { indicatorColor } from '../utils/indicatorColors';

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function algoDays(data: { orderBook: { day: number }[] } | null): number[] {
  if (!data) return [];
  return [...new Set(data.orderBook.map((row) => row.day))]
    .filter((day) => Number.isFinite(day))
    .sort((a, b) => a - b);
}

const OB_KEYS = [
  ['bid1', 'Bid 1'],
  ['bid2', 'Bid 2'],
  ['bid3', 'Bid 3'],
  ['ask1', 'Ask 1'],
  ['ask2', 'Ask 2'],
  ['ask3', 'Ask 3'],
] as const;

export function ControlsOptions() {
  const mode = useStore((s) => s.mode);
  const algoData = useStore((s) => s.algoData);
  const historicalData = useStore((s) => s.historicalData);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const setSelectedProduct = useStore((s) => s.setSelectedProduct);
  const selectedDay = useStore((s) => s.selectedDay);
  const setSelectedDay = useStore((s) => s.setSelectedDay);
  const normalizationIndicator = useStore((s) => s.normalizationIndicator);
  const setNormalizationIndicator = useStore((s) => s.setNormalizationIndicator);
  const showOB = useStore((s) => s.showOB);
  const setShowOB = useStore((s) => s.setShowOB);
  const obDisplayMode = useStore((s) => s.obDisplayMode);
  const setOBDisplayMode = useStore((s) => s.setOBDisplayMode);
  const obLevelToggles = useStore((s) => s.obLevelToggles);
  const setOBLevelToggle = useStore((s) => s.setOBLevelToggle);
  const indicators = useStore((s) => s.indicators);

  const products =
    mode === 'algo' && algoData ? algoData.products
    : historicalData ? historicalData.products
    : [];

  const dayOptions: (number | 'all')[] =
    mode === 'algo'
      ? (algoDays(algoData).length > 0 ? algoDays(algoData) : [0])
      : historicalData ? [...historicalData.days, 'all'] : ['all'];

  const normOptions = ['None', ...indicators.map((i) => i.name)];

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      {/* Product */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Product</span>
        <select
          className="rounded-lg bg-[#F5F5F7] px-2.5 py-2 text-xs font-medium text-[#1D1D1F] outline-none transition-colors hover:bg-[#E8E8ED]"
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
        >
          {products.length === 0 ? (
            <option value="">—</option>
          ) : (
            products.map((p) => <option key={p} value={p}>{p}</option>)
          )}
        </select>
      </div>

      {/* Day */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Day</span>
        <div className="flex gap-0.5 rounded-lg bg-[#F5F5F7] p-0.5">
          {dayOptions.map((d) => {
            const active = selectedDay === d;
            return (
              <button key={String(d)} type="button"
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                  active ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73]'
                }`}
                onClick={() => setSelectedDay(d)}>
                {d === 'all' ? 'All' : d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Normalize */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Normalize</span>
        <select
          className="rounded-lg bg-[#F5F5F7] px-2.5 py-2 text-xs font-medium text-[#1D1D1F] outline-none transition-colors hover:bg-[#E8E8ED]"
          value={normalizationIndicator ?? 'None'}
          onChange={(e) => setNormalizationIndicator(e.target.value === 'None' ? null : e.target.value)}
        >
          {normOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* OB toggles */}
      <div className="flex flex-col gap-1.5">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showOB} onChange={(e) => setShowOB(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-[#007AFF]" />
          <span className="text-xs font-medium text-[#1D1D1F]">Order Book</span>
        </label>
        <div className="ml-5 flex gap-0.5 rounded-lg bg-[#F5F5F7] p-0.5">
          <button type="button"
            className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
              obDisplayMode === 'dots' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73]'
            }`}
            onClick={() => setOBDisplayMode('dots')}>Dots</button>
          <button type="button"
            className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
              obDisplayMode === 'histogram' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73]'
            }`}
            onClick={() => setOBDisplayMode('histogram')}>Bars</button>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pl-5">
          {OB_KEYS.map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={obLevelToggles[key] ?? true}
                onChange={(e) => setOBLevelToggle(key, e.target.checked)}
                className="h-3 w-3 rounded accent-[#007AFF]" />
              <span className="text-[11px] text-[#6E6E73]">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Controls() {
  const logInputRef = useRef<HTMLInputElement>(null);
  const historicalInputRef = useRef<HTMLInputElement>(null);
  const indicatorInputRef = useRef<HTMLInputElement>(null);
  const tradeLabelsInputRef = useRef<HTMLInputElement>(null);

  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const setAlgoData = useStore((s) => s.setAlgoData);
  const setHistoricalData = useStore((s) => s.setHistoricalData);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const setSelectedProduct = useStore((s) => s.setSelectedProduct);
  const setSelectedDay = useStore((s) => s.setSelectedDay);
  const indicators = useStore((s) => s.indicators);
  const addIndicator = useStore((s) => s.addIndicator);
  const removeIndicator = useStore((s) => s.removeIndicator);
  const indicatorVisibility = useStore((s) => s.indicatorVisibility);
  const setIndicatorVisible = useStore((s) => s.setIndicatorVisible);
  const setTradeLabels = useStore((s) => s.setTradeLabels);
  const setLabelToggle = useStore((s) => s.setLabelToggle);

  const addStatus = useStore((s) => s.addStatus);
  const setXRange = useStore((s) => s.setXRange);

  const onLoadAlgoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const fileArr = Array.from(files);
    addStatus(`Reading ${fileArr.length} algo file(s)...`);
    try {
      const parsed = [];
      for (const f of fileArr) {
        const text = await readFileAsText(f);
        addStatus(`✓ ${f.name} uploaded (${(text.length / 1024).toFixed(0)} KB)`);
        const data = parseAlgoLog(text);
        const hasLogs = data.logs.length > 0;
        const hasPnl = data.pnl.length > 0;
        addStatus(`  ${f.name}: ${hasLogs ? `${data.logs.length} log entries` : 'no logs'}, ${hasPnl ? `${data.pnl.length} PnL points` : 'no PnL'}, ${data.tradeHistory.length} trades`);
        parsed.push(data);
      }
      e.target.value = '';
      let merged = parsed[0];
      for (let i = 1; i < parsed.length; i++) merged = mergeAlgoLogs(merged, parsed[i]);
      const days = algoDays(merged);
      setAlgoData(merged);
      setMode('algo');
      setSelectedDay(days[0] ?? 0);
      setSelectedProduct(merged.products[0] ?? '');
      setXRange(null);
      addStatus(`✓ Algo data loaded: ${merged.products.join(', ')} | ${merged.orderBook.length} OB, ${merged.logs.length} logs, ${merged.pnl.length} PnL, ${merged.tradeHistory.length} trades`);
    } catch (err) {
      e.target.value = '';
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      addStatus(`ERROR: ${msg}`);
      window.alert(msg);
    }
  };

  const onLoadHistoricalCsvs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const fileArr = Array.from(files);
    addStatus(`Reading ${fileArr.length} file(s)...`);
    try {
      const named = await Promise.all(fileArr.map(async (f) => {
        const text = await readFileAsText(f);
        addStatus(`✓ ${f.name} uploaded (${(text.length / 1024).toFixed(0)} KB)`);
        return { name: f.name, text };
      }));
      e.target.value = '';
      const priceTexts: string[] = [];
      const tradeFiles: HistoricalTradeFile[] = [];
      const skipped: string[] = [];
      for (const { name, text } of named) {
        const firstLine = text.slice(0, text.indexOf('\n')).trim();
        if (firstLine.startsWith('day;')) {
          priceTexts.push(text);
          addStatus(`  ${name} → price CSV`);
        } else if (firstLine.startsWith('timestamp;')) {
          const inferred = inferSimulationDayFromFilename(name);
          tradeFiles.push({ text, day: inferred });
          addStatus(`  ${name} → trade CSV${inferred != null ? ` (day ${inferred})` : ''}`);
        } else {
          skipped.push(name);
          addStatus(`  ${name} → SKIPPED (unrecognized header: "${firstLine.slice(0, 40)}")`);
        }
      }
      if (priceTexts.length === 0) {
        addStatus('ERROR: No price CSVs found. Header must start with "day;".');
        window.alert('No price CSVs detected. Price files must have a header starting with "day;".');
        return;
      }
      if (tradeFiles.length === 0) {
        addStatus('ERROR: No trade CSVs found. Header must start with "timestamp;".');
        window.alert('No trade CSVs detected. Trade files must have a header starting with "timestamp;".');
        return;
      }
      addStatus(`Parsing ${priceTexts.length} price + ${tradeFiles.length} trade files...`);
      const data = parseHistoricalFiles(priceTexts, tradeFiles);
      const tradesMissingDay = data.trades.filter((t) => t.day === undefined).length;
      if (tradesMissingDay > 0 && data.days.length > 1) {
        addStatus(`WARNING: ${tradesMissingDay} trade row(s) have no simulation day. Rename trade files to include day_N (e.g. trades_round_1_day_0.csv) so trades match the selected day.`);
      }
      setHistoricalData(data);
      setMode('historical');
      if (data.products.length && !data.products.includes(selectedProduct)) {
        setSelectedProduct(data.products[0] ?? '');
      }
      setXRange(null);
      addStatus(`✓ Historical data loaded: ${data.products.join(', ')} | ${data.orderBook.length} OB rows, ${data.trades.length} trades, days: ${data.days.join(', ')}`);
    } catch (err) {
      e.target.value = '';
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      addStatus(`ERROR: ${msg}`);
      window.alert(msg);
    }
  };

  const onLoadIndicators = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const product = window.prompt('Product symbol:', selectedProduct || '')?.trim();
    if (product === undefined) { e.target.value = ''; return; }
    if (!product) { e.target.value = ''; window.alert('Product is required.'); return; }
    const dayStr = window.prompt('Day (number):', '0');
    if (dayStr === null) { e.target.value = ''; return; }
    const day = Number(dayStr);
    if (!Number.isFinite(day)) { e.target.value = ''; window.alert('Invalid day.'); return; }
    try {
      const text = await readFileAsText(file);
      e.target.value = '';
      addStatus(`✓ ${file.name} uploaded (${(text.length / 1024).toFixed(0)} KB)`);
      const seriesList = parseIndicatorCsv(text, product, day);
      for (const s of seriesList) addIndicator(s);
      addStatus(`✓ Indicators loaded: ${seriesList.map(s => s.name).join(', ')} (${product}, day ${day})`);
    } catch (err) {
      e.target.value = '';
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      addStatus(`ERROR loading indicators: ${msg}`);
      window.alert(msg);
    }
  };

  const onLoadTradeLabels = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      e.target.value = '';
      addStatus(`✓ ${file.name} uploaded (${(text.length / 1024).toFixed(0)} KB)`);
      const labels = parseTradeLabels(text);
      setTradeLabels(labels);
      const seen = new Set<string>();
      for (const row of labels) {
        if (seen.has(row.label)) continue;
        seen.add(row.label);
        setLabelToggle(row.label, true);
      }
      addStatus(`✓ Trade labels loaded: ${labels.length} labels, types: ${[...seen].join(', ')}`);
    } catch (err) {
      e.target.value = '';
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      addStatus(`ERROR loading trade labels: ${msg}`);
      window.alert(msg);
    }
  };

  const segBtn = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
      active
        ? 'bg-white text-[#1D1D1F] shadow-sm'
        : 'text-[#6E6E73] hover:text-[#1D1D1F]'
    }`;

  const loadBtn = 'w-full rounded-lg bg-[#F5F5F7] px-3 py-2 text-left text-xs font-medium text-[#1D1D1F] transition-colors hover:bg-[#E8E8ED] active:bg-[#D1D1D6]';

  return (
    <div className="flex flex-col gap-4 text-[12px]">
      {/* Mode toggle */}
      <div className="flex gap-0.5 rounded-lg bg-[#F5F5F7] p-0.5">
        <button type="button" className={segBtn(mode === 'algo')}
          onClick={() => { setMode('algo'); setSelectedDay(0); }}>
          Algo Log
        </button>
        <button type="button" className={segBtn(mode === 'historical')}
          onClick={() => setMode('historical')}>
          Historical
        </button>
      </div>

      {/* File loaders */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Load Data</span>
        <input ref={logInputRef} type="file" accept=".log,.json,application/json" multiple className="hidden" onChange={onLoadAlgoFiles} />
        <button type="button" className={loadBtn} onClick={() => logInputRef.current?.click()}>
          Algo Files (.log + .json)
        </button>
        <input ref={historicalInputRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={onLoadHistoricalCsvs} />
        <button type="button" className={loadBtn} onClick={() => historicalInputRef.current?.click()}>
          Historical CSVs
        </button>
        <input ref={indicatorInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onLoadIndicators} />
        <button type="button" className={loadBtn} onClick={() => indicatorInputRef.current?.click()}>
          Indicators CSV
        </button>
        <input ref={tradeLabelsInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onLoadTradeLabels} />
        <button type="button" className={loadBtn} onClick={() => tradeLabelsInputRef.current?.click()}>
          Trade Labels CSV
        </button>
      </div>
      <ControlsOptions />

      {/* Indicators */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Indicators</span>
        {indicators.length === 0 ? (
          <p className="text-[11px] text-[#AEAEB2]">None loaded</p>
        ) : (
          <ul className="max-h-32 space-y-1 overflow-y-auto">
            {indicators.map((ind: IndicatorSeries) => (
              <li key={`${ind.name}-${ind.product}-${ind.day}`}
                className="flex items-center justify-between rounded-lg bg-[#F5F5F7] px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: indicatorColor(ind.name) }} />
                  <span className="truncate text-[11px] font-medium text-[#1D1D1F]">{ind.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <label className="flex cursor-pointer items-center gap-1 text-[10px] text-[#6E6E73]">
                    <input
                      type="checkbox"
                      checked={indicatorVisibility[ind.name] ?? true}
                      onChange={(e) => setIndicatorVisible(ind.name, e.target.checked)}
                      className="h-3 w-3 rounded accent-[#007AFF]"
                    />
                    Show
                  </label>
                  <button type="button"
                    className="shrink-0 px-1 text-[#AEAEB2] transition-colors hover:text-[#FF3B30]"
                    onClick={() => removeIndicator(ind.name)}>
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
