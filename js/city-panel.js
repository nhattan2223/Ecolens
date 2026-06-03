// ============================================================
// city-panel.js — Panel thông tin thành phố (bên phải màn hình)
// Nhiệm vụ: Hiển thị dữ liệu live (thời tiết + AQI) và lịch sử
//   (biểu đồ 3 chỉ số) khi người dùng click vào một quốc gia.
// ============================================================

import { getCurrentWeather, getAirPollution } from './api.js';
import {
  AQI_LABELS, AQI_COLORS,
  findCitiesForCountry, getIsoForPolygon,
  findHistByName, HIST_YEARS, HIST_CONFIGS
} from './data.js';
import { drawHistoryCanvas } from './chart-utils.js';

// ============================================================
// HÀM: initCityPanel()
// Mục đích: Gắn event listener cho 2 tab "📡 Live" và "📊 History".
//   Gọi một lần khi ứng dụng khởi động (trong main.js).
// ============================================================
export function initCityPanel() {
  // Duyệt qua tất cả button có class .panel-tab
  document.querySelectorAll('.panel-tab').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation(); // Ngăn sự kiện click lan lên globe (tránh deselect quốc gia)
      switchPanelTab(btn.dataset.tab); // dataset.tab = giá trị thuộc tính data-tab trong HTML
    });
  });
}

// ============================================================
// HÀM: showCityPanel(polygon, countryCities, histData)
// Mục đích: Mở panel, điền tên quốc gia, tải dữ liệu live cho các
//   thành phố, và vẽ biểu đồ lịch sử.
// Tham số:
//   polygon       – GeoJSON Feature của quốc gia được click
//   countryCities – mảng từ country.json [{ country, cities: [{name,lat,lng}] }]
//   histData      – object từ historical_data.json keyed by ISO-3
// ============================================================
export function showCityPanel(polygon, countryCities, histData) {
  var panel       = document.getElementById('city-panel');
  var countryEl   = document.getElementById('city-panel-country');
  var liveSection = document.getElementById('live-section');

  // Bảo vệ: thoát nếu thiếu phần tử DOM
  if (!panel || !countryEl || !liveSection) return;

  // --- Lấy tên quốc gia từ GeoJSON properties ---
  var countryName = (polygon.properties && polygon.properties.name) || 'Unknown';

  // --- Lấy mã ISO-3 để tra dữ liệu lịch sử ---
  var iso = getIsoForPolygon(polygon); // VD: 'VNM', 'USA', 'CHN'

  // --- Hiển thị tên quốc gia lên header panel ---
  countryEl.textContent = countryName;

  // --- Xoá nội dung cũ trước khi điền mới ---
  liveSection.innerHTML = '';

  // --- Chuyển về tab Live mỗi khi mở quốc gia mới ---
  switchPanelTab('live');

  // ── PHẦN LIVE: Tìm và hiển thị dữ liệu thành phố ──
  var entry = findCitiesForCountry(polygon, countryCities);

  if (!entry || !entry.cities || !entry.cities.length) {
    // Không có dữ liệu thành phố trong country.json
    liveSection.innerHTML =
      '<div style="font-family:Rajdhani,sans-serif;font-size:13px;color:rgba(255,255,255,0.4);padding:8px 0">No city data available.</div>';
  } else {
    // Chỉ lấy tối đa 3 thành phố đầu tiên (tránh panel quá dài)
    var cities = entry.cities.slice(0, 3);

    // --- Bước 1: Tạo card "skeleton" với animation loading dots ---
    cities.forEach(function(city) {
      var card = document.createElement('div');
      card.className = 'city-card';
      // ID duy nhất cho mỗi card để cập nhật sau khi fetch xong
      card.id = 'city-card-' + city.name.replace(/\s+/g, '_'); // Thay khoảng trắng bằng _
      card.innerHTML =
        '<div class="city-card-name">' + city.name + '</div>' +
        '<div class="city-card-loading">' +
          '<div class="loading-dot"></div>' +
          '<div class="loading-dot"></div>' +
          '<div class="loading-dot"></div>' +
          '<span>Fetching data…</span>' +
        '</div>';
      liveSection.appendChild(card);
    });

    // --- Bước 2: Gọi API song song cho từng thành phố (async) ---
    cities.forEach(async function(city) {
      var cardId = 'city-card-' + city.name.replace(/\s+/g, '_');
      try {
        // Promise.all gọi 2 API đồng thời → nhanh hơn gọi tuần tự
        var results   = await Promise.all([
          getCurrentWeather(city.lat, city.lng),
          getAirPollution(city.lat, city.lng)
        ]);
        var weather   = results[0]; // { temp, cityName }
        var pollution = results[1]; // { aqi, pm2_5 }

        var card = document.getElementById(cardId);
        if (!card) return; // Card có thể đã bị xoá nếu user click quốc gia khác

        // Định dạng giá trị, dùng 'N/A' nếu API thất bại
        var temp     = weather   ? weather.temp.toFixed(1)    : 'N/A';
        var pm25     = pollution ? pollution.pm2_5.toFixed(1) : 'N/A';
        var aqi      = pollution ? pollution.aqi              : null;
        var aqiLabel = aqi ? AQI_LABELS[aqi] : 'N/A'; // VD: AQI=2 → 'Fair'
        var aqiColor = aqi ? AQI_COLORS[aqi] : 'rgba(255,255,255,0.4)';

        // --- Thay nội dung card loading bằng dữ liệu thực ---
        card.innerHTML =
          '<div class="city-card-name">' + city.name + '</div>' +
          '<div class="city-card-stats">' +
            // Nhiệt độ
            '<div class="stat-item">' +
              '<div class="stat-label">🌡 Temperature</div>' +
              '<div class="stat-value temp">' + temp + '<span class="stat-unit"> °C</span></div>' +
            '</div>' +
            // PM2.5
            '<div class="stat-item">' +
              '<div class="stat-label">💨 PM 2.5</div>' +
              '<div class="stat-value pm25">' + pm25 + '<span class="stat-unit"> µg/m³</span></div>' +
            '</div>' +
            // AQI số
            '<div class="stat-item">' +
              '<div class="stat-label">🏭 AQI Index</div>' +
              '<div class="stat-value aqi aqi-' + aqi + '">' + (aqi || 'N/A') + '</div>' +
              // CSS class aqi-1 → aqi-5 điều khiển màu sắc qua style.css
            '</div>' +
            // Nhãn mức AQI (Good / Fair / Moderate…)
            '<div class="stat-item">' +
              '<div class="stat-label">📊 Status</div>' +
              '<div class="aqi-label" style="color:' + aqiColor + ';font-size:13px;font-weight:700;font-family:Rajdhani,sans-serif;margin-top:4px">' +
                aqiLabel +
              '</div>' +
            '</div>' +
          '</div>';

      } catch(e) {
        // Nếu fetch thất bại: hiện thông báo lỗi trong card thay vì crash app
        console.error('[CityPanel]', city.name, e);
        var card = document.getElementById(cardId);
        if (card) {
          var el = card.querySelector('.city-card-loading');
          if (el) el.innerHTML =
            '<span style="color:rgba(255,100,100,0.7);font-size:11px">' +
              (e.message || e) +
            '</span>';
        }
      }
    });
  }

  // ── PHẦN HISTORY: Vẽ biểu đồ lịch sử ──
  renderHistoryCharts(iso, countryName, histData);

  // --- Hiện panel (thêm class .visible kích hoạt CSS transition) ---
  panel.classList.add('visible');
}

