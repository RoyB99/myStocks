// TradingView Lightweight Charts engine (v4 API).
let chartInstance = null;
let candlestickSeries = null;

function initChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[Chart] Container #${containerId} not found`);
    return;
  }
  if (typeof LightweightCharts === 'undefined') {
    container.innerHTML = '<p style="padding:24px">Chart library failed to load (CDN blocked?). Check your connection and reload.</p>';
    return;
  }

  // Destroy previous instance on re-init (e.g. hot reload)
  if (chartInstance) {
    chartInstance.remove();
    chartInstance = null;
    candlestickSeries = null;
  }

  chartInstance = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 400,
    layout: {
      background: { color: '#1e222d' },
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: '#2b2b43' },
      horzLines: { color: '#2b2b43' },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
    },
  });

  candlestickSeries = chartInstance.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  });

  window.addEventListener('resize', () => {
    if (chartInstance && container.clientWidth > 0) {
      chartInstance.applyOptions({ width: container.clientWidth });
    }
  });
}

function updateChartData(data) {
  if (!candlestickSeries) {
    console.error('[Chart] Series not initialised — call initChart() first');
    return;
  }
  if (!data || data.length === 0) {
    console.warn('[Chart] Empty dataset, nothing to render');
    return;
  }
  candlestickSeries.setData(data);
  chartInstance.timeScale().fitContent();
}
