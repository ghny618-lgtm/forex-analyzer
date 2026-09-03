/**
 * Strategy exactly as specified:
 *   BUY  -> EMA50 > EMA200  AND  RSI14 > 50  AND  MACD > Signal line
 *   SELL -> EMA50 < EMA200  AND  RSI14 < 50  AND  MACD < Signal line
 *   otherwise -> WAIT
 *
 * Deterministic rule-based logic only — same inputs always give the same
 * output. This is a decision-support tool, not a guarantee of profit.
 */
function computeSignal(point) {
  const { ema50, ema200, rsi14, macd } = point;

  if (ema50 == null || ema200 == null || rsi14 == null || macd == null) {
    return {
      signal: 'WAIT',
      reason: 'لا توجد بيانات كافية بعد لحساب كل المؤشرات (خصوصًا EMA200 التي تحتاج 200 شمعة).',
    };
  }

  const emaBull = ema50 > ema200;
  const emaBear = ema50 < ema200;
  const rsiBull = rsi14 > 50;
  const rsiBear = rsi14 < 50;
  const macdBull = macd.MACD > macd.signal;
  const macdBear = macd.MACD < macd.signal;

  if (emaBull && rsiBull && macdBull) {
    return {
      signal: 'BUY',
      reason: 'EMA50 أعلى من EMA200، RSI14 أعلى من 50، وخط MACD أعلى من خط الإشارة — تأكيد صعودي من الثلاثة مؤشرات معًا.',
    };
  }
  if (emaBear && rsiBear && macdBear) {
    return {
      signal: 'SELL',
      reason: 'EMA50 أدنى من EMA200، RSI14 أدنى من 50، وخط MACD أدنى من خط الإشارة — تأكيد هبوطي من الثلاثة مؤشرات معًا.',
    };
  }

  // Explain exactly which of the 3 conditions disagree, so WAIT is never a black box.
  const parts = [];
  parts.push(`EMA50 ${emaBull ? 'أعلى' : emaBear ? 'أدنى' : 'يساوي'} EMA200`);
  parts.push(`RSI14 = ${round(rsi14)} (${rsiBull ? 'فوق 50' : rsiBear ? 'تحت 50' : '= 50'})`);
  parts.push(`MACD ${macdBull ? 'أعلى' : macdBear ? 'أدنى' : 'يساوي'} خط الإشارة`);
  return {
    signal: 'WAIT',
    reason: `المؤشرات غير متوافقة مع بعضها حاليًا: ${parts.join(' | ')}.`,
  };
}

// Runs the strategy across the whole aligned indicator series (used to place
// BUY/SELL arrows on the chart wherever the signal changes state historically).
function computeSignalSeries(indicatorSeries) {
  return indicatorSeries.map((point) => ({ time: point.time, ...computeSignal(point) }));
}

function round(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

module.exports = { computeSignal, computeSignalSeries };
