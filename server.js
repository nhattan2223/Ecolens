import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

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

// ── Helper ─────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  'https://itstunglam.github.io',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function requireKey(req, res, next) {
  if (!OWM_KEY) return res.status(500).json({ error: 'Missing OPEN_WEATHER_KEY on server' });
  next();
}

function isValidCoordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

// ── Proxy: Current weather ─────────────────────────────────
app.get('/api/weather', requireKey, async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!isValidCoordinate(lat, -90, 90) || !isValidCoordinate(lon, -180, 180)) {
      return res.status(400).json({ error: 'Invalid lat or lon' });
    }
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[weather] Error:', err.message);
    res.status(500).json({ error: 'Weather API error' });
  }
});

// ── Proxy: Air pollution ───────────────────────────────────
app.get('/api/pollution', requireKey, async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!isValidCoordinate(lat, -90, 90) || !isValidCoordinate(lon, -180, 180)) {
      return res.status(400).json({ error: 'Invalid lat or lon' });
    }
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[pollution] Error:', err.message);
    res.status(500).json({ error: 'Pollution API error' });
  }
});

// ── Proxy: Batch weather (dùng cho weather-db sync) ────────
app.post('/api/weather-batch', requireKey, async (req, res) => {
  try {
    const { cities } = req.body || {};
    if (!Array.isArray(cities) || cities.length === 0) {
      return res.status(400).json({ error: 'cities array required' });
    }

    const results = await Promise.allSettled(cities.map(async (city) => {
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
    }));

    const rows = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    res.json({ rows, total: cities.length, ok: rows.length });
  } catch (err) {
    console.error('[weather-batch] Error:', err.message);
    res.status(500).json({ error: 'Batch weather error' });
  }
});

// ── Proxy: News ────────────────────────────────────────────
app.get('/api/news', async (req, res) => {
  try {
    if (!GNEWS_KEY) return res.status(500).json({ error: 'Missing GNEWS_KEY on server' });
    const query = encodeURIComponent('climate change OR environment');
    const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=6&apikey=${GNEWS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[news] Error:', err.message);
    res.status(500).json({ error: 'News API error' });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', owm: !!OWM_KEY, gnews: !!GNEWS_KEY, supabase: !!SUPABASE });
});

app.listen(PORT, () => {
  console.log(`EcoLens backend running at http://localhost:${PORT}`);
  if (!OWM_KEY) console.warn('  WARN: OPEN_WEATHER_KEY not set');
  if (!GNEWS_KEY) console.warn('  WARN: GNEWS_KEY not set');
  if (!SUPABASE) console.warn('  WARN: Supabase not configured');
});
