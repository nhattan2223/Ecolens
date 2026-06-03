// weather-db.js — Cache thời tiết / AQI xuống Supabase (fallback khi API lỗi)
// Mỗi 1 giờ: fetch toàn bộ 613 thành phố với batch 15 city/lần, cách nhau 30s
// để không vượt quá 60 calls/phút của OpenWeatherMap free plan.

const { SUPABASE_URL, SUPABASE_KEY } = window.EcoLensApiKeys || {};
const weatherDb = SUPABASE_URL && SUPABASE_KEY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let refreshTimer = null;

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

async function fetchCityData(city) {
  const key = window.EcoLensApiKeys?.OPEN_WEATHER_KEY;
  if (!key) throw new Error('Missing OPEN_WEATHER_KEY');

  const [weatherRes, pollutionRes] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lng}&appid=${key}&units=metric`),
    fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lng}&appid=${key}`)
  ]);

  if (!weatherRes.ok) throw new Error(`Weather HTTP ${weatherRes.status}`);
  if (!pollutionRes.ok) throw new Error(`Pollution HTTP ${pollutionRes.status}`);

  const w = await weatherRes.json();
  const p = await pollutionRes.json();

  return {
    city_name: city.name,
    country: city.country,
    lat: city.lat,
    lng: city.lng,
    temperature: w.main?.temp ?? null,
    pm2_5: p.list?.[0]?.components?.pm2_5 ?? null,
    aqi: p.list?.[0]?.main?.aqi ?? null,
    updated_at: new Date().toISOString()
  };
}

// ── Gọi API cho tất cả thành phố, theo batch để tránh rate limit ──
export async function refreshAllCities() {
  if (!weatherDb) {
    console.warn('[WeatherDB] Supabase not available');
    return;
  }

  console.log('[WeatherDB] Fetching all cities…');

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

    const results = await Promise.allSettled(
      batch.map(c => fetchCityData(c))
    );

    const rows = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) rows.push(r.value);
    }

    if (rows.length > 0) {
      const deduped = [];
      const seen = new Set();
      for (const r of rows) {
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
