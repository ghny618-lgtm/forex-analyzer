const { EMA, RSI, MACD, ATR } = require('technicalindicators');

/**
 * Computes EMA50, EMA200, RSI14, MACD(12,26,9) and ATR14 for the WHOLE
 * candle series and re-aligns each indicator array to the original candle
 * timestamps (the indicator libraries return shorter arrays that start
 * later, since e.g. EMA200 needs 200 closes before it produces its first
 * value). Missing points are returned as null instead of being guessed.
 */
function computeIndicatorSeries(candles) {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const n = candles.length;

  const ema50 = alignRight(EMA.calculate({ period: 50, values: closes }), n);
  const ema200 = alignRight(EMA.calculate({ period: 200, values: closes }), n);
  const rsi14 = alignRight(RSI.calculate({ period: 14, values: closes }), n);
  const macdRaw = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const macd = alignRight(macdRaw, n);
  const atr14 = alignRight(ATR.calculate({ period: 14, high: highs, low: lows, close: closes }), n);

  return candles.map((c, i) => ({
    time: c.time,
    close: c.close,
    ema50: ema50[i],
    ema200: ema200[i],
    rsi14: rsi14[i],
    macd: macd[i] || null, // { MACD, signal, histogram } | null
    atr14: atr14[i],
  }));
}

// Right-aligns a shorter indicator array against a length-n series
// (indicator values always correspond to the MOST RECENT candles).
function alignRight(shortArr, n) {
  const pad = n - shortArr.length;
  const out = new Array(n).fill(null);
  for (let i = 0; i < shortArr.length; i++) out[pad + i] = shortArr[i];
  return out;
}

module.exports = { computeIndicatorSeries };
