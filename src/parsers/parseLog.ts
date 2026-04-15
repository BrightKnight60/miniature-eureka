import type {
  LogEntry,
  ParsedAlgoLog,
  PnLEntry,
  Trade,
} from '../types';
import { parsePricesCsv } from './parseCsv';

function parseTradeTuple(t: unknown): Trade | null {
  if (!Array.isArray(t) || t.length < 6) return null;
  const symbol = t[0];
  const price = t[1];
  const quantity = t[2];
  const buyer = t[3];
  const seller = t[4];
  const timestamp = t[5];
  return {
    symbol: String(symbol),
    price: Number(price),
    quantity: Number(quantity),
    buyer: String(buyer ?? ''),
    seller: String(seller ?? ''),
    timestamp: Number(timestamp),
    currency: '',
  };
}

function parseTradesArray(raw: unknown): Trade[] {
  if (!Array.isArray(raw)) return [];
  const out: Trade[] = [];
  for (const item of raw) {
    const tr = parseTradeTuple(item);
    if (tr && Number.isFinite(tr.timestamp) && Number.isFinite(tr.price) && Number.isFinite(tr.quantity)) {
      out.push(tr);
    }
  }
  return out;
}

function parseOrders(raw: unknown): { symbol: string; price: number; quantity: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { symbol: string; price: number; quantity: number }[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const price = Number(row[1]);
    const quantity = Number(row[2]);
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) continue;
    out.push({
      symbol: String(row[0]),
      price,
      quantity,
    });
  }
  return out;
}

function parsePositionRecord(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function parseLambdaLog(timestamp: number, lambdaLogStr: string): LogEntry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(lambdaLogStr);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 5) return null;

  const state = parsed[0];
  if (!Array.isArray(state) || state.length < 7) return null;

  const ownTrades = parseTradesArray(state[4]);
  const marketTrades = parseTradesArray(state[5]);
  const position = parsePositionRecord(state[6]);

  const orders = parseOrders(parsed[1]);
  const convRaw = parsed[2];
  const conversions =
    typeof convRaw === 'number' && Number.isFinite(convRaw)
      ? convRaw
      : Number(convRaw);
  const safeConversions = Number.isFinite(conversions) ? conversions : 0;

  const traderData = typeof parsed[3] === 'string' ? parsed[3] : String(parsed[3] ?? '');
  const debugLogs = typeof parsed[4] === 'string' ? parsed[4] : String(parsed[4] ?? '');

  return {
    timestamp,
    orders,
    conversions: safeConversions,
    traderData,
    debugLogs,
    position,
    ownTrades,
    marketTrades,
  };
}

function parseTradeHistoryItem(raw: unknown): Trade | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const timestamp = Number(o.timestamp);
  const price = Number(o.price);
  const quantity = Number(o.quantity);
  if (!Number.isFinite(timestamp) || !Number.isFinite(price) || !Number.isFinite(quantity)) return null;
  return {
    timestamp,
    buyer: String(o.buyer ?? ''),
    seller: String(o.seller ?? ''),
    symbol: String(o.symbol ?? ''),
    currency: String(o.currency ?? ''),
    price,
    quantity,
  };
}

function parseTradeHistory(raw: unknown): Trade[] {
  if (!Array.isArray(raw)) return [];
  const out: Trade[] = [];
  for (const item of raw) {
    const tr = parseTradeHistoryItem(item);
    if (tr) out.push(tr);
  }
  return out;
}

function parseGraphLog(graphLog: unknown): PnLEntry[] {
  if (typeof graphLog !== 'string' || graphLog.trim() === '') return [];
  const stripped = graphLog.charCodeAt(0) === 0xfeff ? graphLog.slice(1) : graphLog;
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: PnLEntry[] = [];
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 2) continue;
    const ts = Number(parts[0]);
    const val = Number(parts[1]);
    if (!Number.isFinite(ts) || !Number.isFinite(val)) continue;
    out.push({ timestamp: ts, value: val });
  }
  return out;
}

function uniqueProductsFromOrderBook(orderBook: { product: string }[]): string[] {
  const s = new Set<string>();
  for (const o of orderBook) s.add(o.product);
  return [...s].sort((a, b) => a.localeCompare(b));
}

interface PortalLogRoot {
  submissionId?: unknown;
  activitiesLog?: unknown;
  logs?: unknown;
  tradeHistory?: unknown;
}

interface PortalJsonRoot {
  round?: unknown;
  activitiesLog?: unknown;
  graphLog?: unknown;
  tradeHistory?: unknown;
}

export function parseAlgoLog(text: string): ParsedAlgoLog {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const root = JSON.parse(stripped) as Record<string, unknown>;

  if ('logs' in root) {
    const data = root as PortalLogRoot;
    const submissionId = String(data.submissionId ?? '');
    const activitiesLog =
      typeof data.activitiesLog === 'string' ? data.activitiesLog : '';
    const orderBook = activitiesLog.trim() === '' ? [] : parsePricesCsv(activitiesLog);

    const logsRaw = data.logs;
    const logs: LogEntry[] = [];
    if (Array.isArray(logsRaw)) {
      for (const item of logsRaw) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
        const entry = item as Record<string, unknown>;
        const ts = Number(entry.timestamp);
        const lambdaLog = entry.lambdaLog;
        if (!Number.isFinite(ts) || typeof lambdaLog !== 'string') continue;
        const le = parseLambdaLog(ts, lambdaLog);
        if (le) logs.push(le);
      }
    }

    const tradeHistory = parseTradeHistory(data.tradeHistory);

    return {
      submissionId,
      orderBook,
      logs,
      tradeHistory,
      pnl: [],
      products: uniqueProductsFromOrderBook(orderBook),
    };
  }

  if ('round' in root) {
    const data = root as PortalJsonRoot;
    const round = data.round;
    const submissionId = round !== undefined && round !== null ? String(round) : '';

    const activitiesLog =
      typeof data.activitiesLog === 'string' ? data.activitiesLog : '';
    const orderBook = activitiesLog.trim() === '' ? [] : parsePricesCsv(activitiesLog);

    const pnl = parseGraphLog(data.graphLog);
    const tradeHistory = parseTradeHistory(data.tradeHistory);

    return {
      submissionId,
      orderBook,
      logs: [],
      tradeHistory,
      pnl,
      products: uniqueProductsFromOrderBook(orderBook),
    };
  }

  throw new Error('Unrecognized algo log format: expected portal .log (logs) or .json (round)');
}

export function mergeAlgoLogs(a: ParsedAlgoLog, b: ParsedAlgoLog): ParsedAlgoLog {
  return {
    submissionId: a.submissionId || b.submissionId,
    orderBook: a.orderBook.length > 0 ? a.orderBook : b.orderBook,
    logs: a.logs.length > 0 ? a.logs : b.logs,
    tradeHistory: a.tradeHistory.length > 0 ? a.tradeHistory : b.tradeHistory,
    pnl: a.pnl.length > 0 ? a.pnl : b.pnl,
    products: a.products.length > 0 ? a.products : b.products,
  };
}
