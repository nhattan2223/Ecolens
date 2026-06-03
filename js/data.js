// ============================================================
// data.js — Kho dữ liệu tĩnh & hàm tiện ích tra cứu
// Nhiệm vụ: Lưu toàn bộ dữ liệu cứng (hằng số, bảng tra cứu,
//   dữ liệu lịch sử toàn cầu) và xuất các hàm tìm kiếm/ánh xạ
//   để các module khác dùng chung mà không cần lặp lại logic.
// ============================================================

// --- Nhãn AQI (Chỉ số chất lượng không khí) ---
// Index 0 bỏ trống vì OWM dùng thang 1–5 (không có 0).
// Ví dụ: AQI_LABELS[1] = 'Good', AQI_LABELS[5] = 'Very Poor'
export const AQI_LABELS = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];

// --- Màu tương ứng với từng mức AQI (dùng để tô màu badge/text) ---
// Xanh lá → Tốt | Vàng → Trung bình | Cam → Kém | Đỏ → Rất kém | Tím → Nguy hiểm
export const AQI_COLORS = ['', '#4caf82', '#ffe066', '#ff9966', '#ff5555', '#cc44cc'];

// ============================================================
// GLOBAL_DATA — Dữ liệu lịch sử toàn cầu theo 3 chỉ số môi trường
// Cấu trúc mỗi layer:
//   years       : mảng năm quan trắc
//   values      : mảng giá trị tương ứng (cùng thứ tự với years)
//   unit        : đơn vị hiển thị trên biểu đồ
//   color       : màu hex dùng để vẽ cột biểu đồ
//   description : đoạn phân tích dài hiển thị trong info panel
// ============================================================
export const GLOBAL_DATA = {

  // --- Nhiệt độ trung bình toàn cầu (°C) ---
  temperature: {
    years : [1995, 2000, 2005, 2010, 2015, 2020, 2025],
    values: [14.75, 14.51, 14.61, 14.79, 14.87, 15.10, 15.37],
    unit  : '\u00b0C',         // Unicode cho ký tự °C
    color : '#ff6b35',         // Cam đỏ – biểu trưng nhiệt
    description: 'Global land temperatures have risen significantly since 1995, driven primarily by increasing greenhouse gas concentrations — especially CO₂ and methane from fossil fuel combustion, deforestation, and agriculture. The steep jump post-2015 reflects compounding feedback loops: Arctic sea ice loss reduces Earth\'s albedo, permafrost thaw releases stored methane, and ocean heat content drives more intense weather. The 2025 anomaly of +1.47 °C above the 1901–2000 baseline marks one of the most alarming milestones in instrumental climate records.'
  },

  // --- Nồng độ bụi mịn PM2.5 trung bình toàn cầu (µg/m³) ---
  pm25: {
    years : [1995, 2000, 2005, 2010, 2015, 2020],
    values: [35.4, 36.6, 36.2, 35.9, 36.5, 32.5],
    unit  : '\u00b5g/m\u00b3', // Unicode cho µg/m³
    color : '#a0d8ef',          // Xanh nhạt – biểu trưng bụi/không khí
    description: 'Fine particulate matter (PM2.5) from combustion, industry, and wildfires has fluctuated over three decades. The peak around 2000 coincided with rapid industrialisation in Asia. A gradual decline after 2010 reflects air quality regulations in China and Europe, as well as a shift toward cleaner energy. The notable drop to 32.5 µg/m³ in 2020 was partly driven by COVID-19 lockdowns slashing transport and industrial emissions globally. Long-term exposure to PM2.5 causes respiratory and cardiovascular disease and remains the leading environmental health risk worldwide.'
  },

  // --- Diện tích rừng toàn cầu (% diện tích đất) ---
  forest: {
    years : [2000, 2005, 2010, 2015, 2020, 2025],
    values: [32.4, 32.1, 31.9, 31.4, 31.2, 32.0],
    unit  : '%',
    color : '#4caf82', // Xanh lá – biểu trưng rừng/thiên nhiên
    description: 'Global forest cover has contracted steadily from 32.4% in 2000 to 31.2% in 2020, driven by agricultural expansion, cattle ranching, logging, and infrastructure development — concentrated in the Amazon, Congo Basin, and Southeast Asia. Each percentage point lost represents millions of hectares of habitat, carbon storage, and watershed protection. The slight recovery to 32.0% projected for 2025 reflects intensified afforestation campaigns in China, India, and parts of Africa, though critics note that plantation monocultures do not replicate old-growth biodiversity or carbon density.'
  }
};

