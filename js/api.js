// api.js - Call the local project backend proxy instead of Supabase Edge Functions.

async function callLocalApi(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function getCurrentWeather(lat, lon) {
  try {
    const data = await callLocalApi('/api/get-weather', {
      method: 'POST',
      body: JSON.stringify({ lat, lon, type: 'weather' }),
    });

    if (!data.main) {
      console.warn('[getCurrentWeather] Invalid response:', data);
      return null;
    }

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
    const data = await callLocalApi('/api/get-weather', {
      method: 'POST',
      body: JSON.stringify({ lat, lon, type: 'pollution' }),
    });

    if (!data.list || !data.list[0]) {
      console.warn('[getAirPollution] Invalid response:', data);
      return null;
    }

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
    const data = await callLocalApi('/api/get-news', {
      method: 'GET',
    });

    if (data.errors) {
      console.warn('[getEnvironmentNews] GNews returned errors:', data.errors);
      return [];
    }

    return data.articles || [];
  } catch (err) {
    console.error('[getEnvironmentNews] Error:', err);
    return [];
  }
}
