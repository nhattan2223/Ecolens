// ============================================================
// globe-config.js — Cấu hình và điều khiển địa cầu 3D
// Nhiệm vụ: Khởi tạo Globe.gl, quản lý texture, layout (vị trí),
//   cách vẽ polygon quốc gia, và tính góc nhìn khi chọn quốc gia.
// ============================================================
'use strict';

import { BASE_TEXTURE, BASE_BUMP, LAYER_IMAGES, vietnamIslands, isVietnamIsland } from './data.js';

// ─────────────────────────────────────────────────────────────
// KHỞI TẠO GLOBE
// ─────────────────────────────────────────────────────────────
const globeEl = document.getElementById('globe-container'); // Phần tử DOM chứa canvas 3D

// Tạo instance Globe.gl và gắn vào DOM
// Globe() trả về một hàm builder (pattern fluent/chaining):
//   .globeImageUrl()  → texture bề mặt trái đất
//   .bumpImageUrl()   → texture địa hình (tạo cảm giác nổi)
//   .backgroundColor()→ màu nền (đen = không gian vũ trụ)
//   (globeEl)         → mount globe vào phần tử DOM
export const world = Globe()
  .globeImageUrl(BASE_TEXTURE)
  .bumpImageUrl(BASE_BUMP)
  .backgroundColor('#000000')
  (globeEl);

// Đặt góc nhìn ban đầu: altitude=1.4 (xa vừa đủ thấy toàn cầu)
world.pointOfView({ altitude: 1.5});

// Bật tự động xoay và đặt tốc độ (vòng/phút, giá trị nhỏ = chậm)
world.controls().autoRotate      = true;
world.controls().autoRotateSpeed = 0.5;

// ─────────────────────────────────────────────────────────────
// HÀM: renderPolygons(allPolygons, selectedCountry, isVietnamSelected, onPolygonClick)
// Mục đích: Vẽ tất cả các polygon quốc gia lên địa cầu,
//   với màu sắc/độ nổi khác nhau tuỳ theo trạng thái (chọn/không chọn).
// Tham số:
//   allPolygons        – mảng GeoJSON Feature (quốc gia + đảo VN)
//   selectedCountry    – Feature đang được chọn (hoặc null)
//   isVietnamSelected  – hàm() trả về true nếu VN đang được chọn
//   onPolygonClick     – callback khi người dùng click vào polygon
// ─────────────────────────────────────────────────────────────
export function renderPolygons(allPolygons, selectedCountry, isVietnamSelected, onPolygonClick) {
  world
    .polygonsData(allPolygons) // Cung cấp dữ liệu GeoJSON cho Globe.gl

    // --- Màu mặt trên polygon (cap = mặt nhìn từ không gian) ---
    // Arrow function nhận từng polygon d, trả về màu RGBA string
    .polygonCapColor(d => {
      if (isVietnamIsland(d))    return isVietnamSelected() ? 'rgba(140,255,122,0.15)' : 'rgba(255,255,255,0.05)';
      if (d === selectedCountry) return 'rgba(140,255,122,0.15)'; // Green mờ nếu đang chọn
      return 'rgba(255,255,255,0.05)';  // Trắng rất mờ cho các quốc gia khác
    })

    // --- Màu cạnh bên polygon (side = chiều dày khi polygon nhô lên) ---
    .polygonSideColor(d => {
      if (isVietnamIsland(d))    return isVietnamSelected() ? 'rgba(140,255,122,0.3)' : 'rgba(255,255,255,0.05)';
      if (d === selectedCountry) return 'rgba(140,255,122,0.3)'; // Green đậm hơn mặt trên
      return 'rgba(255,255,255,0.05)';
    })

    // --- Màu viền ngoài polygon ---
    .polygonStrokeColor(d => {
      if (d === selectedCountry) return '#8cff7a'; // Viền sáng cho quốc gia đang chọn
      if (isVietnamIsland(d))    return isVietnamSelected() ? '#8cff7a' : 'rgba(0,0,0,0)'; // Ẩn viền đảo khi VN chưa chọn
      return '#111111'; // Đường viền biên giới rất tối
    })

    // --- Độ nổi của polygon (altitude = % bán kính địa cầu) ---
    // Quốc gia đang chọn / đảo VN khi chọn VN → nhô lên cao hơn
    .polygonAltitude(d => {
      if (isVietnamIsland(d))    return isVietnamSelected() ? 0.02 : 0.015;
      if (d === selectedCountry) return 0.02;  // Nhô cao hơn bình thường
      return 0.01; // Tất cả polygon đều nhô nhẹ (không bằng phẳng)
    })

    // --- Tooltip HTML hiện khi hover ---
    .polygonLabel(({ properties: d }) =>
      '<b style="font-size:14px">' + (d.name || 'Nation') + '</b>'
    )

    // --- Thời gian animation chuyển đổi polygon (ms) ---
    .polygonsTransitionDuration(300)

    // --- Gắn callback click vào từng polygon ---
    .onPolygonClick(onPolygonClick);
}

