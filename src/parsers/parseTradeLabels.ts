import type { TradeLabel } from '../types';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function splitLines(text: string): string[] {
  return stripBom(text).split(/\r?\n/).filter((line) => line.trim().length > 0);
}

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

export function parseTradeLabels(text: string): TradeLabel[] {
  const lines = splitLines(text);
  if (lines.length < 2) return [];

  const out: TradeLabel[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    if (cells.length < 6) continue;
    const timestamp = Number(cells[0]);
    const price = Number(cells[1]);
    const quantity = Number(cells[2]);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price) || !Number.isFinite(quantity)) continue;
    out.push({
      timestamp,
      price,
      quantity,
      label: cells[3] ?? '',
      color: cells[4] ?? '',
      shape: cells[5] ?? '',
    });
  }
  return out;
}
