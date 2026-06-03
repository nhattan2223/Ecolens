// ============================================================
// chart-utils.js — Vẽ biểu đồ cột bằng Canvas API thuần (không dùng thư viện)
// Xuất 2 hàm:
//   buildBarChart      → biểu đồ cột lớn trong info panel (khi bật layer)
//   drawHistoryCanvas  → biểu đồ cột nhỏ trong city panel (tab History)
// ============================================================

// ============================================================
// HÀM NỘI BỘ: _createRoundRectPath(ctx, x, y, w, h, r)
// Mục đích: Vẽ đường dẫn (path) hình chữ nhật bo góc.
// Tham số :
//   ctx – CanvasRenderingContext2D
//   x,y – toạ độ góc trên-trái   w,h – chiều rộng/cao   r – bán kính bo góc
//
// Lý do tồn tại: ctx.roundRect() là API mới (Chrome 99+, Firefox 112+),
//   trình duyệt cũ KHÔNG hỗ trợ. Hàm này dùng quadraticCurveTo() làm dự phòng
//   để đảm bảo tương thích rộng.
// ============================================================
function _createRoundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath(); // Bắt đầu một đường dẫn mới (xoá path cũ)

  if (ctx.roundRect) {
    // Trình duyệt hiện đại: dùng API gốc (nhanh hơn)
    ctx.roundRect(x, y, w, h, r);
  } else {
    // Fallback: vẽ từng cạnh + góc bo bằng đường cong bậc 2
    ctx.moveTo(x + r, y);                            // Bắt đầu ở cạnh trên (sau góc trái)
    ctx.lineTo(x + w - r, y);                        // Cạnh trên
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r); // Góc trên-phải
    ctx.lineTo(x + w, y + h - r);                    // Cạnh phải
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); // Góc dưới-phải
    ctx.lineTo(x + r, y + h);                        // Cạnh dưới
    ctx.quadraticCurveTo(x, y + h,     x, y + h - r); // Góc dưới-trái
    ctx.lineTo(x, y + r);                            // Cạnh trái
    ctx.quadraticCurveTo(x, y,         x + r, y);   // Góc trên-trái
    ctx.closePath(); // Nối điểm cuối về điểm đầu để tạo hình kín
  }
}

