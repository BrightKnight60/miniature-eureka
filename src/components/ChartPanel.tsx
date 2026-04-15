import { useStore } from '../store';

interface ChartPanelProps {
  id: string;
  title: string;
  headerValue?: React.ReactNode;
  children: (fullscreen: boolean) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function ChartPanel({ id, title, headerValue, children, className, style }: ChartPanelProps) {
  const fullscreenPanel = useStore((s) => s.fullscreenPanel);
  const setFullscreenPanel = useStore((s) => s.setFullscreenPanel);
  const isFullscreen = fullscreenPanel === id;

  if (fullscreenPanel !== null && !isFullscreen) return null;

  return (
    <div
      className={isFullscreen ? 'fixed inset-0 z-50 flex flex-col bg-white' : className}
      style={isFullscreen ? undefined : style}
    >
      <div className="flex items-center justify-between px-3 py-1.5"
           style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">{title}</span>
          {headerValue ? (
            <span className="truncate font-mono text-[11px] font-medium tabular-nums text-[#1D1D1F]">
              {headerValue}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[#007AFF] transition-colors hover:bg-[#F5F5F7]"
          onClick={() => setFullscreenPanel(isFullscreen ? null : id)}
        >
          {isFullscreen ? 'Exit' : 'Expand'}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {children(isFullscreen)}
      </div>
    </div>
  );
}
