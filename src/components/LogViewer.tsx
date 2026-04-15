import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import type { LogEntry } from '../types';

function findActiveLogIndex(logs: LogEntry[], hoverTimestamp: number | null): number {
  if (hoverTimestamp === null || logs.length === 0) return -1;
  let best = -1;
  for (let i = 0; i < logs.length; i++) {
    if (logs[i].timestamp <= hoverTimestamp) best = i;
    else break;
  }
  return best;
}

function formatOrderLine(
  o: { symbol: string; price: number; quantity: number },
): string {
  const side = o.quantity > 0 ? 'BUY' : 'SELL';
  return `${o.symbol}: ${side} ${Math.abs(o.quantity)}@${o.price}`;
}

export default function LogViewer() {
  const mode = useStore((s) => s.mode);
  const algoData = useStore((s) => s.algoData);
  const selectedProduct = useStore((s) => s.selectedProduct);
  const hoverTimestamp = useStore((s) => s.hoverTimestamp);

  const logs = algoData?.logs ?? [];
  const activeIndex = useMemo(
    () => findActiveLogIndex(logs, hoverTimestamp),
    [logs, hoverTimestamp],
  );

  const entryRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = entryRefs.current[activeIndex];
    el?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [activeIndex, hoverTimestamp]);

  if (mode !== 'algo' || !algoData) return null;

  return (
    <div
      className="overflow-y-auto font-mono text-xs leading-relaxed"
      style={{ height: 200 }}
    >
      {logs.map((entry, i) => {
        const isActive = i === activeIndex;
        const ordersForProduct = entry.orders.filter((o) => o.symbol === selectedProduct);
        const posVal = entry.position[selectedProduct];

        return (
          <div
            key={`${entry.timestamp}-${i}`}
            ref={(el) => { entryRefs.current[i] = el; }}
            className="px-3 py-2"
            style={{
              backgroundColor: isActive ? '#F5F5F7' : 'transparent',
              borderBottom: '0.5px solid rgba(0,0,0,0.06)',
            }}
          >
            <div className="font-semibold text-[#1D1D1F]">TIMESTAMP: {entry.timestamp}</div>

            <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#86868B]">Orders</div>
            {ordersForProduct.map((o, j) => (
              <div key={j} className="text-[#1D1D1F]">{formatOrderLine(o)}</div>
            ))}

            <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#86868B]">Position</div>
            {selectedProduct && posVal !== undefined ? (
              <div className="text-[#1D1D1F]">{selectedProduct}: {posVal}</div>
            ) : null}

            {entry.debugLogs ? (
              <>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#86868B]">Debug</div>
                <div className="whitespace-pre-wrap break-all text-[#6E6E73]">{entry.debugLogs}</div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