// ============================================================
// HÀM: buildBarChart(canvas, layer, highlightYear, data)
// Mục đích: Vẽ biểu đồ cột lớn (trong info panel) cho dữ liệu TOÀN CẦU.
//   Cột tương ứng với highlightYear được làm nổi bật (phát sáng, chữ đậm).
// Tham số:
//   canvas        – phần tử <canvas> để vẽ lên
//   layer         – 'temperature' | 'pm25' | 'forest'
//   highlightYear – năm đang được chọn trên timeline
//   data          – GLOBAL_DATA từ data.js
// ============================================================
export function buildBarChart(canvas, layer, highlightYear, data) {
  // Bảo vệ: thoát sớm nếu thiếu tham số hoặc layer không có dữ liệu
  if (!canvas || !data || !data[layer]) return;

  // --- Lấy kích thước thực của vùng chứa canvas (tính theo CSS pixel) ---
  const area = canvas.parentElement || document.getElementById('chart-area');
  const rect  = area.getBoundingClientRect(); // DOMRect – vị trí & kích thước thực
  const dpr   = window.devicePixelRatio || 1; // Hệ số pixel thiết bị (Retina = 2)
  const W     = rect.width  || 400;           // Chiều rộng vùng vẽ (px CSS)
  const H     = rect.height || 220;           // Chiều cao vùng vẽ (px CSS)

  // --- Thiết lập canvas với độ phân giải cao (nhân với dpr) ---
  // canvas.width/height là số pixel vật lý; style.width/height là hiển thị CSS
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Scale context lên dpr lần → nét sắc trên Retina

  // --- Lọc cặp (year, value), bỏ qua giá trị null ---
  const layerData  = data[layer];
  const validPairs = layerData.years
    .map((year, i) => ({ year, val: layerData.values[i] }))
    .filter(d => d.val !== null);

  if (!validPairs.length) return; // Không có dữ liệu → không vẽ

  // --- Tính domain (phạm vi giá trị) cho trục Y ---
  const minVal    = Math.min.apply(null, validPairs.map(d => d.val));
  const maxVal    = Math.max.apply(null, validPairs.map(d => d.val));
  const padV      = (maxVal - minVal) * 0.22 || 1; // Thêm 22% khoảng đệm (tránh cột sát mép)
  const domainMin = Math.max(0, minVal - padV);     // Không để trục Y âm
  const domainMax = maxVal + padV;

  // --- Lề vẽ (Margin): L=trái, R=phải, T=trên, B=dưới (px) ---
  const ML = 50, MR = 12, MT = 22, MB = 46;
  const cW = W - ML - MR; // Chiều rộng vùng vẽ thực sự (giữa hai lề)
  const cH = H - MT - MB; // Chiều cao vùng vẽ thực sự

  // --- Hàm chuyển giá trị → toạ độ Y trên canvas ---
  // Trục Y canvas tăng từ trên xuống → cần đảo ngược
  function toY(v) {
    return MT + cH - ((v - domainMin) / (domainMax - domainMin)) * cH;
  }

  ctx.clearRect(0, 0, W, H); // Xoá toàn bộ canvas trước khi vẽ lại

  // ── VẼ ĐƯỜNG KẺ NGANG (grid) VÀ NHÃN TRỤC Y ──
  const TICKS = 5; // Số đường kẻ ngang
  for (let i = 0; i <= TICKS; i++) {
    const v   = domainMin + (domainMax - domainMin) * (i / TICKS); // Giá trị tại tick này
    const y   = toY(v);
    const dec = layer === 'temperature' ? 2 : 1; // Số chữ số thập phân tuỳ layer

    // Đường kẻ ngang nhạt (grid line)
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(ML, y); ctx.lineTo(ML + cW, y); // Từ lề trái đến lề phải
    ctx.stroke();

    // Nhãn số bên trái trục Y
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.font         = '10px Rajdhani, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.38)';
    ctx.fillText(v.toFixed(dec), ML - 6, y); // 6px cách lề trái
  }

  // ── VẼ NHÃN ĐƠN VỊ DỌC BÊN TRÁI (xoay 90°) ──
  ctx.save();
  ctx.translate(13, MT + cH / 2); // Di chuyển gốc toạ độ ra chỗ muốn vẽ chữ
  ctx.rotate(-Math.PI / 2);       // Xoay ngược chiều kim đồng hồ 90°
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font      = '10px Rajdhani, sans-serif';
  ctx.fillStyle = 'rgba(140,255,122,0.4)';
  ctx.fillText(layerData.unit, 0, 0); // Vẽ đơn vị (°C, µg/m³, %)
  ctx.restore(); // Khôi phục trạng thái context (huỷ translation + rotation)

  // ── TÍNH KÍCH THƯỚC TỪNG CỘT ──
  const n      = validPairs.length; // Số cột
  const slotW  = cW / n;            // Chiều rộng mỗi "slot" (bao gồm khoảng cách)
  const barW   = slotW * 0.72;      // Cột chiếm 72% slot → 28% là khoảng cách giữa cột
  const offset = slotW * 0.14;      // Căn giữa cột trong slot (14% mỗi bên)

  // ── VẼ TỪNG CỘT ──
  validPairs.forEach(function(d, i) {
    const isActive = d.year === highlightYear; // Cột này có phải năm đang chọn?
    const x        = ML + i * slotW + offset;  // Toạ độ X của cột
    const yTop     = toY(d.val);               // Toạ độ Y của đỉnh cột
    const bH       = (MT + cH) - yTop;         // Chiều cao cột (tính từ đỉnh xuống đáy chart)

    // --- Hiệu ứng phát sáng (halo) cho cột đang chọn ---
    if (isActive) {
      ctx.save();
      ctx.shadowColor = layerData.color; // Màu bóng = màu layer
      ctx.shadowBlur  = 22;              // Độ mờ bóng (càng lớn càng lan rộng)
      ctx.fillStyle   = layerData.color + '28'; // Màu nền halo (opacity ~16%)
      _createRoundRectPath(ctx, x - 4, yTop - 4, barW + 8, bH + 8, 7); // Hình hơi to hơn cột
      ctx.fill();
      ctx.restore();
    }

    // --- Gradient màu từ đỉnh → đáy cột ---
    const grad = ctx.createLinearGradient(x, yTop, x, yTop + bH); // Gradient dọc
    grad.addColorStop(0, layerData.color + (isActive ? 'ff' : '66')); // Đỉnh: đậm nếu active
    grad.addColorStop(1, layerData.color + (isActive ? '55' : '18')); // Đáy: nhạt hơn
    ctx.fillStyle = grad;
    _createRoundRectPath(ctx, x, yTop, barW, bH, 4); // Vẽ cột bo góc r=4
    ctx.fill();

    // --- Vạch sáng trên đỉnh cột (highlight) ---
    ctx.fillStyle = isActive ? layerData.color : layerData.color + '99';
    ctx.fillRect(x, yTop, barW, 2); // Thanh ngang mỏng 2px

    // --- Giá trị số bên trên cột ---
    const dec = layer === 'temperature' ? 2 : 1;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font      = isActive ? 'bold 11px Orbitron, sans-serif' : '9px Rajdhani, sans-serif';
    ctx.fillStyle = isActive ? layerData.color : 'rgba(255,255,255,0.42)';
    ctx.fillText(d.val.toFixed(dec), x + barW / 2, yTop - 5); // 5px trên đỉnh cột

    // --- Nhãn năm bên dưới cột ---
    ctx.textBaseline = 'top';
    ctx.font      = isActive ? 'bold 11px Rajdhani, sans-serif' : '10px Rajdhani, sans-serif';
    ctx.fillStyle = isActive ? layerData.color : 'rgba(255,255,255,0.35)';
    ctx.fillText(d.year, x + barW / 2, MT + cH + 10); // 10px dưới đáy chart

    // --- Gạch chân cho năm đang chọn ---
    if (isActive) {
      ctx.fillStyle = layerData.color;
      ctx.fillRect(x, MT + cH + 30, barW, 2); // Thanh ngang 2px dưới nhãn năm
    }
  });
}

