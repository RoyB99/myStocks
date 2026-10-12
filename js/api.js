// API client & fetch logic with cache fallback.
// Free tier: ~8 credits/min, ~800/day. History=1 credit, price=1 credit.
const BASE_URL = 'https://api.twelvedata.com';

// Key resolution order: explicit app override -> localStorage -> ?apikey= URL param -> ''.
function resolveApiKey() {
  if (typeof window !== 'undefined' && window.__TWELVE_DATA_API_KEY) return window.__TWELVE_DATA_API_KEY;
  try {
    const stored = localStorage.getItem('td_api_key');
    if (stored) return stored;
  } catch (e) { /* storage unavailable */ }
  try {
    const param = new URLSearchParams(window.location.search).get('apikey');
    if (param) return param;
  } catch (e) { /* non-browser env */ }
  return '';
}

function setApiKey(key) {
  try {
    if (key) localStorage.setItem('td_api_key', key);
    else localStorage.removeItem('td_api_key');
  } catch (e) { /* ignore */ }
}

// Twelve Data intraday datetimes look like "2026-10-09 15:30:00".
// Lightweight Charts v4 accepts "YYYY-MM-DD" for daily or
// { year, month, day, ... } / UTCTimestamp for intraday.
function toChartTime(datetime, interval) {
  if (!datetime) return datetime;
  if (interval === '1day' || !datetime.includes(' ')) {
    return datetime.split(' ')[0]; // YYYY-MM-DD
  }
  // "YYYY-MM-DD HH:mm:ss" -> UTC timestamp (Twelve Data returns ET; treat as UTC for display)
  const [d, t] = datetime.split(' ');
  const [Y, M, D] = d.split('-').map(Number);
  const [h, m, s] = (t || '00:00:00').split(':').map(Number);
  return Math.floor(Date.UTC(Y, M - 1, D, h, m, s || 0) / 1000);
}

const StockAPI = {
  get apiKey() { return resolveApiKey(); },

  // Fetch Historical Candlestick Data
  async getHistory(symbol, interval = '1day') {
    const apiKey = resolveApiKey();
    const cached = Cache.getHistory(symbol, interval);

    // Return fresh cache if available (saves API credits)
    if (cached && !cached.expired) {
      console.log(`[Cache Hit] Serving valid historical data for ${symbol}`);
      return cached.data;
    }

    if (!apiKey) {
      if (cached && cached.data) {
        console.warn('[API] No key configured, serving stale cache.');
        return cached.data;
      }
      throw new Error('Missing Twelve Data API key. Enter it in the dashboard header.');
    }

    try {
      const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=100&apikey=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      if (response.status === 429) throw new Error('API rate limit (429). Try again in a minute.');
      const data = await response.json();

      if (data.status === 'error' || data.code) {
        throw new Error(data.message || 'API Limit Reached');
      }
      if (!data.values || !Array.isArray(data.values)) {
        throw new Error('Unexpected API response (no values array)');
      }

      // Format for TradingView Lightweight Charts (chronological order)
      const formattedSeries = data.values.map(item => ({
        time: toChartTime(item.datetime, interval),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close)
      })).reverse();

      Cache.setHistory(symbol, interval, formattedSeries);
      return formattedSeries;
    } catch (err) {
      console.warn(`[API Failure] ${err.message}. Falling back to cache.`);
      if (cached && cached.data) return cached.data; // Serve stale cache on failure
      throw err;
    }
  },

  // Fetch Live Real-Time Quote
  async getRealtimePrice(symbol) {
    const cachedQuote = Cache.getQuote(symbol);
    if (cachedQuote) return cachedQuote;

    const apiKey = resolveApiKey();
    if (!apiKey) return null;

    try {
      const url = `${BASE_URL}/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      if (response.status === 429) throw new Error('Rate limited (429)');
      const data = await response.json();

      if (!data.price) throw new Error(data.message || 'Invalid price payload');

      const quote = { price: parseFloat(data.price), timestamp: Date.now() };
      Cache.setQuote(symbol, quote);
      return quote;
    } catch (err) {
      console.error('Failed to fetch live price:', err);
      return null;
    }
  }
};
