import { useStore } from '../store';

const FIELDS = [
  { key: 'ds10', label: 'DS 10' },
  { key: 'ds100', label: 'DS 100' },
  { key: 'ob', label: 'Order Book' },
  { key: 'trades', label: 'Trades' },
] as const;

export default function DownsampleControls() {
  const downsampleThresholds = useStore((s) => s.downsampleThresholds);
  const setDownsampleThresholds = useStore((s) => s.setDownsampleThresholds);

  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Thresholds</span>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#86868B]">{label}</span>
            <input
              type="number"
              className="rounded-md bg-[#F5F5F7] px-2 py-1.5 text-[11px] font-medium text-[#1D1D1F] outline-none transition-colors focus:ring-1 focus:ring-[#007AFF]"
              value={downsampleThresholds[key]}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setDownsampleThresholds({ [key]: v });
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