// ============================================================
// HÀM: drawHistoryCanvas(canvas, pairs, cfg)
// Mục đích: Vẽ biểu đồ cột nhỏ trong city panel (tab History).
//   Đơn giản hơn buildBarChart: không có cột nổi bật, không có nhãn đơn vị dọc.
// Tham số:
//   canvas – phần tử <canvas>
//   pairs  – mảng { year: "chuỗi 2 chữ số", val: số | null }
//   cfg    – { color: '#hex', unit: 'chuỗi' } từ HIST_CONFIGS
// ============================================================
export function drawHistoryCanvas(canvas, pairs, cfg) {
  // --- Thiết lập kích thước canvas (giống buildBarChart) ---
  const dpr  = window.devicePixelRatio || 1;
  const rect  = canvas.getBoundingClientRect();
  const W     = rect.width  || 220;
  const H     = rect.height || 120;

  canvas.width        = Math.round(W * dpr);
  canvas.height       = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // --- Lọc các điểm có giá trị (bỏ null) để tính domain ---
  const defined = pairs.filter(function(p){ return p.val !== null; });
  if (!defined.length) return; // Không có dữ liệu → không vẽ

  // --- Tính domain trục Y (giống buildBarChart nhưng viết var thay let/const) ---
  const minVal = Math.min.apply(null, defined.map(function(p){ return p.val; }));
  const maxVal = Math.max.apply(null, defined.map(function(p){ return p.val; }));
  const padV   = (maxVal - minVal) * 0.22 || 1;
  const domMin = minVal - padV;
  const domMax = maxVal + padV;

  // --- Lề vẽ (nhỏ hơn buildBarChart vì panel nhỏ hơn) ---
  const ML = 36, MR = 6, MT = 16, MB = 28;
  const cW = W - ML - MR;
  const cH = H - MT - MB;

  function toY(v) { return MT + cH - ((v - domMin) / (domMax - domMin)) * cH; }

  ctx.clearRect(0, 0, W, H);

  // ── VẼ GRID + NHÃN TRỤC Y (chỉ 3 đường để không chật chội) ──
  var TICKS = 3;
  for (var t = 0; t <= TICKS; t++) {
    var v = domMin + (domMax - domMin) * (t / TICKS);
    var y = toY(v);

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + cW, y); ctx.stroke();

    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.font         = '9px Rajdhani, sans-serif'; // Font nhỏ hơn vì panel nhỏ
    ctx.fillStyle    = 'rgba(255,255,255,0.32)';
    ctx.fillText(v.toFixed(1), ML - 3, y);
  }

  // ── TÍNH KÍCH THƯỚC CỘT (tỉ lệ tương tự buildBarChart) ──
  var n      = pairs.length;
  var slotW  = cW / n;
  var barW   = slotW * 0.68; // Cột chiếm 68% slot (hơi hẹp hơn)
  var offset = slotW * 0.16;

  // ── VẼ TỪNG CỘT ──
  pairs.forEach(function(d, i) {
    var x = ML + i * slotW + offset;

    // --- Nếu không có dữ liệu cho năm này: vẽ cột giả mỏng + nhãn mờ ---
    if (d.val === null) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x, MT + cH - 4, barW, 4); // Thanh nhỏ ở đáy biểu thị "không có dữ liệu"
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.font         = '9px Rajdhani, sans-serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.22)';
      ctx.fillText(d.year, x + barW / 2, MT + cH + 6);
      return; // Bỏ qua phần vẽ cột thực
    }

    var yTop = toY(d.val);
    var bH   = (MT + cH) - yTop;

    // --- Halo nhẹ xung quanh cột ---
    ctx.save();
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur  = 10; // Nhỏ hơn buildBarChart (halo vừa phải cho panel nhỏ)
    ctx.fillStyle   = cfg.color + '22'; // Opacity ~13%
    _createRoundRectPath(ctx, x - 2, yTop - 2, barW + 4, bH + 4, 4);
    ctx.fill();
    ctx.restore();

    // --- Gradient cột ---
    var grad = ctx.createLinearGradient(x, yTop, x, yTop + bH);
    grad.addColorStop(0, cfg.color + 'ff'); // Đỉnh: đậm (opaque)
    grad.addColorStop(1, cfg.color + '44'); // Đáy: mờ ~27%
    ctx.fillStyle = grad;
    _createRoundRectPath(ctx, x, yTop, barW, bH, 3);
    ctx.fill();

    // --- Vạch sáng đỉnh cột ---
    ctx.fillStyle = cfg.color;
    ctx.fillRect(x, yTop, barW, 2);

    // --- Giá trị số trên đỉnh (font Orbitron nhỏ, bold) ---
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font         = 'bold 9px Orbitron, sans-serif';
    ctx.fillStyle    = cfg.color;
    ctx.fillText(d.val.toFixed(1), x + barW / 2, yTop - 3);

    // --- Nhãn năm bên dưới (ví dụ: "'95", "'00") ---
    ctx.textBaseline = 'top';
    ctx.font         = '9px Rajdhani, sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.42)';
    ctx.fillText(d.year, x + barW / 2, MT + cH + 6);
  });
}