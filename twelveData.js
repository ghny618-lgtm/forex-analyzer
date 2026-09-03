const fetch = require('node-fetch');
const config = require('./config');

const REST_BASE = 'https://api.twelvedata.com';

/**
 * A small typed error so the API route can turn it into a clear message
 * for a non-technical user, instead of a generic "something went wrong".
 */
class TwelveDataError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind; // 'missing_key' | 'invalid_key' | 'rate_limit' | 'credits' | 'unknown'
  }
}

function classifyError(data, httpStatus) {
  const msg = (data && data.message ? data.message : '').toLowerCase();
  const code = data && data.code;

  if (httpStatus === 401 || code === 401 || msg.includes('invalid api key') || msg.includes('apikey')) {
    return new TwelveDataError('مفتاح Twelve Data API غير صحيح. تأكد من نسخه بشكل صحيح في ملف .env', 'invalid_key');
  }
  if (httpStatus === 429 || code === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return new TwelveDataError('تم تجاوز الحد المسموح من الطلبات (Rate limit) على مفتاحك الحالي. انتظر دقيقة ثم أعد المحاولة.', 'rate_limit');
  }
  if (msg.includes('credit') || msg.includes('quota') || msg.includes('exceeded') || msg.includes('plan')) {
    return new TwelveDataError('انتهت نقاط الاستخدام (API credits) المتاحة لمفتاحك اليوم. حاول لاحقًا أو راجع خطة حسابك في Twelve Data.', 'credits');
  }
  return new TwelveDataError(`خطأ من Twelve Data: ${data?.message || 'استجابة غير متوقعة'}`, 'unknown');
}

async function fetchCandles(symbol, interval, outputsize = config.candleCount) {
  if (!config.apiKey || config.apiKey === 'ضع_مفتاحك_هنا') {
    throw new TwelveDataError(
      'لم يتم ضبط مفتاح Twelve Data API بعد. افتح ملف backend/.env (أو .env في جذر المشروع) وضع مفتاحك في TWELVE_DATA_API_KEY.',
      'missing_key'
    );
  }

  const url = `${REST_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&order=ASC&apikey=${config.apiKey}`;

  let res, data;
  try {
    res = await fetch(url, { timeout: 15000 });
    data = await res.json();
  } catch (networkErr) {
    throw new TwelveDataError('تعذّر الوصول إلى خوادم Twelve Data — تحقق من اتصال الإنترنت في السيرفر.', 'network');
  }

  // Twelve Data often returns HTTP 200 even for logical errors (bad key, rate
  // limit, out of credits) — the real signal is the "status" field.
  if (!res.ok || data.status === 'error') {
    throw classifyError(data, res.status);
  }
  if (!data.values || !Array.isArray(data.values)) {
    throw new TwelveDataError('لم يُرجع Twelve Data أي بيانات لهذا الزوج/الفريم.', 'unknown');
  }

  return data.values
    .map((v) => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : 0,
    }))
    .sort((a, b) => a.time - b.time);
}

module.exports = { fetchCandles, TwelveDataError };
