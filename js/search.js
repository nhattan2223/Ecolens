// ============================================================
// search.js — Thanh tìm kiếm quốc gia
// Nhiệm vụ: Lắng nghe input từ người dùng, lọc danh sách quốc gia,
//   hiển thị dropdown gợi ý và xử lý điều hướng bàn phím.
// ============================================================

import { matchCountry } from './data.js';

// ============================================================
// HÀM: initSearch(allPolygons, onSelect)
// Mục đích: Khởi tạo toàn bộ logic tìm kiếm.
//   Gắn các event listener vào input và document.
// Tham số:
//   allPolygons – mảng GeoJSON Feature (quốc gia + đảo VN)
//   onSelect    – callback(polygon) gọi khi người dùng chọn 1 quốc gia
// ============================================================
export function initSearch(allPolygons, onSelect) {
  var input   = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return; // Bảo vệ nếu DOM thiếu phần tử

  // Lọc các polygon có tên (bỏ polygon không có properties.name)
  var searchable = allPolygons.filter(function(d){
    return d.properties && d.properties.name;
  });

  var highlightIndex = -1; // Index của kết quả đang được hover/highlight (-1 = chưa có)
  var filtered = [];       // Mảng kết quả tìm kiếm hiện tại

  // ============================================================
  // HÀM NỘI BỘ: showResults(query)
  // Mục đích: Lọc danh sách quốc gia theo query và render dropdown.
  // ============================================================
  function showResults(query) {
    var q = query.trim().toLowerCase(); // Chuẩn hoá: bỏ khoảng trắng đầu/cuối, viết thường

    // Nếu ô tìm kiếm trống → ẩn dropdown và reset
    if (!q) {
      results.classList.remove('visible');
      results.innerHTML = '';
      return;
    }

    // Lọc polygon khớp với query (dùng matchCountry từ data.js)
    // .slice(0, 8) → giới hạn tối đa 8 kết quả để không tràn màn hình
    filtered = searchable.filter(function(d){
      return matchCountry(d, q);
    }).slice(0, 8);

    // Không có kết quả → ẩn dropdown
    if (!filtered.length) {
      results.classList.remove('visible');
      return;
    }

    highlightIndex = -1; // Reset highlight khi có query mới

    // Tạo HTML cho từng item kết quả
    // data-index lưu vị trí trong mảng filtered để dùng khi click
    results.innerHTML = filtered.map(function(d, i){
      return '<div class="search-item" data-index="' + i + '">' +
               d.properties.name +
             '</div>';
    }).join('');

    results.classList.add('visible'); // Hiện dropdown

    // Gắn sự kiện click cho từng item
    results.querySelectorAll('.search-item').forEach(function(el) {
      el.addEventListener('click', function(){
        var polygon = filtered[+el.dataset.index]; // + chuyển string → number
        input.value = polygon.properties.name;      // Điền tên vào ô tìm kiếm
        results.classList.remove('visible');         // Đóng dropdown
        onSelect(polygon);                           // Gọi callback → zoom đến quốc gia
      });
    });
  }

  // ── GẮN SỰ KIỆN: Người dùng gõ vào ô tìm kiếm ──
  input.addEventListener('input', function(){
    showResults(input.value); // Tìm kiếm realtime mỗi khi gõ
  });

  // ── GẮN SỰ KIỆN: Điều hướng bàn phím ──
  input.addEventListener('keydown', function(e) {
    var items = results.querySelectorAll('.search-item'); // Danh sách item hiện tại

    if (e.key === 'ArrowDown') {
      // Mũi tên xuống: di chuyển highlight xuống (không vượt quá phần tử cuối)
      e.preventDefault(); // Tránh con trỏ text nhảy về cuối input
      highlightIndex = Math.min(highlightIndex + 1, items.length - 1);

    } else if (e.key === 'ArrowUp') {
      // Mũi tên lên: di chuyển highlight lên (không âm)
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);

    } else if (e.key === 'Enter') {
      // Enter: chọn kết quả đang highlight, hoặc kết quả duy nhất nếu chỉ có 1
      var target = filtered[highlightIndex] ||
                   (filtered.length === 1 ? filtered[0] : null);
      if (target) {
        input.value = target.properties.name;
        results.classList.remove('visible');
        onSelect(target); // Zoom đến quốc gia
      }
      return; // Không cần cập nhật highlight sau Enter

    } else if (e.key === 'Escape') {
      // Escape: đóng dropdown và bỏ focus khỏi input
      results.classList.remove('visible');
      input.blur(); // Ẩn bàn phím trên mobile
      return;
    }

    // Cập nhật class .highlight cho item đang được chọn bằng bàn phím
    items.forEach(function(el, i){
      el.classList.toggle('highlight', i === highlightIndex);
      // toggle(class, bool): thêm class nếu bool=true, xoá nếu false
    });
  });

  // ── GẮN SỰ KIỆN: Click ra ngoài → đóng dropdown ──
  document.addEventListener('click', function(e) {
    // Nếu click không nằm trong #search-wrapper → đóng dropdown
    if (!document.getElementById('search-wrapper').contains(e.target)) {
      results.classList.remove('visible');
    }
  });
}