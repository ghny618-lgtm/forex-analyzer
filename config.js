require('dotenv').config();

// This is the ONLY module in the whole project that reads the API key from the
// environment. Every other file that needs it imports it from here.
const config = {
  apiKey: (process.env.TWELVE_DATA_API_KEY || '').trim(),
  port: parseInt(process.env.PORT || '4000', 10),

  // Fixed pair list as requested — kept in one place so the frontend and
  // backend always agree on what's available.
  symbols: [
    'EUR/USD',
    'GBP/USD',
    'USD/JPY',
    'AUD/USD',
    'USD/CAD',
    'USD/CHF',
    'NZD/USD',
  ],

  // timeframe key -> Twelve Data's native interval string (all natively
  // supported by Twelve Data's /time_series endpoint — no aggregation needed)
  timeframes: {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '1h': '1h',
    '4h': '4h',
  },

  // How long a fetched candle response stays cached in memory before the
  // next request is allowed to hit Twelve Data again. Keeps the free API
  // plan's rate limit safe even if several browser tabs are open.
  cacheTtlMs: 12000,

  candleCount: 300, // enough history for EMA200 to be meaningful
};

module.exports = config;
