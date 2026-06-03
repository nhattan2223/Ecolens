// ============================================================
// main.js — Điều phối trung tâm (Controller) của ứng dụng
// Nhiệm vụ: Kết nối tất cả module lại, khởi động ứng dụng,
//   quản lý trạng thái toàn cục (layer, năm, quốc gia đang chọn).
// ============================================================
'use strict'; // Bật strict mode: cấm dùng biến không khai báo, giúp bắt lỗi sớm hơn

import { GLOBAL_DATA, LAYER_YEARS, LAYER_LABELS, vietnamIslands } from './data.js';
import { buildBarChart as buildBarChartCanvas } from './chart-utils.js';
import { initSearch } from './search.js';
import { initCityPanel, showCityPanel, hideCityPanel } from './city-panel.js';
import {
  world, renderPolygons, applyGlobeTexture, applyGlobeLayout,
  resetGlobeTransform, positionTimeline, getCountryView
} from './globe-config.js';

// ── TẢI DỮ LIỆU NGOÀI ──────────────────────────────────────
// Fetch song song 2 file JSON (chạy không chặn UI)
let COUNTRY_CITIES = []; // Dữ liệu thành phố: [{ country, cities: [{name,lat,lng}] }]
async function loadJson(url, fallback) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[main.js] Could not load ${url}:`, err);
    return fallback;
  }
}

loadJson('../data/country.json', [])
  .then(d => { COUNTRY_CITIES = d; }); // Gán vào biến khi tải xong

let HIST_DATA = {}; // Dữ liệu lịch sử: { "VNM": { temp:{}, pm25:{}, forest:{} }, … }
loadJson('../data/historical_data.json', {})
  .then(d => { HIST_DATA = d; });

// ── TRẠNG THÁI TOÀN CỤC ─────────────────────────────────────
let selectedCountry      = null;  // GeoJSON Feature đang được chọn (null = chưa chọn)
let allPolygons          = [];    // Toàn bộ polygon quốc gia + đảo VN
let activeLayer          = null;  // Layer đang bật: 'temperature'|'pm25'|'forest'|null
let activeYear           = null;  // Năm đang chọn trên timeline (VD: 2015)
let _justSelectedCountry = false; // Flag ngăn globe click reset ngay sau khi chọn quốc gia

// ── HÀM TIỆN ÍCH ────────────────────────────────────────────

// Kiểm tra quốc gia đang chọn có phải Việt Nam không
// (để hiển thị đảo Hoàng Sa / Trường Sa)
function isVietnamSelected() {
  return selectedCountry &&
         selectedCountry.properties &&
         selectedCountry.properties.name === 'Vietnam';
}

// Tái vẽ tất cả polygon với trạng thái hiện tại (selectedCountry, isVietnamSelected)
function _renderPolygons() {
  renderPolygons(allPolygons, selectedCountry, isVietnamSelected, selectCountry);
}

// ============================================================
// INFO PANEL (panel biểu đồ toàn cầu – hiện khi bật layer)
// ============================================================

// ── createInfoPanel() ──
// Tạo DOM của info panel và thêm vào <body> (nếu chưa có).
// Dùng injection thay vì viết sẵn trong HTML để giữ index.html gọn.
function createInfoPanel() {
  if (document.getElementById('info-panel')) return; // Chỉ tạo 1 lần

  const panel = document.createElement('div');
  panel.id = 'info-panel';
  panel.innerHTML =
    '<div id="info-panel-inner">' +
      '<div id="info-header"><div id="info-title-row">' +
        '<span id="info-icon"></span>' +          // Emoji icon (🌡️ / 💨 / 🌳)
        '<div>' +
          '<div id="info-title"></div>' +          // Tên layer (Temperature / PM 2.5…)
          '<div id="info-subtitle"></div>' +       // Mô tả ngắn + đơn vị
        '</div>' +
      '</div></div>' +
      '<div id="chart-area"><canvas id="bar-chart-canvas"></canvas></div>' + // Vùng vẽ biểu đồ
      '<div id="info-description"></div>' +        // Đoạn mô tả dài
    '</div>';
  document.body.appendChild(panel);

  // Inject CSS cho info panel (không cần file CSS riêng, tránh request thêm)
  const s = document.createElement('style');
  s.textContent = [
    // Panel cố định bên phải, ẩn mặc định, slide in khi có class .visible
    '#info-panel{position:fixed;top:0;right:0;width:36vw;max-width:500px;height:100vh;z-index:120;pointer-events:none;opacity:0;transform:translateX(40px);transition:opacity .5s ease,transform .5s ease;display:flex;align-items:center;}',
    '#info-panel.visible{opacity:1;transform:translateX(0);pointer-events:all;}',
    '#info-panel-inner{margin:24px 20px 24px 0;background:rgba(0,0,0,0.42);border:1px solid rgba(140,255,122,0.22);border-radius:20px;padding:26px 22px 22px;backdrop-filter:blur(22px);box-shadow:-6px 0 50px rgba(0,0,0,.7),0 0 30px rgba(140,255,122,.14);width:100%;display:flex;flex-direction:column;gap:18px;max-height:calc(100vh - 48px);overflow:hidden;}',
    '#info-header{flex-shrink:0;}#info-title-row{display:flex;align-items:center;gap:14px;}',
    '#info-icon{font-size:30px;line-height:1;filter:drop-shadow(0 0 8px rgba(140,255,122,.45));}',
    '#info-title{font-family:"Rajdhani",sans-serif;font-size:17px;font-weight:700;color:#fff;letter-spacing:1px;}',
    '#info-subtitle{font-family:"Rajdhani",sans-serif;font-size:11px;color:rgba(140,255,122,.7);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;}',
    '#chart-area{flex:1;min-height:0;position:relative;}#bar-chart-canvas{width:100%;height:100%;min-height:200px;display:block;}',
    '#info-description{flex-shrink:0;font-family:"Rajdhani",sans-serif;font-size:13px;line-height:1.7;color:rgba(255,255,255,.58);border-top:1px solid rgba(140,255,122,.12);padding-top:14px;max-height:140px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(140,255,122,.2) transparent;}',
    '#info-description::-webkit-scrollbar{width:4px;}#info-description::-webkit-scrollbar-thumb{background:rgba(140,255,122,.2);border-radius:2px;}'
  ].join('');
  document.head.appendChild(s);
}

// ── buildBarChart(layer, highlightYear) ──
// Cầu nối: lấy canvas từ DOM rồi gọi hàm vẽ từ chart-utils.js
function buildBarChart(layer, highlightYear) {
  const canvas = document.getElementById('bar-chart-canvas');
  if (!canvas) return;
  buildBarChartCanvas(canvas, layer, highlightYear, GLOBAL_DATA);
}

// ── showInfoPanel(layer) ──
// Hiển thị info panel với nội dung tương ứng layer đang bật.
function showInfoPanel(layer) {
  createInfoPanel(); // Đảm bảo panel tồn tại trong DOM

  // Dữ liệu tĩnh cho từng layer
  const icons     = { temperature:'\ud83c\udf21\ufe0f', pm25:'\ud83d\udca8', forest:'\ud83c\udf33' };
  const titles    = { temperature:'Temperature', pm25:'PM 2.5', forest:'Forest Cover' };
  const subtitles = {
    temperature: 'Global Average · °C',
    pm25        : 'Global Average · <span style="text-transform:none">µg/m³</span>',
    forest      : 'Global Land Cover · %'
  };

  // Điền nội dung vào từng phần tử
  document.getElementById('info-icon').textContent   = icons[layer];
  document.getElementById('info-title').textContent  = titles[layer];
  document.getElementById('info-subtitle').innerHTML = subtitles[layer]; // innerHTML vì có <span>
  document.getElementById('info-description').textContent = GLOBAL_DATA[layer].description;

  document.getElementById('info-panel').classList.add('visible'); // Kích hoạt CSS animation

  // Vẽ biểu đồ sau 2 animation frame (đảm bảo panel đã có kích thước thực)
  requestAnimationFrame(() => requestAnimationFrame(() => buildBarChart(layer, activeYear)));
}

function hideInfoPanel() {
  const p = document.getElementById('info-panel');
  if (p) p.classList.remove('visible'); // Xoá .visible → CSS transition ẩn panel
}

// Vẽ lại biểu đồ với năm hiện tại (gọi khi năm thay đổi hoặc resize)
function refreshBarChart() {
  if (activeLayer && activeYear !== null) buildBarChart(activeLayer, activeYear);
}

// ============================================================
// LAYER CONTROL — Bật/tắt layer môi trường
// ============================================================

// ── setActiveLayer(layer) ──
// Toggle layer: nếu click layer đang bật → tắt; nếu click layer khác → bật.
function setActiveLayer(layer) {
  if (activeLayer === layer) {
    // ─ TẮT layer hiện tại ─
    activeLayer = null;
    activeYear  = null;
    document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
    hideTimeline();
    hideBadge();
    hideInfoPanel();
    document.body.classList.remove('layer-active'); // CSS dùng class này để ẩn search bar
    applyGlobeLayout(selectedCountry, null);
    applyGlobeTexture(null, null); // Trả về texture mặc định

  } else {
    // ─ BẬT layer mới ─
    activeLayer = layer;
    const years = LAYER_YEARS[layer]; // Danh sách năm của layer này
    activeYear  = years[0];           // Mặc định chọn năm đầu tiên

    // Cập nhật UI: button active, timeline, badge, info panel
    document.querySelectorAll('.layer-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.layer === layer)
    );
    rebuildTimeline(years);
    showTimeline();
    showBadge(layer);
    showInfoPanel(layer);
    document.body.classList.add('layer-active');
    applyGlobeLayout(selectedCountry, layer);
    applyGlobeTexture(layer, activeYear); // Áp texture đầu tiên của layer
  }
}

// ============================================================
// TIMELINE — Thanh trượt chọn năm
// ============================================================

function showTimeline() {
  document.getElementById('timeline-wrapper').classList.add('visible');
}
function hideTimeline() {
  document.getElementById('timeline-wrapper').classList.remove('visible');
}

// Hiển thị badge (nhãn layer đang bật ở góc trên trái)
function showBadge(layer) {
  document.getElementById('badge-text').textContent = LAYER_LABELS[layer];
  document.getElementById('active-layer-badge').classList.add('visible');
}
function hideBadge() {
  document.getElementById('active-layer-badge').classList.remove('visible');
}

// Cập nhật gradient fill của slider theo % tiến độ
// CSS custom property --pct điều khiển màu linear-gradient
function updateSliderFill(slider, val, maxVal) {
  slider.style.setProperty('--pct', (maxVal === 0 ? 0 : (val / maxVal) * 100) + '%');
}

// ── onYearChange(years, idx) ──
// Được gọi mỗi khi người dùng kéo slider hoặc click tick mark.
// Cập nhật năm hiện tại và đồng bộ mọi thứ: texture, biểu đồ, UI.
function onYearChange(years, idx) {
  activeYear = years[idx]; // Cập nhật biến trạng thái

  document.getElementById('timeline-year-display').textContent = activeYear; // Số năm to ở trên

  // Đồng bộ slider vị trí + gradient fill
  const slider = document.getElementById('year-slider');
  if (slider) {
    slider.value = idx;
    updateSliderFill(slider, idx, years.length - 1);
  }

  // Đồng bộ tick marks (chấm tròn nhỏ dưới slider)
  document.querySelectorAll('.tick-mark').forEach((t, i) =>
    t.classList.toggle('active', i === idx) // Chấm của năm đang chọn sáng lên
  );

  applyGlobeTexture(activeLayer, activeYear); // Đổi texture địa cầu
  refreshBarChart(); // Vẽ lại biểu đồ với cột năm mới nổi bật
}

// ── rebuildTimeline(years) ──
// Xây dựng lại toàn bộ timeline (tick marks + slider) khi chuyển layer.
// Mỗi layer có số năm khác nhau nên cần rebuild từ đầu.
function rebuildTimeline(years) {
  const ticksEl  = document.getElementById('tick-marks');
  const yearDisp = document.getElementById('timeline-year-display');

  ticksEl.innerHTML = ''; // Xoá tick cũ

  // Tạo tick mark cho từng năm
  years.forEach((yr, i) => {
    const tick = document.createElement('div');
    tick.className = 'tick-mark' + (i === 0 ? ' active' : ''); // Năm đầu mặc định active
    tick.innerHTML =
      '<div class="tick-dot"></div>' +
      '<div class="tick-label">' + yr + '</div>';
    tick.addEventListener('click', () => onYearChange(years, i));
    ticksEl.appendChild(tick);
  });

  // Thay thế slider cũ bằng clone (cách nhanh xoá toàn bộ event listener cũ)
  const oldSlider = document.getElementById('year-slider');
  const newSlider = oldSlider.cloneNode(true); // Sao chép node không có listener
  oldSlider.parentNode.replaceChild(newSlider, oldSlider);

  // Thiết lập thuộc tính slider
  newSlider.min   = 0;
  newSlider.max   = years.length - 1; // Số bước = số năm - 1
  newSlider.value = 0;                // Bắt đầu ở năm đầu tiên
  updateSliderFill(newSlider, 0, years.length - 1);
  yearDisp.textContent = years[0]; // Hiển thị năm đầu tiên

  // Gắn sự kiện input (kéo slider)
  newSlider.addEventListener('input', () =>
    onYearChange(years, parseInt(newSlider.value))
  );
}

// ============================================================
// GEAR BUTTON — Nút mở/đóng panel chọn layer
// ============================================================
function initGear() {
  const gearBtn    = document.getElementById('gear-btn');
  const layerPanel = document.getElementById('layer-panel');

  gearBtn.addEventListener('click', () => {
    const open = layerPanel.classList.toggle('visible'); // Toggle class visible
    gearBtn.classList.toggle('active', open); // Xoay icon gear khi mở
  });

  // Gắn sự kiện cho từng nút layer (🌡️ Temperature, 💨 PM 2.5, 🌳 Forest)
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveLayer(btn.dataset.layer));
  });
}

// ============================================================
// SELECT COUNTRY — Xử lý khi người dùng click vào một quốc gia
// ============================================================
function selectCountry(polygon) {
  // Nếu đang bật layer → không cho chọn quốc gia (2 chế độ loại trừ nhau)
  if (activeLayer) return;

  selectedCountry      = polygon;
  _justSelectedCountry = true; // Đặt flag để ngăn globe click handler chạy ngay

  // Tắt flag sau 500ms (sau khi sự kiện click đã hoàn toàn xử lý xong)
  setTimeout(() => { _justSelectedCountry = false; }, 500);

  world.controls().autoRotate = false; // Dừng tự xoay để người dùng quan sát

  document.body.classList.add('country-active'); // CSS ẩn gear button + search bar

  // Đóng layer panel nếu đang mở
  const layerPanel = document.getElementById('layer-panel');
  const gearBtn    = document.getElementById('gear-btn');
  if (layerPanel) layerPanel.classList.remove('visible');
  if (gearBtn)    gearBtn.classList.remove('active');

  applyGlobeLayout(selectedCountry, activeLayer); // Dịch globe sang trái

  // Tính góc nhìn tối ưu và animate camera đến đó trong 1.5 giây
  const view = getCountryView(polygon);
  world.pointOfView({ lat: view.lat, lng: view.lng, altitude: view.altitude }, 1500);

  _renderPolygons(); // Tô màu lại để highlight quốc gia đang chọn

  showCityPanel(polygon, COUNTRY_CITIES, HIST_DATA); // Mở city panel bên phải
}

// ============================================================
// RESET — Trả về trạng thái ban đầu (click vào không gian trống)
// ============================================================
function resetGlobe() {
  selectedCountry = null;
  document.body.classList.remove('country-active'); // Hiện lại gear + search bar
  resetGlobeTransform();                            // Đưa globe về trung tâm

  // Zoom out về góc nhìn mặc định trong 1.2 giây
  world.pointOfView({ altitude: 1.5 }, 1200);

  // Bật lại tự xoay
  world.controls().autoRotate      = true;
  world.controls().autoRotateSpeed = 0.5;

  _renderPolygons(); // Bỏ highlight quốc gia
  hideCityPanel();   // Đóng city panel

  // Xoá nội dung ô tìm kiếm
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').classList.remove('visible');
}

// ── SỰ KIỆN: Click vào globe (không phải polygon) → Reset ──
world.onGlobeClick(() => {
  if (activeLayer) return;            // Đang bật layer → bỏ qua
  if (!_justSelectedCountry) resetGlobe(); // Flag ngăn reset ngay sau khi click polygon
});

// ── SỰ KIỆN: Resize cửa sổ ──
window.addEventListener('resize', () => {
  // Căn lại vị trí timeline theo trạng thái hiện tại
  if (activeLayer && !selectedCountry) positionTimeline(0.88);
  else                                 positionTimeline(1.0);

  // Vẽ lại biểu đồ vì kích thước canvas đã thay đổi
  if (activeLayer) refreshBarChart();
});

// ============================================================
// KHỞI ĐỘNG ỨNG DỤNG
// ============================================================
// Tải GeoJSON thế giới (độ phân giải 50m – nhẹ nhưng đủ chi tiết)
loadJson('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json', null)
  .then(data => {
    if (!data) return;
    // topojson.feature chuyển đổi TopoJSON → GeoJSON FeatureCollection
    const countries = topojson.feature(data, data.objects.countries);

    // Gộp polygon quốc gia với polygon đảo VN tự định nghĩa
    allPolygons = countries.features.concat(vietnamIslands);

    _renderPolygons();                              // Vẽ tất cả polygon lên globe
    initSearch(allPolygons, selectCountry);         // Khởi tạo ô tìm kiếm
    initCityPanel();                                // Gắn event listener tab panel
    initGear();                                     // Gắn event listener gear button
  });
