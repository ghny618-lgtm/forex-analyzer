const path = require('path');
const express = require('express');
const config = require('./src/config');
const { fetchCandles, TwelveDataError } = require('./src/twelveData');
const { computeIndicatorSeries } = require('./src/indicators');
const { computeSignal, computeSignalSeries } = require('./src/signal');
const { getCached, setCached } = require('./src/cache');

const app = express();

// ---- static frontend (no separate build step / no separate server) ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- config the frontend needs (never includes the API key) ----
app.get('/api/config', (req, res) => {
  res.json({ symbols: config.symbols, timeframes: Object.keys(config.timeframes) });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, apiKeyConfigured: Boolean(config.apiKey) && config.apiKey !== 'ضع_مفتاحك_هنا' });
});

// ---- main endpoint: real candles + indicators + BUY/SELL/WAIT signal ----
app.get('/api/analysis', async (req, res) => {
  const { symbol, timeframe } = req.query;

  if (!symbol || !config.symbols.includes(symbol)) {
    return res.status(400).json({ error: `الزوج غير مدعوم: ${symbol}` });
  }
  const interval = config.timeframes[timeframe];
  if (!interval) {
    return res.status(400).json({ error: `الفريم غير مدعوم: ${timeframe}` });
  }

  const cacheKey = `${symbol}|${timeframe}`;
  const cached = getCached(cacheKey, config.cacheTtlMs);
  if (cached) return res.json(cached);

  try {
    const candles = await fetchCandles(symbol, interval);
    const indicatorSeries = computeIndicatorSeries(candles);
    const signalSeries = computeSignalSeries(indicatorSeries);
    const latestIndicators = indicatorSeries[indicatorSeries.length - 1];
    const latestSignal = computeSignal(latestIndicators);

    const payload = {
      symbol,
      timeframe,
      updatedAt: Date.now(),
      candles,
      indicators: latestIndicators,
      signal: latestSignal,
      signalSeries, // used by the frontend to draw historical BUY/SELL arrows
    };
    setCached(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    if (err instanceof TwelveDataError) {
      return res.status(err.kind === 'network' ? 502 : 400).json({ error: err.message, kind: err.kind });
    }
    console.error(err);
    res.status(500).json({ error: 'خطأ غير متوقع في السيرفر.' });
  }
});

app.listen(config.port, () => {
  console.log(`\n✅ Forex Analyzer يعمل الآن على: http://localhost:${config.port}\n`);
  if (!config.apiKey || config.apiKey === 'ضع_مفتاحك_هنا') {
    console.log('⚠️  لم تضع مفتاح Twelve Data بعد — عدّل ملف .env ثم أعد التشغيل.\n');
  }
});
