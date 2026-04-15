import type { OrderBookSnapshot, ParsedHistoricalData, Trade } from '../types';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function splitLines(text: string): string[] {
  return stripBom(text).split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function parseOptionalNumber(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseOrderBookRow(cells: string[]): OrderBookSnapshot | null {
  if (cells.length < 3) return null;
  const day = Number(cells[0]);
  const timestamp = Number(cells[1]);
  const product = cells[2]?.trim() ?? '';
  if (!Number.isFinite(day) || !Number.isFinite(timestamp) || product === '') return null;

  return {
    day,
    timestamp,
    product,
    bidPrice1: parseOptionalNumber(cells[3] ?? ''),
    bidVolume1: parseOptionalNumber(cells[4] ?? ''),
    bidPrice2: parseOptionalNumber(cells[5] ?? ''),
    bidVolume2: parseOptionalNumber(cells[6] ?? ''),
    bidPrice3: parseOptionalNumber(cells[7] ?? ''),
    bidVolume3: parseOptionalNumber(cells[8] ?? ''),
    askPrice1: parseOptionalNumber(cells[9] ?? ''),
    askVolume1: parseOptionalNumber(cells[10] ?? ''),
    askPrice2: parseOptionalNumber(cells[11] ?? ''),
    askVolume2: parseOptionalNumber(cells[12] ?? ''),
    askPrice3: parseOptionalNumber(cells[13] ?? ''),
    askVolume3: parseOptionalNumber(cells[14] ?? ''),
    midPrice: parseOptionalNumber(cells[15] ?? ''),
    profitAndLoss: parseOptionalNumber(cells[16] ?? ''),
  };
}

export function parsePricesCsv(text: string): OrderBookSnapshot[] {
  const lines = splitLines(text);
  if (lines.length === 0) return [];
  const out: OrderBookSnapshot[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(';');
    const row = parseOrderBookRow(cells);
    if (row) out.push(row);
  }
  return out;
}

export function parseTradesCsv(text: string, day?: number): Trade[] {
  const lines = splitLines(text);
  if (lines.length === 0) return [];
  const out: Trade[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(';');
    if (cells.length < 7) continue;
    const timestamp = Number(cells[0]);
    const price = Number(cells[5]);
    const quantity = Number(cells[6]);
    if (!Number.isFinite(timestamp) || !Number.isFinite(price) || !Number.isFinite(quantity)) continue;
    const row: Trade = {
      timestamp,
      buyer: cells[1] ?? '',
      seller: cells[2] ?? '',
      symbol: cells[3]?.trim() ?? '',
      currency: cells[4]?.trim() ?? '',
      price,
      quantity,
    };
    if (day !== undefined) row.day = day;
    out.push(row);
  }
  return out;
}

export interface HistoricalTradeFile {
  text: string;
  /** From filename (e.g. day_0) or null to infer when only one simulation day exists. */
  day: number | null;
}

/** Match `trades_round_1_day_0.csv`, `..._day_-1...`, etc. */
export function inferSimulationDayFromFilename(name: string): number | null {
  const m = name.match(/(?:^|_)day_(-?\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseHistoricalFiles(priceTexts: string[], tradeFiles: HistoricalTradeFile[]): ParsedHistoricalData {
  const orderBook: OrderBookSnapshot[] = [];
  const trades: Trade[] = [];
  for (const t of priceTexts) {
    orderBook.push(...parsePricesCsv(t));
  }
  const daySet = new Set<number>();
  for (const o of orderBook) {
    daySet.add(o.day);
  }
  const sortedDays = [...daySet].sort((a, b) => a - b);

  for (const tf of tradeFiles) {
    let d = tf.day;
    if (d === null && sortedDays.length === 1) {
      d = sortedDays[0];
    }
    trades.push(...parseTradesCsv(tf.text, d ?? undefined));
  }
  const productSet = new Set<string>();
  for (const o of orderBook) {
    productSet.add(o.product);
  }
  const products = [...productSet].sort((a, b) => a.localeCompare(b));
  const days = sortedDays;
  return { orderBook, trades, products, days };
}
