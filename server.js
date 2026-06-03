import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const OWM_KEY = process.env.OPEN_WEATHER_KEY;
const GNEWS_KEY = process.env.GNEWS_KEY;
const SUPABASE = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

function isValidCoordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

app.post('/api/get-weather', async (req, res) => {
  try {
    if (!OWM_KEY) {
      return res.status(500).json({ error: 'Missing OPEN_WEATHER_KEY in .env' });
    }

    const { lat, lon, type } = req.body || {};

    if (!isValidCoordinate(lat, -90, 90) || !isValidCoordinate(lon, -180, 180)) {
      return res.status(400).json({ error: 'Invalid lat or lon' });
    }

    const endpoint = type === 'pollution'
      ? `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;

    const response = await fetch(endpoint);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[get-weather] Error:', err);
    return res.status(500).json({ error: 'Weather API error' });
  }
});

async function handleGetNews(_req, res) {
  try {
    if (!GNEWS_KEY) {
      return res.status(500).json({ error: 'Missing GNEWS_KEY in .env' });
    }

    const query = encodeURIComponent('climate change OR environment');
    const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=6&apikey=${GNEWS_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[get-news] Error:', err);
    return res.status(500).json({ error: 'News API error' });
  }
}

app.get('/api/get-news', handleGetNews);
app.get('/api/get-new', handleGetNews);

// ── Weather cache sync (chạy nền, không cần client) ──
async function loadCities() {
  const raw = await readFile(join(__dirname, 'data', 'country.json'), 'utf-8');
  return JSON.parse(raw);
}

function flattenCities(entries) {
  const all = [];
  for (const entry of entries) {
    for (const city of entry.cities) {
      all.push({ name: city.name, country: entry.country, lat: city.lat, lng: city.lng });
    }
  }
  return all;
}

async function fetchCityData(city) {
  if (!OWM_KEY) throw new Error('Missing OPEN_WEATHER_KEY');

  const [weatherRes, pollutionRes] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lng}&appid=${OWM_KEY}&units=metric`),
    fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lng}&appid=${OWM_KEY}`)
  ]);
  if (!weatherRes.ok) throw new Error(`Weather ${weatherRes.status}`);
  if (!pollutionRes.ok) throw new Error(`Pollution ${pollutionRes.status}`);

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

async function refreshAllCities() {
  if (!SUPABASE) { console.warn('[Server] Supabase not configured'); return; }
  console.log('[Server] Weather sync started…');

  let entries;
  try {
    entries = await loadCities();
  } catch (err) {
    console.warn('[Server] Could not load cities:', err.message);
    return;
  }

  const allCities = flattenCities(entries);
  const BATCH_SIZE = 15;
  const DELAY_MS = 30000;
  let done = 0;

  for (let i = 0; i < allCities.length; i += BATCH_SIZE) {
    const batch = allCities.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(c => fetchCityData(c)));

    const rows = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) rows.push(r.value);
    }

    if (rows.length > 0) {
      const deduped = [];
      const seen = new Set();
      for (const r of rows) {
        const key = `${r.lat},${r.lng}`;
        if (!seen.has(key)) { seen.add(key); deduped.push(r); }
      }

      const { error } = await SUPABASE
        .from('city_weather')
        .upsert(deduped, { onConflict: 'lat,lng' });

      if (error) console.warn('[Server] Upsert error:', error.message);
    }

    done += batch.length;
    if (i + BATCH_SIZE < allCities.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`[Server] Weather sync done — ${done} cities`);
}

// Chạy sync ngay khi server khởi động, sau đó mỗi 2 giờ
refreshAllCities();
setInterval(refreshAllCities, 7200000);

app.listen(PORT, () => {
  console.log(`EcoLens server running at http://localhost:${PORT}`);
});