// ─────────────────────────────────────────────────────────────
// HÀM: applyGlobeTexture(activeLayer, activeYear)
// Mục đích: Thay texture địa cầu khi người dùng bật/tắt layer.
//   Nếu có layer + năm → dùng ảnh chuyên biệt (nhiệt độ/PM2.5/rừng).
//   Ngược lại → trả về texture mặc định blue marble.
// ─────────────────────────────────────────────────────────────
export function applyGlobeTexture(activeLayer, activeYear) {
  // Không có layer hoặc không có năm → texture mặc định
  if (!activeLayer || activeYear === null) {
    world.globeImageUrl(BASE_TEXTURE);
    world.bumpImageUrl(BASE_BUMP);
    return;
  }

  // Tra cứu đường dẫn ảnh từ LAYER_IMAGES[layer][year]
  const imgFile = LAYER_IMAGES[activeLayer] && LAYER_IMAGES[activeLayer][activeYear];

  if (imgFile) {
    world.globeImageUrl(imgFile); // Áp texture layer
    world.bumpImageUrl('');       // Xoá bump map (không cần khi dùng ảnh overlay)
  } else {
    // Nếu không tìm thấy file (năm chưa có ảnh) → fallback về mặc định
    world.globeImageUrl(BASE_TEXTURE);
    world.bumpImageUrl(BASE_BUMP);
  }
}

// ─────────────────────────────────────────────────────────────
// HÀM: applyGlobeLayout(selectedCountry, activeLayer)
// Mục đích: Dịch chuyển & thu nhỏ địa cầu để nhường chỗ cho panel.
//   3 trường hợp:
//   1. Đang chọn quốc gia → dịch trái 180px (nhường chỗ city panel)
//   2. Đang bật layer     → thu nhỏ 88% + dịch trái (nhường chỗ timeline)
//   3. Không có gì        → về vị trí trung tâm bình thường
// ─────────────────────────────────────────────────────────────
var _layoutTimer = null; // Timer để trì hoãn repositionTimeline sau animation

export function applyGlobeLayout(selectedCountry, activeLayer) {
  if (selectedCountry) {
    // Trường hợp 1: Dịch trái để city panel xuất hiện bên phải
    globeEl.style.transition = 'transform 0.8s ease';
    globeEl.style.transform  = 'translateX(-180px)';
    _positionTimeline(1.0); // Timeline ở vị trí mặc định (không thu nhỏ)

  } else if (activeLayer) {
    // Trường hợp 2: Thu nhỏ + dịch trái để info panel hiện bên phải
    globeEl.style.transition = 'transform 0.6s ease';
    globeEl.style.transform  = 'translateX(-20vw) scale(0.88)';
    // Đợi animation xong (650ms) rồi mới căn timeline theo scale mới
    clearTimeout(_layoutTimer);
    _layoutTimer = setTimeout(function(){ _positionTimeline(0.88); }, 650);

  } else {
    // Trường hợp 3: Khôi phục về trung tâm
    globeEl.style.transition = 'transform 0.6s ease';
    globeEl.style.transform  = 'translateX(0) scale(1)';
    _positionTimeline(1.0);
  }
}

