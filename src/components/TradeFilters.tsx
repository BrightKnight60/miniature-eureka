import { useMemo } from 'react';
import { useStore } from '../store';

export default function TradeFilters() {
  const tradeLabels = useStore((s) => s.tradeLabels);
  const labelToggles = useStore((s) => s.labelToggles);
  const setLabelToggle = useStore((s) => s.setLabelToggle);
  const setAllLabelsVisible = useStore((s) => s.setAllLabelsVisible);
  const quantityFilter = useStore((s) => s.quantityFilter);
  const setQuantityFilter = useStore((s) => s.setQuantityFilter);

  const uniqueLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of tradeLabels) {
      if (!map.has(row.label)) map.set(row.label, row.color || '#AEAEB2');
    }
    return [...map.entries()];
  }, [tradeLabels]);

  const allVisible = useMemo(() => {
    if (uniqueLabels.length === 0) return true;
    return uniqueLabels.every(([label]) => labelToggles[label] !== false);
  }, [uniqueLabels, labelToggles]);

  return (
    <div className="flex flex-col gap-3 text-[12px]">
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={allVisible}
          onChange={(e) => setAllLabelsVisible(e.target.checked)}
          className="h-3.5 w-3.5 rounded accent-[#007AFF]" />
        <span className="text-xs font-medium text-[#1D1D1F]">All Traders</span>
      </label>

      <div>
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Labels</span>
        {uniqueLabels.length === 0 ? (
          <p className="text-[11px] text-[#AEAEB2]">No trade labels loaded</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {uniqueLabels.map(([label, color]) => {
              const on = labelToggles[label] !== false;
              return (
                <button key={label} type="button" title={label}
                  className={`max-w-[110px] truncate rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                    on ? 'opacity-100 shadow-sm' : 'opacity-30'
                  }`}
                  style={{ backgroundColor: color, color: '#fff' }}
                  onClick={() => setLabelToggle(label, !on)}>
                  {label || '(empty)'}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Quantity Filter</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#86868B]">Min</span>
            <input type="number"
              className="w-16 rounded-md bg-[#F5F5F7] px-2 py-1.5 text-[11px] font-medium text-[#1D1D1F] outline-none transition-colors focus:ring-1 focus:ring-[#007AFF]"
              value={Number.isFinite(quantityFilter.min) ? quantityFilter.min : 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setQuantityFilter({ min: Number.isFinite(v) ? v : 0, max: quantityFilter.max });
              }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#86868B]">Max</span>
            <input type="number"
              className="w-16 rounded-md bg-[#F5F5F7] px-2 py-1.5 text-[11px] font-medium text-[#1D1D1F] outline-none transition-colors focus:ring-1 focus:ring-[#007AFF]"
              placeholder="∞"
              value={quantityFilter.max === Infinity ? '' : quantityFilter.max}
              onChange={(e) => {
                const raw = e.target.value.trim();
                const max = raw === '' ? Infinity : Number(raw);
                setQuantityFilter({ min: quantityFilter.min, max: Number.isFinite(max) ? max : Infinity });
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
