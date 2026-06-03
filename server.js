import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OWM_KEY = process.env.OPEN_WEATHER_KEY;
const GNEWS_KEY = process.env.GNEWS_KEY;

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

app.listen(PORT, () => {
  console.log(`EcoLens server running at http://localhost:${PORT}`);
});
