// weather-db.js — Cache thời tiết / AQI xuống Supabase (fallback khi API lỗi)
// Gọi backend proxy để giấu API key

const { SUPABASE_URL, SUPABASE_KEY, BACKEND_URL } = window.EcoLensApiKeys || {};
const weatherDb = SUPABASE_URL && SUPABASE_KEY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let refreshTimer = null;

function backendUrl() {
  return BACKEND_URL || 'http://localhost:3000';
}

async function loadCities() {
  const res = await fetch('data/country.json');
  if (!res.ok) throw new Error('Failed to load country.json');
  return res.json();
}

function flattenCities(entries) {
  const all = [];
  for (const entry of entries) {
    for (const city of entry.cities) {
      all.push({
        name: city.name,
        country: entry.country,
        lat: city.lat,
        lng: city.lng
      });
    }
  }
  return all;
}

// ── Gọi API qua backend proxy, theo batch ──
export async function refreshAllCities() {
  if (!weatherDb) {
    console.warn('[WeatherDB] Supabase not available');
    return;
  }

  console.log('[WeatherDB] Fetching all cities via proxy…');

  let entries;
  try {
    entries = await loadCities();
  } catch (err) {
    console.warn('[WeatherDB] Could not load cities:', err);
    return;
  }

  const allCities = flattenCities(entries);
  const BATCH_SIZE = 15;
  const DELAY_MS = 30000;

  let done = 0;

  for (let i = 0; i < allCities.length; i += BATCH_SIZE) {
    const batch = allCities.slice(i, i + BATCH_SIZE);

    try {
      const res = await fetch(`${backendUrl()}/api/weather-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cities: batch })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.rows && result.rows.length > 0) {
        const deduped = [];
        const seen = new Set();
        for (const r of result.rows) {
          const key = `${r.lat},${r.lng}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(r);
          }
        }

        const { error } = await weatherDb
          .from('city_weather')
          .upsert(deduped, { onConflict: 'lat,lng' });

        if (error) console.warn('[WeatherDB] Upsert error:', JSON.stringify(error));
      }
    } catch (err) {
      console.warn('[WeatherDB] Batch error:', err.message);
    }

    done += batch.length;

    if (i + BATCH_SIZE < allCities.length) {
      console.log(`[WeatherDB] ${done}/${allCities.length} — waiting ${DELAY_MS}ms…`);
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`[WeatherDB] Done — ${done} cities refreshed`);
}

// ── Lấy cache từ Supabase cho 1 thành phố (dùng làm fallback) ──
export async function getCachedWeather(lat, lng) {
  if (!weatherDb) return null;

  const { data, error } = await weatherDb
    .from('city_weather')
    .select('temperature, pm2_5, aqi, updated_at')
    .eq('lat', lat)
    .eq('lng', lng)
    .single();

  if (error) return null;
  return data;
}

// ── Bắt đầu chu kỳ đồng bộ (1 lần ngay lập tức, sau đó mỗi 1 giờ) ──
export function startWeatherSync() {
  if (!weatherDb) return;
  refreshAllCities();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshAllCities, 7200000);
}

export function stopWeatherSync() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