// ============================================================
// LAYER_YEARS — Danh sách năm khả dụng cho từng layer
// Dùng để dựng thanh timeline (slider + tick marks).
// Chú ý: pm25 chỉ có đến 2020 vì thiếu dữ liệu năm 2025.
// ============================================================
export const LAYER_YEARS = {
  temperature: [1995, 2000, 2005, 2010, 2015, 2020, 2025],
  pm25        : [1995, 2000, 2005, 2010, 2015, 2020],
  forest      : [2000, 2005, 2010, 2015, 2020, 2025],
};

// ============================================================
// LAYER_LABELS — Nhãn hiển thị trên badge khi layer được bật
// Dùng chuỗi Unicode escape để tránh lỗi encoding file.
//   \ud83c\udf21\ufe0f = 🌡️  \ud83d\udca8 = 💨  \ud83c\udf33 = 🌳
// ============================================================
export const LAYER_LABELS = {
  temperature: '\ud83c\udf21\ufe0f Temperature',
  pm25       : '\ud83d\udca8 PM 2.5',
  forest     : '\ud83c\udf33 Forest Area',
};

// ============================================================
// LAYER_IMAGES — Đường dẫn file ảnh texture cho từng layer/năm
// Khi người dùng chọn layer + năm → globe thay texture bằng ảnh này.
// Format: assets/layers/<tên_layer>/<tên_file>_<năm>.webp
// ============================================================
export const LAYER_IMAGES = {
  temperature: {
    1995: 'assets/layers/nhietdo_layer/nhietdo_1995.webp',
    2000: 'assets/layers/nhietdo_layer/nhietdo_2000.webp',
    2005: 'assets/layers/nhietdo_layer/nhietdo_2005.webp',
    2010: 'assets/layers/nhietdo_layer/nhietdo_2010.webp',
    2015: 'assets/layers/nhietdo_layer/nhietdo_2015.webp',
    2020: 'assets/layers/nhietdo_layer/nhietdo_2020.webp',
    2025: 'assets/layers/nhietdo_layer/nhietdo_2025.webp',
  },
  pm25: {
    1995: 'assets/layers/buimin_layer/buimin_1995.webp',
    2000: 'assets/layers/buimin_layer/buimin_2000.webp',
    2005: 'assets/layers/buimin_layer/buimin_2005.webp',
    2010: 'assets/layers/buimin_layer/buimin_2010.webp',
    2015: 'assets/layers/buimin_layer/buimin_2015.webp',
    2020: 'assets/layers/buimin_layer/buimin_2020.webp',
  },
  forest: {
    2000: 'assets/layers/dientichrung_layer/cayxanh_2000.webp',
    2005: 'assets/layers/dientichrung_layer/cayxanh_2005.webp',
    2010: 'assets/layers/dientichrung_layer/cayxanh_2010.webp',
    2015: 'assets/layers/dientichrung_layer/cayxanh_2015.webp',
    2020: 'assets/layers/dientichrung_layer/cayxanh_2020.webp',
    2025: 'assets/layers/dientichrung_layer/cayxanh_2025.webp',
  }
};

// --- Texture mặc định của địa cầu (khi KHÔNG bật layer nào) ---
export const BASE_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
// --- Texture địa hình (bump map) tạo hiệu ứng nổi núi/biển ---
export const BASE_BUMP    = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

