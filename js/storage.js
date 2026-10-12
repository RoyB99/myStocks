// Storage Manager with Time-To-Live (TTL) handling.
// localStorage: historical time-series (persists across tabs/days).
// sessionStorage: intraday quotes (cleared when tab closes).
const Cache = {
  // Store historical daily/hourly chart data in localStorage
  setHistory(symbol, interval, data) {
    const payload = {
      timestamp: Date.now(),
      data: data
    };
    try {
      localStorage.setItem(`hist_${symbol}_${interval}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('[Cache] localStorage write failed (quota?):', e);
    }
  },

  // Returns { data, expired } or null. Stale data is returned with
  // expired=true so callers can render it while revalidating / on failure.
  getHistory(symbol, interval, maxAgeMs = 12 * 60 * 60 * 1000) { // Default 12-hour TTL
    const raw = localStorage.getItem(`hist_${symbol}_${interval}`);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data)) return null;
      if (Date.now() - parsed.timestamp > maxAgeMs) {
        return { data: parsed.data, expired: true }; // Stale cache available
      }
      return { data: parsed.data, expired: false };
    } catch (e) {
      return null;
    }
  },

  // Store intraday quote data in sessionStorage
  setQuote(symbol, quote) {
    const payload = {
      timestamp: Date.now(),
      data: quote
    };
    try {
      sessionStorage.setItem(`quote_${symbol}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('[Cache] sessionStorage write failed:', e);
    }
  },

  getQuote(symbol, maxAgeMs = 15 * 1000) { // Default 15-second TTL
    const raw = sessionStorage.getItem(`quote_${symbol}`);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return (Date.now() - parsed.timestamp < maxAgeMs) ? parsed.data : null;
    } catch (e) {
      return null;
    }
  }
};
