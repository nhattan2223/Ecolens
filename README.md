# Earth 3D Visualization — EcoLens

An interactive web application that visualizes Earth's geographic and environmental data in 3D across multiple historical layers. Explore live weather, air pollution, environmental news, and an Eco Risk Score for every country.

## Features
- **3D Globe** — Interactive globe with country polygons, search, and zoom.
- **Time-travel layers** — Temperature, PM2.5, and Forest Cover overlays for specific years.
- **Risk Scale layer** — Real‑time Eco Risk Score (NRI) per country, calculated from live weather & AQI data. Polygon colors reflect danger levels from Ideal Safety (green) to Disaster (purple).
- **Live weather & air quality** — Current temperature, PM2.5, and AQI fetched via OpenWeatherMap.
- **Weather cache / fallback** — All city weather data is automatically saved to Supabase every 2 hours. When the API fails, cached data is used instead.
- **Environmental news** — GNews articles with modal reader and Supabase fallback cache (auto‑cleanup after 5 days).
- **User authentication** — Sign up / Sign in / Password reset via Supabase Auth.
- **Country search** — Fast polygon search with auto‑complete.

## Project Structure
```text
assets/               # Static assets (layer WebP overlays, icons)
data/                 # JSON datasets (countries, historical data)
js/                   # Browser-side application logic
  api.js              # OpenWeatherMap & GNews client-side calls
  api-keys.js         # Public API keys (Supabase, OpenWeather, GNews)
  app.js              # Navigation helpers
  auth.js             # Supabase Auth (sign in / sign up / password reset)
  chart-utils.js      # Canvas-based bar/line charts
  city-panel.js       # City weather panel (live + history)
  data.js             # Shared constants, lookup tables, historical data
  globe-config.js     # Globe.gl initialization, polygon rendering, textures
  main.js             # Main controller (layers, country selection, timeline)
  news.js             # News fetching + Supabase caching
  reviews.js          # User feedback/reviews CRUD
  search.js           # Country search
  weather-db.js       # Weather cache fallback (getCachedWeather)
server.js             # Express server with API proxy + weather/eco sync
sql/                  # Supabase table definitions (run in Supabase SQL Editor)
style.css             # Globe page styles
style_new.css         # Main site styles (nav, footer, etc.)
package.json          # Node dependencies
```

## Getting Started

### 1. Clone and install
```bash
git clone <repo-url>
cd earth-3d
npm install
```

### 2. Configure API keys
Copy `.env.example` to `.env` and fill in your keys:
```env
OPEN_WEATHER_KEY=your_openweathermap_key_here
GNEWS_KEY=your_gnews_key_here
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_or_anon_key
```

API keys are also loaded client-side from `js/api-keys.js` for direct browser API calls.

### 3. Set up Supabase tables
Run the SQL scripts in `sql/` via the Supabase SQL Editor:
1. `create_city_weather.sql` — weather cache table
2. `create_country_eco_scores.sql` — Eco Risk Score table

### 4. Run the server
```bash
npm run dev
```

The server does:
- Serves static files (HTML, JS, CSS, assets)
- Proxies OpenWeatherMap and GNews API calls
- **Weather sync** — fetches all 613 cities every 2 hours and saves to Supabase
- **Eco Score calculation** — computes NRI every 2.5 hours and saves to Supabase

### 5. Open the app
```text
http://localhost:3000/
http://localhost:3000/explore_earth.html
http://localhost:3000/news.html
```

## How the Risk Scale (NRI) works

1. Server reads `weather.temperature`, `weather.pm2_5`, and `weather.aqi` from `city_weather`
2. For each city → **CRS** = `max( max(R_PM2.5, R_Temp) × (1 + 0.15×(AQI-1)), AQI² )`
3. For each country → **NRI** = RMS of top 3 CRS values
4. Globe polygons are colored by NRI:
   - **< 1** — Ideal (light green)
   - **1–4** — Low (dark green)
   - **4–9** — Moderate (yellow)
   - **9–16** — Alarm (red)
   - **> 16** — Disaster (purple)

Enable the layer via the gear button → **🌍 Risk Scale**.

## License
MIT License — see the `LICENSE` file for details.