// ============================================================
// COUNTRY_ALIASES — Bảng tên gọi khác/tắt của các quốc gia
// Mục đích: Cho phép người dùng tìm "USA", "UK", "VN"…
//   và vẫn khớp được với tên chuẩn trong GeoJSON.
// Cấu trúc: { 'Tên chuẩn GeoJSON': ['Tên thay thế 1', 'Tên thay thế 2', …] }
// ============================================================
export const COUNTRY_ALIASES = {
  'United States of America': ['US','USA','America','United States'],
  'United Kingdom':           ['UK','GB','Britain','Great Britain','England'],
  'Russia':                   ['Russian Federation','USSR'],
  'South Korea':              ['Korea','Republic of Korea','ROK'],
  'North Korea':              ['DPRK'],
  'China':                    ['PRC',"People's Republic of China"],
  'Vietnam':                  ['VN','Viet Nam'],
  'Germany':                  ['Deutschland','DE'],
  'France':                   ['FR'],
  'Japan':                    ['JP','Nippon'],
  'Brazil':                   ['BR','Brasil'],
  'Australia':                ['AU','AUS'],
  'Canada':                   ['CA','CAN'],
  'India':                    ['IN','IND','Bharat'],
  'Saudi Arabia':             ['KSA','Saudi'],
  'United Arab Emirates':     ['UAE','Emirates'],
  'South Africa':             ['RSA','ZA'],
  'New Zealand':              ['NZ','Aotearoa'],
  'Netherlands':              ['Holland','NL'],
  'Turkey':                   ['TR'],
  'Iran':                     ['Persia','IR'],
  'Egypt':                    ['EG','Misr'],
  'Argentina':                ['AR'],
  'Mexico':                   ['MX'],
  'Indonesia':                ['ID'],
  'Philippines':              ['PH','Pilipinas'],
  'Thailand':                 ['TH','Siam'],
  'Malaysia':                 ['MY'],
  'Singapore':                ['SG'],
  'Cambodia':                 ['KH','Kampuchea'],
  'Myanmar':                  ['Burma','MM'],
  'Laos':                     ['LA','Lao PDR'],
};

// ============================================================
// vietnamIslands — Dữ liệu GeoJSON thủ công cho Hoàng Sa & Trường Sa
// Vì world-atlas không có dữ liệu quần đảo này của Việt Nam,
// ta tự định nghĩa hình đa giác (polygon) xấp xỉ để vẽ lên globe.
// ============================================================
export const vietnamIslands = [
  {
    type: 'Feature',
    properties: { name: 'Hoang Sa' }, // Tên hiển thị khi hover
    geometry: {
      type: 'Polygon',
      // Mảng toạ độ [kinh độ, vĩ độ] tạo thành vùng xấp xỉ quần đảo Hoàng Sa
      coordinates: [[[111.20,16.10],[111.60,16.95],[112.40,17.10],[113.00,16.80],[113.20,16.10],[112.90,15.60],[112.10,15.40],[111.30,15.70],[111.20,16.10]]]
    }
  },
  {
    type: 'Feature',
    properties: { name: 'Truong Sa' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[111.50,12.00],[112.50,12.50],[114.00,12.20],[115.50,11.20],[116.00,10.00],[115.50,8.50],[114.20,7.60],[112.80,7.50],[111.50,8.50],[110.80,10.00],[111.00,11.20],[111.50,12.00]]]
    }
  }
];

// ============================================================
// HÀM: isVietnamIsland(d)
// Kiểm tra polygon d có phải Hoàng Sa / Trường Sa không.
// Dùng để tô màu đặc biệt khi Việt Nam được chọn.
// ============================================================
export function isVietnamIsland(d) {
  const n = d.properties && d.properties.name;
  return n === 'Hoang Sa' || n === 'Truong Sa';
}