// ─────────────────────────────────────────────────────────────
// HÀM: resetGlobeTransform()
// Mục đích: Tắt mọi transform (scale + translate) về mặc định.
//   Gọi khi deselect quốc gia hoặc tắt tất cả layer.
// ─────────────────────────────────────────────────────────────
export function resetGlobeTransform() {
  globeEl.style.transition = 'transform 0.6s ease';
  globeEl.style.transform  = 'translateX(0) scale(1)';
  _positionTimeline(1.0); // Đưa timeline về vị trí chuẩn
}

// ─────────────────────────────────────────────────────────────
// HÀM NỘI BỘ: _positionTimeline(scale)
// Mục đích: Căn chỉnh vị trí #timeline-wrapper theo scale hiện tại.
//   Khi globe thu nhỏ (scale < 1), timeline cần dịch sang phải
//   để không bị info panel che khuất.
// ─────────────────────────────────────────────────────────────
function _positionTimeline(scale) {
  var tw = document.getElementById('timeline-wrapper');
  if (!tw) return;

  if (scale >= 1.0) {
    // Scale bình thường → xoá style inline, về mặc định CSS
    tw.style.bottom = '';
    tw.style.right  = '';
    return;
  }

  // Scale thu nhỏ → timeline dịch phải để tránh info panel
  tw.style.bottom = '';
  tw.style.right  = 'calc(36vw + 8px)'; // 36vw = chiều rộng info panel; +8px = khoảng cách
}

// ─────────────────────────────────────────────────────────────
// HÀM: positionTimeline(scale)  [public wrapper]
// Xuất ra ngoài để main.js gọi khi resize window.
// ─────────────────────────────────────────────────────────────
export function positionTimeline(scale) {
  _positionTimeline(scale);
}

// ─────────────────────────────────────────────────────────────
// HÀM: getCountryView(feature)
// Mục đích: Tính góc nhìn tối ưu (lat, lng, altitude) để camera
//   tự động zoom vào quốc gia được chọn một cách hợp lý.
// Tham số : feature – GeoJSON Feature của quốc gia
// Trả về  : { lat, lng, altitude }
// ─────────────────────────────────────────────────────────────
export function getCountryView(feature) {
  // d3.geoCentroid → tính toạ độ trọng tâm địa lý của polygon
  var centroid = d3.geoCentroid(feature);
  var lng = centroid[0], lat = centroid[1];

  // d3.geoBounds → hộp giới hạn [[minLng, minLat], [maxLng, maxLat]]
  var bounds  = d3.geoBounds(feature);
  var lngSpan = bounds[1][0] - bounds[0][0]; // Độ rộng kinh độ
  if (lngSpan < 0) lngSpan += 360; // Xử lý trường hợp quốc gia vượt kinh tuyến 180°
  var latSpan = bounds[1][1] - bounds[0][1]; // Độ rộng vĩ độ
  var size    = Math.max(lngSpan, latSpan);  // Lấy chiều lớn hơn làm cơ sở zoom

  // Ánh xạ kích thước → altitude (càng nhỏ = zoom càng gần)
  var altitude;
  if      (size > 100) altitude = 1.2;  // Lục địa lớn: Nga, Canada, Úc
  else if (size > 60)  altitude = 1.0;  // Nước lớn: Mỹ, Trung Quốc
  else if (size > 30)  altitude = 0.75; // Nước trung bình: Mexico, Brazil (phía đông)
  else if (size > 15)  altitude = 0.55; // Nước nhỏ-vừa: Việt Nam, Đức
  else if (size > 8)   altitude = 0.42; // Nước nhỏ: Hàn Quốc, Nhật Bản
  else                 altitude = 0.28; // Nước rất nhỏ: Singapore, Bỉ

  return { lat, lng, altitude }; // Trả về object để world.pointOfView() tiêu thụ
}
