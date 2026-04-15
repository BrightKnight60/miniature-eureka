import { useMemo } from 'react';
import { useStore } from './store';
import { MainChart } from './components/MainChart';
import PnLPanel from './components/PnLPanel';
import PositionPanel from './components/PositionPanel';
import LogViewer from './components/LogViewer';
import Controls, { ControlsOptions } from './components/Controls';
import TradeFilters from './components/TradeFilters';
import DownsampleControls from './components/DownsampleControls';
import ChartPanel from './components/ChartPanel';
import type { LogEntry } from './types';

function findActiveLogIndex(logs: LogEntry[], hoverTimestamp: number | null): number {
  if (hoverTimestamp === null || logs.length === 0) return -1;
  let best = -1;
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].timestamp <= hoverTimestamp) best = i;
    else break;
  }
  return best;
}

function formatOrderLine(o: { symbol: string; price: number; quantity: number }): string {
  const side = o.quantity > 0 ? 'BUY' : 'SELL';
  return `${o.symbol}: ${side} ${Math.abs(o.quantity)}@${o.price}`;
}

export default function App() {
  const mode = useStore((s) => s.mode);
  const algoData = useStore((s) => s.algoData);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const hoverTimestamp = useStore((s) => s.hoverTimestamp);
  const chartHoverDetail = useStore((s) => s.chartHoverDetail);
  const fullscreenPanel = useStore((s) => s.fullscreenPanel);
  const statusMessages = useStore((s) => s.statusMessages);

  const showSidebar = fullscreenPanel === null;
  const logs = algoData?.logs ?? [];
  const activeLogEntry = useMemo(() => {
    const idx = findActiveLogIndex(logs, hoverTimestamp);
    return idx >= 0 ? logs[idx] : null;
  }, [logs, hoverTimestamp]);
  const activeOrders = useMemo(
    () => (activeLogEntry ? activeLogEntry.orders.filter((o) => o.symbol === selectedProduct) : []),
    [activeLogEntry, selectedProduct],
  );
  const activePosition = selectedProduct && activeLogEntry ? activeLogEntry.position[selectedProduct] : undefined;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F5F7]">
      <div className="flex min-w-0 flex-1 flex-col">
        {fullscreenPanel === null && (
          <div className="flex h-9 items-center gap-4 bg-white/80 px-5 backdrop-blur-xl"
               style={{ borderBottom: '0.5px solid rgba(0,0,0,0.12)' }}>
            <span className="text-sm font-semibold tracking-tight text-[#1D1D1F]">
              Prosperity Visualizer
            </span>
            <span className={`rounded-md bg-[#F5F5F7] px-2.5 py-0.5 font-mono text-sm font-medium tabular-nums text-[#007AFF] ${hoverTimestamp === null ? 'invisible' : ''}`}>
              {hoverTimestamp ?? 0}
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 p-2">
          <ChartPanel id="main" title="Order Book"
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-white pb-2 shadow-sm"
            style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
            {(fullscreen) => (
              <div
                className={`min-h-0 flex-1 ${fullscreen ? 'relative' : 'flex flex-col'}`}
              >
                <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${fullscreen ? 'pr-[320px]' : ''}`}>
                  <MainChart
                    className="h-full min-h-0 w-full min-w-0 flex-1"
                    externalHover={fullscreen}
                  />
                </div>
                {fullscreen && (
                    <div
                      className="fixed right-0 z-[9999] flex w-[320px] flex-col gap-3 overflow-y-auto bg-[#FAFAFA] p-3"
                      style={{
                        borderLeft: '0.5px solid rgba(0,0,0,0.08)',
                        scrollbarGutter: 'stable',
                        top: 34,
                        bottom: 0,
                      }}
                    >
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                          Options
                        </span>
                        <ControlsOptions />
                        <TradeFilters />
                      </div>

                      <div className="border-t border-black/10" />
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                          Hover
                        </span>
                        <div className="pr-1">
                          <div className="flex flex-col gap-1.5 text-xs leading-snug text-[#1D1D1F]">
                            {chartHoverDetail && chartHoverDetail.length > 0 ? (
                              chartHoverDetail.map((line, i) => (
                                <div key={i}>{line}</div>
                              ))
                            ) : (
                              <span className="text-[#86868B]">Move over the chart…</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-black/10" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                          Algo Log
                        </span>
                        <div className="pr-1 font-mono text-[11px] leading-relaxed text-[#1D1D1F]">
                          {mode !== 'algo' ? (
                            <div className="text-xs text-[#86868B]">Load algo logs to view.</div>
                          ) : activeLogEntry ? (
                            <>
                              <div className="font-semibold">TIMESTAMP: {activeLogEntry.timestamp}</div>
                              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#86868B]">Orders</div>
                              {activeOrders.length > 0 ? activeOrders.map((o, i) => (
                                <div key={i}>{formatOrderLine(o)}</div>
                              )) : (
                                <div className="text-[#86868B]">No orders</div>
                              )}
                              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#86868B]">Position</div>
                              <div>{selectedProduct}: {activePosition ?? 0}</div>
                              {activeLogEntry.debugLogs ? (
                                <>
                                  <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#86868B]">Debug</div>
                                  <div className="whitespace-pre-wrap break-all text-[#6E6E73]">{activeLogEntry.debugLogs}</div>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <div className="text-xs text-[#86868B]">No log entry at this time.</div>
                          )}
                        </div>
                      </div>
                    </div>
                )}
              </div>
            )}
          </ChartPanel>
        </div>

        {mode === 'algo' && fullscreenPanel === null && (
          <>
            <div className="flex gap-2 px-2 pb-2" style={{ minHeight: 160 }}>
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm"
                   style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <PnLPanel />
              </div>
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm"
                   style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <PositionPanel />
              </div>
            </div>
            <div className="px-2 pb-2">
              <div className="overflow-hidden rounded-xl bg-white shadow-sm"
                   style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <LogViewer />
              </div>
            </div>
          </>
        )}

        {mode === 'algo' && fullscreenPanel !== null && fullscreenPanel !== 'main' && (
          <div className="min-h-0 flex-1 p-2">
            <div className="h-full overflow-hidden rounded-xl bg-white shadow-sm"
                 style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
              <PnLPanel />
              <PositionPanel />
            </div>
          </div>
        )}
      </div>

      {showSidebar && (
        <div className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto bg-white/80 p-3 backdrop-blur-xl"
             style={{ borderLeft: '0.5px solid rgba(0,0,0,0.12)' }}>
          <Controls />
          <TradeFilters />
          <DownsampleControls />
          {statusMessages.length > 0 && (
            <div className="flex flex-col gap-0.5 rounded-lg bg-[#F5F5F7] p-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Log</span>
              <div className="max-h-32 overflow-y-auto font-mono text-[10px] leading-snug text-[#6E6E73]">
                {statusMessages.map((msg, i) => (
                  <div key={i} className={msg.startsWith('ERROR') ? 'text-[#FF3B30] font-medium' : ''}>{msg}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
