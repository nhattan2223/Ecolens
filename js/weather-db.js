// weather-db.js — Cache thời tiết / AQI xuống Supabase (fallback khi API lỗi)
// Sync được xử lý bởi server.js. File này chỉ cung cấp fallback cho city-panel.

function getSharedDb() {
  return (window.EcoLensAuth && window.EcoLensAuth.getDb()) || null;
}

// ── Lấy cache từ Supabase cho 1 thành phố (dùng làm fallback) ──
export async function getCachedWeather(lat, lng) {
  const db = getSharedDb();
  if (!db) return null;

  const { data, error } = await db
    .from('city_weather')
    .select('temperature, pm2_5, aqi, updated_at')
    .eq('lat', lat)
    .eq('lng', lng)
    .single();

  if (error) return null;
  return data;
}
