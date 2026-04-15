export interface OrderBookSnapshot {
  day: number;
  timestamp: number;
  product: string;
  bidPrice1?: number;
  bidVolume1?: number;
  bidPrice2?: number;
  bidVolume2?: number;
  bidPrice3?: number;
  bidVolume3?: number;
  askPrice1?: number;
  askVolume1?: number;
  askPrice2?: number;
  askVolume2?: number;
  askPrice3?: number;
  askVolume3?: number;
  midPrice?: number;
  profitAndLoss?: number;
}

export interface Trade {
  timestamp: number;
  buyer: string;
  seller: string;
  symbol: string;
  currency: string;
  price: number;
  quantity: number;
  /** Set for historical CSV trades so day selection matches price files (timestamps repeat per day). */
  day?: number;
}

export interface TradeLabel {
  timestamp: number;
  price: number;
  quantity: number;
  label: string;
  color: string;
  shape: string;
}

export interface IndicatorSeries {
  name: string;
  product: string;
  day: number;
  data: { timestamp: number; value: number }[];
}

export interface LogEntry {
  timestamp: number;
  orders: { symbol: string; price: number; quantity: number }[];
  conversions: number;
  traderData: string;
  debugLogs: string;
  position: Record<string, number>;
  ownTrades: Trade[];
  marketTrades: Trade[];
}

export interface PnLEntry {
  timestamp: number;
  value: number;
}

export interface ParsedAlgoLog {
  submissionId: string;
  orderBook: OrderBookSnapshot[];
  logs: LogEntry[];
  tradeHistory: Trade[];
  pnl: PnLEntry[];
  products: string[];
}

export interface ParsedHistoricalData {
  orderBook: OrderBookSnapshot[];
  trades: Trade[];
  products: string[];
  days: number[];
}

export type AppMode = 'algo' | 'historical';

export interface DownsampleThresholds {
  ds10: number;
  ds100: number;
  ob: number;
  trades: number;
}
