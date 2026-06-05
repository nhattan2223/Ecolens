const Chart = window.Chart;

let _barChartInstance = null;
const _historyChartInstances = {};

function dataLabelPlugin(opts) {
  const { color, highlightColor, highlightYear, highlightDec, dec } = opts;
  return {
    id: 'dataLabels',
    afterDraw(chart) {
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0].data;

      meta.data.forEach((bar, i) => {
        const val = data[i];
        if (val == null) return;
        const isActive = chart.data.labels[i] == highlightYear;
        const fillColor = isActive ? (highlightColor || color) : color;
        const font = isActive
          ? 'bold 11px Orbitron, sans-serif'
          : '9px Rajdhani, sans-serif';
        const d = isActive && highlightDec != null ? highlightDec : (dec || 1);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = font;
        ctx.fillStyle = fillColor;
        ctx.fillText(val.toFixed(d), bar.x, bar.y - 4);
      });
    },
  };
}

export function buildBarChart(canvas, layer, highlightYear, data) {
  if (!canvas || !data || !data[layer]) return;

  if (_barChartInstance) {
    _barChartInstance.destroy();
    _barChartInstance = null;
  }

  const layerData = data[layer];
  const validPairs = layerData.years
    .map((year, i) => ({ year, val: layerData.values[i] }))
    .filter(d => d.val !== null);

  if (!validPairs.length) return;

  const minVal = Math.min(...validPairs.map(d => d.val));
  const maxVal = Math.max(...validPairs.map(d => d.val));
  const padV = (maxVal - minVal) * 0.22 || 1;
  const yMin = Math.max(0, minVal - padV);
  const yMax = maxVal + padV;

  const color = layerData.color;
  const ctx = canvas.getContext('2d');

  _barChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: validPairs.map(d => d.year),
      datasets: [{
        data: validPairs.map(d => d.val),
        backgroundColor: validPairs.map(d =>
          d.year === highlightYear ? color : color + '44'
        ),
        borderColor: validPairs.map(d =>
          d.year === highlightYear ? color : color + '88'
        ),
        borderWidth: validPairs.map(d => d.year === highlightYear ? 2 : 1),
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.72,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { family: 'Rajdhani, sans-serif', size: 10 },
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.07)' },
          min: yMin,
          max: yMax,
          ticks: {
            color: 'rgba(255,255,255,0.38)',
            font: { family: 'Rajdhani, sans-serif', size: 10 },
            maxTicksLimit: 6,
            callback: function(val) {
              const dec = layer === 'temperature' ? 2 : 1;
              return val.toFixed(dec);
            },
          },
        },
      },
    },
    plugins: [dataLabelPlugin({
      color: 'rgba(255,255,255,0.42)',
      highlightColor: color,
      highlightYear: highlightYear,
      dec: layer === 'temperature' ? 2 : 1,
    })],
  });
}

export function drawHistoryCanvas(canvas, pairs, cfg) {
  if (!canvas) return;

  const key = cfg.id;
  if (_historyChartInstances[key]) {
    _historyChartInstances[key].destroy();
    delete _historyChartInstances[key];
  }

  const defined = pairs.filter(p => p.val !== null);
  if (!defined.length) return;

  const minVal = Math.min(...defined.map(p => p.val));
  const maxVal = Math.max(...defined.map(p => p.val));
  const padV = (maxVal - minVal) * 0.22 || 1;
  const yMin = minVal - padV;
  const yMax = maxVal + padV;

  const color = cfg.color;
  const ctx = canvas.getContext('2d');

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: pairs.map(p => p.year),
      datasets: [{
        data: pairs.map(p => p.val),
        backgroundColor: pairs.map(p =>
          p.val !== null ? color + 'cc' : 'rgba(255,255,255,0.07)'
        ),
        borderColor: pairs.map(p =>
          p.val !== null ? color : 'rgba(255,255,255,0.07)'
        ),
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
        base: yMin,
        barPercentage: 0.68,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'rgba(255,255,255,0.42)',
            font: { family: 'Rajdhani, sans-serif', size: 9 },
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.07)' },
          min: yMin,
          max: yMax,
          ticks: {
            color: 'rgba(255,255,255,0.32)',
            font: { family: 'Rajdhani, sans-serif', size: 9 },
            maxTicksLimit: 4,
            callback: function(val) {
              return val.toFixed(1);
            },
          },
        },
      },
    },
    plugins: [dataLabelPlugin({
      color: color,
      dec: 1,
    })],
  });

  _historyChartInstances[key] = chart;
  return chart;
}
