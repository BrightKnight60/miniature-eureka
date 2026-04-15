import { useEffect, useRef, useCallback } from 'react';
import Plotly from 'plotly.js-dist-min';
import type { Data, Layout, Config, PlotlyHTMLElement } from 'plotly.js';

type PlotlyAxisGeom = { range: unknown; _offset?: number; _length?: number };

type PlotDivInternal = HTMLDivElement & { _fullLayout?: { xaxis: PlotlyAxisGeom } };

function dataXFromClientX(gd: PlotDivInternal, clientX: number): number | null {
  const fl = gd._fullLayout;
  if (!fl?.xaxis) return null;
  const xa = fl.xaxis;
  const rng = xa.range;
  if (!Array.isArray(rng) || rng.length < 2) return null;
  const x0 = Number(rng[0]);
  const x1 = Number(rng[1]);
  if (!Number.isFinite(x0) || !Number.isFinite(x1)) return null;
  const rect = gd.getBoundingClientRect();
  const px = clientX - rect.left;
  const offset = typeof xa._offset === 'number' ? xa._offset : 0;
  const length = typeof xa._length === 'number' ? xa._length : rect.width;
  if (length <= 0) return null;
  const t = (px - offset) / length;
  const clamped = Math.min(1, Math.max(0, t));
  return x0 + clamped * (x1 - x0);
}

export interface PlotParams {
  data: Data[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  style?: React.CSSProperties;
  className?: string;
  useResizeHandler?: boolean;
  onRelayout?: (event: Readonly<Plotly.PlotRelayoutEvent>) => void;
  onHover?: (event: Readonly<Plotly.PlotHoverEvent>) => void;
  onUnhover?: (event: Readonly<Plotly.PlotMouseEvent>) => void;
  onPan?: (deltaX: number) => void;
  onScrollZoom?: (deltaY: number) => void;
  /** X in data coordinates from horizontal cursor position (main plot area); null when pointer leaves. */
  onCursorX?: (xData: number | null) => void;
}

export default function Plot({
  data, layout, config, style, className, useResizeHandler,
  onRelayout, onHover, onUnhover, onPan, onScrollZoom, onCursorX,
}: PlotParams) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listenersAttached = useRef(false);

  const onRelayoutRef = useRef(onRelayout);
  onRelayoutRef.current = onRelayout;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onUnhoverRef = useRef(onUnhover);
  onUnhoverRef.current = onUnhover;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onScrollZoomRef = useRef(onScrollZoom);
  onScrollZoomRef.current = onScrollZoom;
  const onCursorXRef = useRef(onCursorX);
  onCursorXRef.current = onCursorX;

  const attachListeners = useCallback((el: HTMLDivElement) => {
    if (listenersAttached.current) return;
    const gd = el as unknown as PlotlyHTMLElement;
    if (!gd.on) return;
    listenersAttached.current = true;

    gd.on('plotly_relayout', (event: unknown) => {
      onRelayoutRef.current?.(event as Plotly.PlotRelayoutEvent);
    });
    gd.on('plotly_hover', (event: unknown) => {
      onHoverRef.current?.(event as Plotly.PlotHoverEvent);
    });
    gd.on('plotly_unhover', (event: unknown) => {
      onUnhoverRef.current?.(event as Plotly.PlotMouseEvent);
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    Plotly.react(el, data, { ...layout } as Layout, config).then(() => {
      attachListeners(el);
    });
  }, [data, layout, config, attachListeners]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
        e.preventDefault();
        e.stopPropagation();
        onPanRef.current?.(e.deltaX);
      } else if (Math.abs(e.deltaY) > 2 && onScrollZoomRef.current) {
        e.preventDefault();
        e.stopPropagation();
        onScrollZoomRef.current(e.deltaY);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  useEffect(() => {
    if (!onCursorX) return;
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const gd = el as PlotDivInternal;

    const move = (e: MouseEvent) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = dataXFromClientX(gd, e.clientX);
        if (x !== null) onCursorXRef.current?.(x);
      });
    };

    const leave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      onCursorXRef.current?.(null);
    };

    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    };
  }, [onCursorX]);

  const handleResize = useCallback(() => {
    const el = containerRef.current;
    if (el && useResizeHandler) Plotly.Plots.resize(el);
  }, [useResizeHandler]);

  useEffect(() => {
    if (!useResizeHandler) return;
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [useResizeHandler, handleResize]);

  useEffect(() => {
    if (!useResizeHandler) return;
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const scheduleResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          Plotly.Plots.resize(el);
        } catch {
          /* graph not initialized yet */
        }
      });
    };
    scheduleResize();
    const ro = new ResizeObserver(scheduleResize);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [useResizeHandler]);

  useEffect(() => {
    return () => {
      const el = containerRef.current;
      if (el) {
        const gd = el as unknown as PlotlyHTMLElement;
        gd.removeAllListeners?.('plotly_relayout');
        gd.removeAllListeners?.('plotly_hover');
        gd.removeAllListeners?.('plotly_unhover');
        Plotly.purge(el);
      }
      listenersAttached.current = false;
    };
  }, []);

  return <div ref={containerRef} className={className} style={style} />;
}
