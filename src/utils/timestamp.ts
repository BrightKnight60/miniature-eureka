export const SIM_TICK_SIZE = 100;

export function snapTimestampToTick(ts: number, tickSize: number = SIM_TICK_SIZE): number {
  if (!Number.isFinite(ts) || tickSize <= 0) return ts;
  return Math.round(ts / tickSize) * tickSize;
}

