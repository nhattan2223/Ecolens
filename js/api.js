// api.js — Gọi API qua backend proxy (giấu API key)

function getBackendUrl() {
  return window.EcoLensApiKeys?.BACKEND_URL || 'http://localhost:3000';
}

export async function getCurrentWeather(lat, lon) {
  try {
    const url = `${getBackendUrl()}/api/weather?lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.main) return null;
    return {
      temp: data.main.temp,
      cityName: data.name,
    };
  } catch (err) {
    console.error('[getCurrentWeather] Error:', err);
    return null;
  }
}

export async function getAirPollution(lat, lon) {
  try {
    const url = `${getBackendUrl()}/api/pollution?lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.list || !data.list[0]) return null;
    const p = data.list[0];
    return {
      aqi: p.main.aqi,
      pm2_5: p.components.pm2_5,
    };
  } catch (err) {
    console.error('[getAirPollution] Error:', err);
    return null;
  }
}

export async function getEnvironmentNews() {
  try {
    const url = `${getBackendUrl()}/api/news`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.errors) {
      console.warn('[getEnvironmentNews] GNews errors:', data.errors);
      return [];
    }
    return data.articles || [];
  } catch (err) {
    console.error('[getEnvironmentNews] Error:', err);
    return [];
  }
}