// ============================================================
// HÀM: matchCountry(polygon, query)
// Kiểm tra polygon có khớp với chuỗi tìm kiếm query không.
// Trả về true nếu:
//   • Tên chính của quốc gia bắt đầu bằng query (không phân biệt hoa/thường)
//   • Hoặc bất kỳ tên alias nào bắt đầu bằng query
// Dùng "startsWith" (indexOf === 0) thay vì "includes" → ưu tiên khớp đầu chữ
// ============================================================
export function matchCountry(polygon, query) {
  var name = polygon.properties && polygon.properties.name;
  if (!name) return false;
  var q = query.toLowerCase();

  // Kiểm tra tên chính: "viet" khớp với "Vietnam"
  if (name.toLowerCase().indexOf(q) === 0) return true;

  // Kiểm tra danh sách alias: "vn" khớp với alias 'VN' của Vietnam
  var aliases = COUNTRY_ALIASES[name] || [];
  return aliases.some(function(a){ return a.toLowerCase().indexOf(q) === 0; });
}

// ============================================================
// HÀM: findCitiesForCountry(polygon, countryCities)
// Tìm entry thành phố tương ứng với quốc gia đang xét.
// Thử theo thứ tự ưu tiên:
//   1. Khớp chính xác tên (country === name)
//   2. Khớp qua alias (COUNTRY_ALIASES)
//   3. Khớp mờ (tên chứa nhau, viết thường)
// Trả về object entry từ countryCities hoặc null nếu không tìm thấy.
// ============================================================
export function findCitiesForCountry(polygon, countryCities) {
  var name = polygon.properties && polygon.properties.name;
  if (!name || !countryCities) return null;

  // --- Bước 1: Tìm chính xác tên quốc gia ---
  var found = countryCities.find(function(c){ return c.country === name; });
  if (found) return found;

  // --- Bước 2: Thử từng alias ---
  var aliases = COUNTRY_ALIASES[name] || [];
  for (var i = 0; i < aliases.length; i++) {
    found = countryCities.find(function(c){ return c.country === aliases[i]; });
    if (found) return found;
  }

  // --- Bước 3: So khớp mờ (lowercase, chứa nhau) ---
  var nameLow = name.toLowerCase();
  found = countryCities.find(function(c) {
    var cl = c.country.toLowerCase();
    // Ví dụ: "Ivory Coast" ↔ "Côte d'Ivoire" có thể khớp mờ
    return cl === nameLow || cl.indexOf(nameLow) !== -1 || nameLow.indexOf(cl) !== -1;
  });
  return found || null;
}

// --- Các năm có dữ liệu lịch sử theo quốc gia (dùng cho biểu đồ History) ---
export const HIST_YEARS = ['1995', '2000', '2005', '2010', '2015', '2020'];

// ============================================================
// HIST_CONFIGS — Cấu hình 3 biểu đồ trong tab History
// Mỗi object gồm:
//   id    : ID phần tử DOM chứa canvas (trong city-panel.js)
//   key   : tên trường trong dữ liệu historical_data.json
//   color : màu cột biểu đồ
//   unit  : đơn vị hiển thị (dùng trong chart-utils.js)
// ============================================================
export const HIST_CONFIGS = [
  { id: 'chart-temp',   key: 'temp',   color: '#ff9966', unit: '°C' },
  { id: 'chart-pm25',   key: 'pm25',   color: '#a0d8ef', unit: 'µg/m³' },
  { id: 'chart-forest', key: 'forest', color: '#4caf82', unit: '%' }
];

