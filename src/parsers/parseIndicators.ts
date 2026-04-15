import type { IndicatorSeries } from '../types';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function splitLines(text: string): string[] {
  return stripBom(text).split(/\r?\n/).filter((line) => line.trim().length > 0);
}

/** Minimal CSV row split: commas not inside quotes (simple case). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseIndicatorCsv(text: string, product: string, day: number): IndicatorSeries[] {
  const lines = splitLines(text);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  if (header.length < 2 || header[0].toLowerCase() !== 'timestamp') return [];

  const names = header.slice(1);
  const series: IndicatorSeries[] = names.map((name) => ({
    name,
    product,
    day,
    data: [] as { timestamp: number; value: number }[],
  }));

  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    if (cells.length < header.length) continue;
    const ts = Number(cells[0]);
    if (!Number.isFinite(ts)) continue;
    for (let c = 1; c < header.length; c++) {
      const raw = cells[c]?.trim() ?? '';
      if (raw === '') continue;
      const val = Number(raw);
      if (!Number.isFinite(val)) continue;
      series[c - 1].data.push({ timestamp: ts, value: val });
    }
  }

  return series;
}
