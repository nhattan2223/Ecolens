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

// ── Helper ─────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  'https://itstunglam.github.io',
  'https://nhattan2223.github.io',
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

// ── Weather sync: fetch + lưu city_weather mỗi 2 giờ ──
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
  const [weatherRes, pollutionRes] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lng}&appid=${OWM_KEY}&units=metric`),
    fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lng}&appid=${OWM_KEY}`)
  ]);
  if (!weatherRes.ok) throw new Error(`Weather ${weatherRes.status}`);
  if (!pollutionRes.ok) throw new Error(`Pollution ${pollutionRes.status}`);
  const w = await weatherRes.json();
  const p = await pollutionRes.json();
  return {
    city_name: city.name, country: city.country, lat: city.lat, lng: city.lng,
    temperature: w.main?.temp ?? null, pm2_5: p.list?.[0]?.components?.pm2_5 ?? null,
    aqi: p.list?.[0]?.main?.aqi ?? null, updated_at: new Date().toISOString()
  };
}

async function refreshAllCities() {
  if (!SUPABASE) { console.warn('[Server] Supabase not configured'); return; }
  console.log('[Server] Weather sync started…');
  let entries;
  try { entries = await loadCities(); } catch (err) { console.warn('[Server] Could not load cities:', err.message); return; }
  const allCities = flattenCities(entries);
  const BATCH_SIZE = 15, DELAY_MS = 30000;
  let done = 0;
  for (let i = 0; i < allCities.length; i += BATCH_SIZE) {
    const batch = allCities.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(c => fetchCityData(c)));
    const rows = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    if (rows.length > 0) {
      const deduped = []; const seen = new Set();
      for (const r of rows) { const k = `${r.lat},${r.lng}`; if (!seen.has(k)) { seen.add(k); deduped.push(r); } }
      const { error } = await SUPABASE.from('city_weather').upsert(deduped, { onConflict: 'lat,lng' });
      if (error) console.warn('[Server] Upsert error:', error.message);
    }
    done += batch.length;
    if (i + BATCH_SIZE < allCities.length) await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.log(`[Server] Weather sync done — ${done} cities`);
}

setInterval(refreshAllCities, 7200000);

// ── Eco Score: tính NRI từ city_weather, chạy mỗi 2.5 giờ ──
async function calculateEcoScores() {
  if (!SUPABASE) { console.warn('[Server] Supabase not configured'); return; }
  console.log('[Server] Calculating eco scores…');

  const { data, error } = await SUPABASE.from('city_weather').select('city_name, country, temperature, pm2_5, aqi');
  if (error) { console.warn('[Server] Could not load city_weather:', error.message); return; }
  if (!data || !data.length) { console.warn('[Server] No city_weather data'); return; }

  const grouped = {};
  for (const row of data) {
    if (!grouped[row.country]) grouped[row.country] = [];
    grouped[row.country].push(row);
  }

  const scores = [];
  for (const [country, cities] of Object.entries(grouped)) {
    const crsList = cities.map(c => {
      const pm25 = c.pm2_5 != null ? c.pm2_5 : 0;
      const temp = c.temperature != null ? c.temperature : 22;
      const aqi = c.aqi != null ? c.aqi : 1;
      const rPm25 = Math.pow(pm25 / 25, 1.5);
      const rTemp = Math.pow(Math.abs(temp - 22) / 10, 2);
      return Math.max(Math.max(rPm25, rTemp) * (1 + 0.15 * (aqi - 1)), aqi * aqi);
    });
    crsList.sort((a, b) => b - a);
    const top3 = crsList.slice(0, 3);
    const sumSq = top3.reduce((s, v) => s + v * v, 0);
    const nri = Math.round(Math.sqrt(sumSq / top3.length) * 100) / 100;
    scores.push({ country, nri, updated_at: new Date().toISOString() });
  }

  if (scores.length > 0) {
    const { error: upErr } = await SUPABASE
      .from('country_eco_scores')
      .upsert(scores, { onConflict: 'country' });
    if (upErr) console.warn('[Server] Eco scores upsert error:', upErr.message);
    else console.log(`[Server] Eco scores calculated for ${scores.length} countries`);
  }
}

// Eco score: lần đầu sau 30 phút, sau đó mỗi 2.5 giờ
setTimeout(() => {
  calculateEcoScores();
  setInterval(calculateEcoScores, 9000000);
}, 1800000);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', owm: !!OWM_KEY, gnews: !!GNEWS_KEY, supabase: !!SUPABASE });
});

app.listen(PORT, () => {
  console.log(`EcoLens backend running at http://localhost:${PORT}`);
  if (!OWM_KEY) console.warn('  WARN: OPEN_WEATHER_KEY not set');
  if (!GNEWS_KEY) console.warn('  WARN: GNEWS_KEY not set');
  if (!SUPABASE) console.warn('  WARN: Supabase not configured');

  // Tự ping mỗi 10 phút để Render không ngủ
  const PING_URL = `http://localhost:${PORT}/api/health`;
  setInterval(async () => {
    try { await fetch(PING_URL); } catch {}
  }, 600000);
  console.log(`  Self-ping every 10m at ${PING_URL}`);

  // Chạy weather sync đầu tiên sau 30 giây (khi server đã ổn định)
  setTimeout(refreshAllCities, 30000);
});
