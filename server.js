import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import rateLimit from 'express-rate-limit';

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const OWM_KEY = process.env.OPEN_WEATHER_KEY;
const GNEWS_KEY = process.env.GNEWS_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE = SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

const SUPABASE_SERVICE = SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Rate limiter cho API endpoints ───────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Rate limit: 30 req/min per key.' },
});

// ── API Key authentication middleware ────────────────────────
async function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing X-API-Key header' });

  try {
    const hash = createHash('sha256').update(apiKey).digest('hex');
    if (!SUPABASE_SERVICE) return res.status(500).json({ error: 'API key verification unavailable' });

    const { data, error } = await SUPABASE_SERVICE
      .from('api_keys')
      .select('id, user_id, is_active')
      .eq('key_hash', hash)
      .single();

    if (error || !data) return res.status(401).json({ error: 'Invalid API key' });
    if (!data.is_active) return res.status(401).json({ error: 'API key has been revoked' });

    // Update last_used_at (fire-and-forget)
    SUPABASE_SERVICE.from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
      .then().catch(() => {});

    req.apiKeyUserId = data.user_id;
    next();
  } catch (err) {
    console.error('[apiKey] Error:', err.message);
    res.status(500).json({ error: 'API key verification failed' });
  }
}

// ── Verify Supabase JWT (for key management endpoints) ─────
async function requireUser(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Authorization header' });

  try {
    if (!SUPABASE) return res.status(500).json({ error: 'Auth service unavailable' });
    const { data: { user }, error } = await SUPABASE.auth.getUser(auth.slice(7));
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  } catch (err) {
    console.error('[auth] Error:', err.message);
    res.status(500).json({ error: 'Auth verification failed' });
  }
}

function requireOwmKey(req, res, next) {
  if (!OWM_KEY) return res.status(500).json({ error: 'Missing OPEN_WEATHER_KEY on server' });
  next();
}

function isValidCoordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

// ── Proxy: Current weather ─────────────────────────────────
app.get('/api/weather', requireOwmKey, async (req, res) => {
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
app.get('/api/pollution', requireOwmKey, async (req, res) => {
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

// Eco score: lần đầu sau 30 phút, sau đó mỗi 2 giờ (cùng chu kỳ weather sync)
setTimeout(() => {
  calculateEcoScores();
  setInterval(calculateEcoScores, 7200000);
}, 1800000);

// ══════════════════════════════════════════════════════════════
// API KEY MANAGEMENT (requires Supabase JWT)
// ══════════════════════════════════════════════════════════════

// ── Generate a new API key ──────────────────────────────────
app.post('/api/v1/keys', requireUser, async (req, res) => {
  try {
    const name = (req.body.name || '').trim().slice(0, 100);
    const rawKey = 'ec_' + randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 12) + '…';

    if (!SUPABASE_SERVICE) return res.status(500).json({ error: 'Key service unavailable' });

    const { error } = await SUPABASE_SERVICE.from('api_keys').insert({
      user_id: req.user.id,
      key_hash: hash,
      key_prefix: prefix,
      name,
    });

    if (error) return res.status(500).json({ error: 'Failed to create key: ' + error.message });

    res.status(201).json({ key: rawKey, prefix, name });
    console.log(`[apiKeys] Key generated for user ${req.user.id}`);
  } catch (err) {
    console.error('[apiKeys] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate key' });
  }
});

// ── List user's API keys ────────────────────────────────────
app.get('/api/v1/keys', requireUser, async (req, res) => {
  try {
    if (!SUPABASE_SERVICE) return res.status(500).json({ error: 'Key service unavailable' });

    const { data, error } = await SUPABASE_SERVICE
      .from('api_keys')
      .select('id, key_prefix, name, created_at, last_used_at, is_active')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ keys: data });
  } catch (err) {
    console.error('[apiKeys] List error:', err.message);
    res.status(500).json({ error: 'Failed to list keys' });
  }
});

// ── Revoke an API key ──────────────────────────────────────
app.post('/api/v1/keys/revoke', requireUser, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing key id' });

    if (!SUPABASE_SERVICE) return res.status(500).json({ error: 'Key service unavailable' });

    const { error } = await SUPABASE_SERVICE
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    console.log(`[apiKeys] Key ${id} revoked by user ${req.user.id}`);
  } catch (err) {
    console.error('[apiKeys] Revoke error:', err.message);
    res.status(500).json({ error: 'Failed to revoke key' });
  }
});

// ══════════════════════════════════════════════════════════════
// PUBLIC API ENDPOINTS (requires X-API-Key)
// ══════════════════════════════════════════════════════════════

// ── Historical data for a country ───────────────────────────
app.get('/api/v1/historical/:country', apiLimiter, requireApiKey, async (req, res) => {
  try {
    const country = req.params.country.toUpperCase();
    const raw = await readFile(join(__dirname, 'data', 'historical_data.json'), 'utf-8');
    const all = JSON.parse(raw);
    const data = all[country] || null;
    if (!data) return res.status(404).json({ error: 'Country not found', country });
    res.json({ country, data });
  } catch (err) {
    console.error('[api] historical error:', err.message);
    res.status(500).json({ error: 'Failed to load historical data' });
  }
});

// ── Eco events ─────────────────────────────────────────────
app.get('/api/v1/events', apiLimiter, requireApiKey, async (req, res) => {
  try {
    const raw = await readFile(join(__dirname, 'data', 'event.json'), 'utf-8');
    const all = JSON.parse(raw);
    let events = [];

    for (const [year, list] of Object.entries(all)) {
      for (const ev of list) {
        events.push({ ...ev, year: parseInt(year) });
      }
    }

    // Filter by year
    if (req.query.year) {
      const y = parseInt(req.query.year);
      if (!isNaN(y)) events = events.filter(e => e.year === y);
    }
    // Filter by type
    if (req.query.type) {
      const t = req.query.type.toLowerCase();
      events = events.filter(e => e.type.toLowerCase().includes(t));
    }
    // Filter by country
    if (req.query.country) {
      const c = req.query.country.toLowerCase();
      events = events.filter(e => e.country.toLowerCase().includes(c));
    }

    res.json({ count: events.length, events });
  } catch (err) {
    console.error('[api] events error:', err.message);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', owm: !!OWM_KEY, gnews: !!GNEWS_KEY, supabase: !!SUPABASE, supabaseService: !!SUPABASE_SERVICE });
});

app.listen(PORT, () => {
  console.log(`EcoLens backend running at http://localhost:${PORT}`);
  if (!OWM_KEY) console.warn('  WARN: OPEN_WEATHER_KEY not set');
  if (!GNEWS_KEY) console.warn('  WARN: GNEWS_KEY not set');
  if (!SUPABASE) console.warn('  WARN: Supabase not configured');
  if (!SUPABASE_SERVICE) console.warn('  WARN: SUPABASE_SERVICE_KEY not set — API key auth will not work');

  // Tự ping mỗi 5 phút để Render không ngủ
  const PING_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try { await fetch(`${PING_URL}/api/health`); } catch {}
  }, 300000);
  console.log(`  Self-ping every 5m at ${PING_URL}/api/health`);

  // Chạy weather sync đầu tiên sau 30 giây (khi server đã ổn định)
  setTimeout(refreshAllCities, 30000);
});
