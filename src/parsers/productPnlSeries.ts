import type { OrderBookSnapshot } from '../types';

/** Per-timestep simulator PnL for one product from order-book rows (`profit_and_loss`). */
export function extractProductPnlSeries(
  orderBook: OrderBookSnapshot[],
  product: string,
): { timestamp: number; value: number }[] {
  if (!product) return [];
  const lastByTs = new Map<number, number>();
  for (const o of orderBook) {
    if (o.product !== product) continue;
    const v = o.profitAndLoss;
    if (v == null || !Number.isFinite(v)) continue;
    lastByTs.set(o.timestamp, v);
  }
  const tsSorted = [...lastByTs.keys()].sort((a, b) => a - b);
  return tsSorted.map((t) => ({ timestamp: t, value: lastByTs.get(t)! }));
}
