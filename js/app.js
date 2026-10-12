// App lifecycle, UI bindings & polling loop.
let activeSymbol = 'AAPL';
let activeInterval = '1day';
let pollingInterval = null;
let lastPrice = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Interim IP gate (js/gate.js). Aborts before any data is fetched when blocked.
  const allowed = await (window.__accessGate || Promise.resolve(true));
  if (!allowed) return;

  initChart('chartContainer');

  const symbolInput = document.getElementById('symbolInput');
  const intervalSelect = document.getElementById('intervalSelect');
  const apiKeyInput = document.getElementById('apiKeyInput');

  // Restore saved key (never committed to git)
  try {
    const params = new URLSearchParams(window.location.search);
    apiKeyInput.value = params.get('apikey') || localStorage.getItem('td_api_key') || '';
  } catch (e) { /* ignore */ }

  apiKeyInput.addEventListener('change', () => {
    setApiKey(apiKeyInput.value.trim());
    loadStockData(activeSymbol, activeInterval); // retry with new key
  });

  const submit = () => {
    const symbol = symbolInput.value.trim().toUpperCase();
    if (symbol) {
      activeSymbol = symbol;
      activeInterval = intervalSelect.value;
      loadStockData(activeSymbol, activeInterval);
    }
  };

  document.getElementById('loadBtn').addEventListener('click', submit);
  symbolInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  intervalSelect.addEventListener('change', () => {
    activeInterval = intervalSelect.value;
    loadStockData(activeSymbol, activeInterval);
  });

  loadStockData(activeSymbol, activeInterval);
});

async function loadStockData(symbol, interval = '1day') {
  document.getElementById('stockTitle').innerText = symbol;
  setBadge('Loading…', '');
  hideError();
  lastPrice = null;

  // 1. Fetch & Render Historical Data (cache-first inside StockAPI)
  try {
    const history = await StockAPI.getHistory(symbol, interval);
    updateChartData(history);
    setBadge('Live', '');
  } catch (err) {
    setBadge('Error', 'error');
    showError(`Could not load historical data for ${symbol}: ${err.message}`);
  }

  // 2. Fetch Initial Real-time Price
  updateRealtimePrice(symbol);

  // 3. Poll every 20s (respects Twelve Data free-tier ~8 req/min)
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => {
    updateRealtimePrice(symbol);
  }, 20000);
}

async function updateRealtimePrice(symbol) {
  // Guard against stale timers after symbol switch
  if (symbol !== activeSymbol) return;
  const quote = await StockAPI.getRealtimePrice(symbol);
  const priceEl = document.getElementById('livePrice');
  const changeEl = document.getElementById('priceChange');

  if (quote && Number.isFinite(quote.price)) {
    priceEl.innerText = `$${quote.price.toFixed(2)}`;
    if (lastPrice !== null && changeEl) {
      const diff = quote.price - lastPrice;
      changeEl.innerText = `${diff >= 0 ? '▲' : '▼'} $${Math.abs(diff).toFixed(2)}`;
      changeEl.className = diff >= 0 ? 'up' : 'down';
    }
    lastPrice = quote.price;
  } else {
    setBadge('API Rate Limited (Cached)', 'limited');
  }
}

function setBadge(text, cls) {
  const badge = document.getElementById('statusBadge');
  badge.innerText = text;
  badge.className = `badge ${cls || ''}`.trim();
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.innerText = msg;
  el.hidden = false;
}

function hideError() {
  const el = document.getElementById('errorMsg');
  el.hidden = true;
  el.innerText = '';
}
