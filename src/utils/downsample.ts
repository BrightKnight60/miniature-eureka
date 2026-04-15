export interface DownsampleThresholds {
  ds10: number;
  ds100: number;
  ob: number;
  trades: number;
}

export function downsamplePoints<T extends { timestamp: number }>(
  points: T[],
  viewRange: [number, number] | null,
  threshold: number,
): T[] {
  const visible =
    viewRange === null
      ? points
      : points.filter(
          (p) =>
            p.timestamp >= viewRange[0] && p.timestamp <= viewRange[1],
        );

  const n = visible.length;
  if (n <= threshold) {
    return visible;
  }

  const stride = n <= threshold * 10 ? 10 : 100;
  const out: T[] = [];
  for (let i = 0; i < n; i += stride) {
    out.push(visible[i]);
  }
  const last = visible[n - 1];
  if (out[out.length - 1] !== last) {
    out.push(last);
  }
  return out;
}
