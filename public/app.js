const POLL_MS = 15000;

const state = {
  symbol: null,
  timeframe: null,
  timer: null,
};

const el = {
  symbolSelect: document.getElementById('symbolSelect'),
  timeframeRow: document.getElementById('timeframeRow'),
  statusPill: document.getElementById('statusPill'),
  errorBanner: document.getElementById('errorBanner'),
  symbolLabel: document.getElementById('symbolLabel'),
  priceLabel: document.getElementById('priceLabel'),
  signalBadge: document.getElementById('signalBadge'),
  signalReason: document.getElementById('signalReason'),
  indicatorsCard: document.getElementById('indicatorsCard'),
};

const BADGE_ICON = { BUY: '🟢', SELL: '🔴', WAIT: '🟡' };

// ---------- chart setup ----------
const chart = LightweightCharts.createChart(document.getElementById('chart'), {
  layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b94a3' },
  grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
  rightPriceScale: { borderColor: '#2a3341' },
  timeScale: { borderColor: '#2a3341', timeVisible: true },
  autoSize: true,
});
const candleSeries = chart.addCandlestickSeries({
  upColor: '#3ddc97', downColor: '#ff6b6b', borderVisible: false,
  wickUpColor: '#3ddc97', wickDownColor: '#ff6b6b',
});
const ema50Series = chart.addLineSeries({ color: '#d4a64a', lineWidth: 1.5, priceLineVisible: false });
const ema200Series = chart.addLineSeries({ color: '#5b7fd4', lineWidth: 1.5, priceLineVisible: false });

// ---------- init ----------
async function init() {
  const res = await fetch('/api/config');
  const cfg = await res.json();

  cfg.symbols.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    el.symbolSelect.appendChild(opt);
  });
  state.symbol = cfg.symbols[0];

  cfg.timeframes.forEach((tf) => {
    const btn = document.createElement('button');
    btn.className = 'pill-btn';
    btn.textContent = tf;
    btn.onclick = () => selectTimeframe(tf);
    btn.dataset.tf = tf;
    el.timeframeRow.appendChild(btn);
  });
  state.timeframe = cfg.timeframes[0];
  updateActivePills();

  el.symbolSelect.onchange = () => { state.symbol = el.symbolSelect.value; loadNow(); };

  loadNow();
  state.timer = setInterval(loadNow, POLL_MS);
}

function selectTimeframe(tf) {
  state.timeframe = tf;
  updateActivePills();
  loadNow();
}

function updateActivePills() {
  [...el.timeframeRow.children].forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tf === state.timeframe);
  });
}

async function loadNow() {
  el.symbolLabel.textContent = `${state.symbol} · ${state.timeframe}`;
  try {
    const res = await fetch(`/api/analysis?symbol=${encodeURIComponent(state.symbol)}&timeframe=${state.timeframe}`);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'خطأ غير معروف');
      setStatus('error', 'خطأ في الاتصال');
      return;
    }
    hideError();
    setStatus('live', 'بيانات حقيقية · محدَّثة الآن');
    render(data);
  } catch (err) {
    showError('تعذّر الوصول إلى السيرفر المحلي. تأكد أن الخادم (npm start) يعمل.');
    setStatus('error', 'غير متصل');
  }
}

function setStatus(cls, text) {
  el.statusPill.className = `status-pill ${cls}`;
  el.statusPill.textContent = text;
}

function showError(msg) {
  el.errorBanner.hidden = false;
  el.errorBanner.textContent = `⚠️ ${msg}`;
}
function hideError() {
  el.errorBanner.hidden = true;
}

function render(data) {
  const { candles, indicators, signal, signalSeries } = data;

  candleSeries.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
  ema50Series.setData(withoutNulls(signalSeries.map((s, i) => ({ time: s.time, value: indicatorPoint(data, i, 'ema50') }))));
  ema200Series.setData(withoutNulls(signalSeries.map((s, i) => ({ time: s.time, value: indicatorPoint(data, i, 'ema200') }))));

  candleSeries.setMarkers(buildMarkers(signalSeries));

  const last = candles[candles.length - 1];
  el.priceLabel.textContent = last ? last.close : '—';

  el.signalBadge.className = `signal-badge ${signal.signal}`;
  el.signalBadge.textContent = `${BADGE_ICON[signal.signal]} ${signal.signal}`;
  el.signalReason.textContent = signal.reason;

  renderIndicators(indicators);
}

// The backend only returns the latest indicator snapshot in `indicators`,
// but we need the full EMA history for the chart lines — recompute it
// client-side from closes for the overlay only (display purpose only;
// the authoritative values used for the BUY/SELL/WAIT decision always
// come from the backend's calculation in `signal`).
function indicatorPoint(data, i, key) {
  const period = key === 'ema50' ? 50 : 200;
  if (!indicatorPoint._cache || indicatorPoint._cacheKey !== data.symbol + data.timeframe + data.updatedAt) {
    indicatorPoint._cache = { ema50: emaFull(data.candles, 50), ema200: emaFull(data.candles, 200) };
    indicatorPoint._cacheKey = data.symbol + data.timeframe + data.updatedAt;
  }
  return indicatorPoint._cache[key][i];
}

function emaFull(candles, period) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < period) return out;
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function withoutNulls(arr) {
  return arr.filter((p) => p.value != null);
}

function buildMarkers(signalSeries) {
  const markers = [];
  let prev = 'WAIT';
  for (const point of signalSeries) {
    if (point.signal !== prev && point.signal !== 'WAIT') {
      markers.push({
        time: point.time,
        position: point.signal === 'BUY' ? 'belowBar' : 'aboveBar',
        color: point.signal === 'BUY' ? '#3ddc97' : '#ff6b6b',
        shape: point.signal === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: point.signal,
      });
    }
    prev = point.signal;
  }
  return markers;
}

function renderIndicators(ind) {
  const rows = [
    ['EMA 50', fmt(ind.ema50)],
    ['EMA 200', fmt(ind.ema200)],
    ['RSI 14', fmt(ind.rsi14)],
    ['MACD', ind.macd ? `${fmt(ind.macd.MACD)} / ${fmt(ind.macd.signal)}` : '—'],
    ['MACD Histogram', ind.macd ? fmt(ind.macd.histogram) : '—'],
    ['ATR 14', fmt(ind.atr14)],
  ];
  el.indicatorsCard.innerHTML = rows
    .map(([name, value]) => `<div class="ind-row"><span class="ind-name">${name}</span><span class="ind-value">${value}</span></div>`)
    .join('');
}

function fmt(n) {
  return n == null ? '—' : (Math.round(n * 100000) / 100000).toString();
}

init();
