// api.js — gọi API trực tiếp từ browser (không cần proxy Node.js)

const { OPEN_WEATHER_KEY, GNEWS_KEY } = window.EcoLensApiKeys || {};

export async function getCurrentWeather(lat, lon) {
  try {
    if (!OPEN_WEATHER_KEY) throw new Error('Missing OPEN_WEATHER_KEY');
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_KEY}&units=metric`;
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
    if (!OPEN_WEATHER_KEY) throw new Error('Missing OPEN_WEATHER_KEY');
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_KEY}`;
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
    if (!GNEWS_KEY) throw new Error('Missing GNEWS_KEY');
    const query = encodeURIComponent('climate change OR environment');
    const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=6&apikey=${GNEWS_KEY}`;
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