// ============================================================
// NAME_TO_ISO — Bảng ánh xạ tên quốc gia → mã ISO 3166-1 alpha-3
// Mục đích: Tra cứu mã ISO để tìm dữ liệu trong historical_data.json
//   (file JSON dùng mã ISO làm key, ví dụ "VNM", "USA", "CHN"…)
// Bảng này bao gồm nhiều biến thể tên (ký hiệu rút gọn, tên cũ,
//   tên tiếng bản địa) để tăng tỉ lệ khớp thành công.
// ============================================================
export const NAME_TO_ISO = {
  "Afghanistan":"AFG","Albania":"ALB","Algeria":"DZA","American Samoa":"ASM",
  "Andorra":"AND","Angola":"AGO","Anguilla":"AIA","Antigua and Barbuda":"ATG",
  "Argentina":"ARG","Armenia":"ARM","Aruba":"ABW","Australia":"AUS","Austria":"AUT",
  "Azerbaijan":"AZE","Bahrain":"BHR","Bangladesh":"BGD","Barbados":"BRB",
  "Belarus":"BLR","Belgium":"BEL","Belize":"BLZ","Benin":"BEN","Bermuda":"BMU",
  "Bhutan":"BTN","Bolivia":"BOL","Bosnia and Herzegovina":"BIH","Botswana":"BWA",
  "Brazil":"BRA","Brunei":"BRN","Bulgaria":"BGR","Burkina Faso":"BFA","Burundi":"BDI",
  "Cabo Verde":"CPV","Cambodia":"KHM","Cameroon":"CMR","Canada":"CAN",
  "Central African Republic":"CAF","Chad":"TCD","Chile":"CHL","China":"CHN",
  "Colombia":"COL","Comoros":"COM","Costa Rica":"CRI","Croatia":"HRV","Cuba":"CUB",
  "Cyprus":"CYP","Czechia":"CZE","Czech Republic":"CZE","Denmark":"DNK",
  "Djibouti":"DJI","Dominica":"DMA","Dominican Republic":"DOM","Ecuador":"ECU",
  "Egypt":"EGY","El Salvador":"SLV","Equatorial Guinea":"GNQ","Eritrea":"ERI",
  "Estonia":"EST","Eswatini":"SWZ","Ethiopia":"ETH","Fiji":"FJI","Finland":"FIN",
  "France":"FRA","French Polynesia":"PYF","Gabon":"GAB","Georgia":"GEO",
  "Germany":"DEU","Ghana":"GHA","Greece":"GRC","Greenland":"GRL","Guatemala":"GTM",
  "Guinea":"GIN","Guinea-Bissau":"GNB","Guyana":"GUY","Haiti":"HTI",
  "Honduras":"HND","Hungary":"HUN","Iceland":"ISL","India":"IND","Indonesia":"IDN",
  "Iran":"IRN","Iraq":"IRQ","Ireland":"IRL","Israel":"ISR","Italy":"ITA",
  "Jamaica":"JAM","Japan":"JPN","Jordan":"JOR","Kazakhstan":"KAZ","Kenya":"KEN",
  "Kiribati":"KIR","Kuwait":"KWT","Kyrgyzstan":"KGZ","Laos":"LAO","Latvia":"LVA",
  "Lebanon":"LBN","Lesotho":"LSO","Liberia":"LBR","Libya":"LBY","Lithuania":"LTU",
  "Luxembourg":"LUX","Madagascar":"MDG","Malawi":"MWI","Malaysia":"MYS",
  "Maldives":"MDV","Mali":"MLI","Malta":"MLT","Mauritania":"MRT","Mauritius":"MUS",
  "Mexico":"MEX","Moldova":"MDA","Mongolia":"MNG","Montenegro":"MNE","Morocco":"MAR",
  "Mozambique":"MOZ","Namibia":"NAM","Nepal":"NPL","Netherlands":"NLD",
  "New Zealand":"NZL","Nicaragua":"NIC","Niger":"NER","Nigeria":"NGA",
  "North Macedonia":"MKD","Norway":"NOR","Oman":"OMN","Pakistan":"PAK",
  "Panama":"PAN","Papua New Guinea":"PNG","Paraguay":"PRY","Peru":"PER",
  "Philippines":"PHL","Poland":"POL","Portugal":"PRT","Qatar":"QAT","Romania":"ROU",
  "Russia":"RUS","Rwanda":"RWA","Saint Lucia":"LCA",
  "Saint Vincent and the Grenadines":"VCT","Samoa":"WSM","Saudi Arabia":"SAU",
  "Senegal":"SEN","Serbia":"SRB","Seychelles":"SYC","Sierra Leone":"SLE",
  "Singapore":"SGP","Slovakia":"SVK","Slovenia":"SVN","Solomon Islands":"SLB",
  "Somalia":"SOM","South Africa":"ZAF","South Korea":"KOR","North Korea":"PRK",
  "South Sudan":"SSD","Spain":"ESP","Sri Lanka":"LKA","Sudan":"SDN",
  "Suriname":"SUR","Sweden":"SWE","Switzerland":"CHE","Syria":"SYR",
  "Tajikistan":"TJK","Tanzania":"TZA","Thailand":"THA","Timor-Leste":"TLS",
  "East Timor":"TLS","Togo":"TGO","Tonga":"TON","Trinidad and Tobago":"TTO",
  "Tunisia":"TUN","Turkey":"TUR","Turkmenistan":"TKM","Uganda":"UGA",
  "Ukraine":"UKR","United Arab Emirates":"ARE","United Kingdom":"GBR",
  "United States of America":"USA","United States":"USA","Uruguay":"URY",
  "Uzbekistan":"UZB","Vanuatu":"VUT","Venezuela":"VEN","Vietnam":"VNM",
  "Viet Nam":"VNM","Yemen":"YEM","Zambia":"ZMB","Zimbabwe":"ZWE",
  // Tên rút gọn hoặc không chuẩn thường gặp trong GeoJSON
  "Dem. Rep. Congo":"COD","Democratic Republic of the Congo":"COD",
  "Congo":"COG","Republic of the Congo":"COG","Central African Rep.":"CAF",
  "Côte d'Ivoire":"CIV","Ivory Coast":"CIV","Bosnia and Herz.":"BIH",
  "Dominican Rep.":"DOM","Eq. Guinea":"GNQ","Solomon Is.":"SLB","S. Sudan":"SSD",
  "Myanmar":"MMR","Burma":"MMR","W. Sahara":"ESH","Kosovo":"XKX",
  "Palestine":"PSE","Taiwan":"TWN","Micronesia":"FSM",
  "São Tomé and Príncipe":"STP","Sao Tome and Principe":"STP","Cape Verde":"CPV",
  "Swaziland":"SWZ","Macedonia":"MKD",
  "Iran (Islamic Republic of)":"IRN","Korea, Republic of":"KOR",
  "Korea, Dem. People's Rep.":"PRK","Lao PDR":"LAO","Moldova, Republic of":"MDA",
  "Russian Federation":"RUS","Syrian Arab Republic":"SYR",
  "Tanzania, United Republic of":"TZA",
  "Venezuela, Bolivarian Republic of":"VEN","Viet Nam":"VNM"
};