// ============================================================
// HÀM: hideCityPanel()
// Mục đích: Ẩn panel (xoá class .visible → CSS transition ẩn đi).
//   Gọi khi người dùng click ra ngoài globe hoặc click globe trống.
// ============================================================
export function hideCityPanel() {
  var panel = document.getElementById('city-panel');
  if (panel) panel.classList.remove('visible');
}

// ============================================================
// HÀM NỘI BỘ: switchPanelTab(tab)
// Mục đích: Chuyển đổi giữa tab 'live' và 'history'.
//   Cập nhật trạng thái active của button và hiện/ẩn section tương ứng.
// ============================================================
function switchPanelTab(tab) {
  var liveSec = document.getElementById('live-section');
  var histSec = document.getElementById('history-section');
  if (!liveSec || !histSec) return;

  // Đánh dấu tab đang active (để CSS tô viền cyan)
  document.querySelectorAll('.panel-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  if (tab === 'live') {
    liveSec.classList.remove('hidden');   // Hiện live section
    histSec.classList.remove('visible');  // Ẩn history section
  } else {
    liveSec.classList.add('hidden');      // Ẩn live section
    histSec.classList.add('visible');     // Hiện history section
  }
}

// ============================================================
// HÀM NỘI BỘ: renderHistoryCharts(iso, countryName, histData)
// Mục đích: Vẽ 3 biểu đồ canvas (nhiệt độ, PM2.5, rừng) trong tab History.
// Tham số:
//   iso         – mã ISO-3 của quốc gia (có thể null)
//   countryName – tên quốc gia (dùng để tìm fallback nếu ISO null)
//   histData    – object toàn bộ dữ liệu lịch sử từ JSON file
// ============================================================
function renderHistoryCharts(iso, countryName, histData) {
  // Tìm dữ liệu lịch sử: ưu tiên theo ISO, fallback theo tên
  var hist = (iso && histData[iso]) ? histData[iso] : findHistByName(countryName, histData);

  // Duyệt qua 3 config biểu đồ (nhiệt độ, PM2.5, rừng)
  HIST_CONFIGS.forEach(function(cfg) {
    var wrap = document.getElementById(cfg.id); // Phần tử chứa canvas
    if (!wrap) return;

    wrap.innerHTML = ''; // Xoá biểu đồ cũ

    // Lấy chuỗi dữ liệu theo key (VD: hist['VNM'].temp)
    var series = hist ? hist[cfg.key] : {};

    // Tạo mảng pairs [{ year: "'95", val: 25.3 | null }] cho từng năm trong HIST_YEARS
    var pairs = HIST_YEARS.map(function(y) {
      return {
        year: "'" + y.slice(2), // '1995' → "'95" (nhãn ngắn gọn)
        val : (series && series[y] != null) ? series[y] : null // null nếu thiếu dữ liệu
      };
    });

    // Kiểm tra có ít nhất 1 điểm dữ liệu không
    var defined = pairs.filter(function(p){ return p.val !== null; });

    if (!defined.length) {
      // Không có dữ liệu → hiện thông báo thay vì canvas trống
      var msg = document.createElement('div');
      msg.style.cssText =
        'font-family:Rajdhani,sans-serif;font-size:12px;' +
        'color:rgba(255,255,255,0.3);padding:8px 0;width:100%';
      msg.textContent = 'No data available';
      wrap.appendChild(msg);
      return;
    }

    // Tạo phần tử canvas và thêm vào DOM
    var canvas = document.createElement('canvas');
    canvas.className  = 'hist-canvas';
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    wrap.appendChild(canvas);

    // Dùng requestAnimationFrame 2 lần để đảm bảo canvas đã có layout
    // (canvas.getBoundingClientRect() cần DOM đã render xong)
    // Gọi 1 lần rAF: chờ frame render tiếp theo
    // Gọi lồng 2 lần: đảm bảo layout đã ổn định (tránh width=0)
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        drawHistoryCanvas(canvas, pairs, cfg);
      });
    });
  });
}