// ============================================================
// HÀM: getIsoForPolygon(polygon)
// Tra mã ISO-3 từ tên polygon (lấy từ GeoJSON properties.name).
// Trả về chuỗi như "VNM", "USA"… hoặc null nếu không tìm thấy.
// ============================================================
export function getIsoForPolygon(polygon) {
  var name = polygon.properties && polygon.properties.name;
  if (!name) return null;
  return NAME_TO_ISO[name] || null; // undefined → null (rõ ràng hơn cho caller)
}

// ============================================================
// HÀM: findHistByName(name, histData)
// Tìm dữ liệu lịch sử của một quốc gia trong histData (object keyed by ISO).
// Thử theo thứ tự:
//   1. Tra trực tiếp tên → ISO → histData[ISO]
//   2. Thử từng alias → ISO → histData[ISO]
// Trả về object { temp:{}, pm25:{}, forest:{} } hoặc null.
// ============================================================
export function findHistByName(name, histData) {
  if (!histData) return null;

  // --- Bước 1: Tên chính ---
  var iso = NAME_TO_ISO[name];
  if (iso && histData[iso]) return histData[iso];

  // --- Bước 2: Các tên alias ---
  var aliases = COUNTRY_ALIASES[name] || [];
  for (var i = 0; i < aliases.length; i++) {
    iso = NAME_TO_ISO[aliases[i]];
    if (iso && histData[iso]) return histData[iso];
  }

  return null; // Không tìm thấy dữ liệu lịch sử cho quốc gia này
}