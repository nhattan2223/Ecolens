# EcoLens — Earth 3D Environmental Visualization

An interactive web application that visualizes Earth's environmental data on a 3D globe. Explore live weather, air pollution, historical environmental layers, eco events, and real-time risk scores for every country.

## Features

- **3D Globe** — Interactive globe with country polygons, search, zoom, and auto-rotate.
- **Historical Layers** — Temperature, PM2.5, and Forest Cover overlays mapped as year-by-year textures on the globe.
- **Eco Events** — Environmental events (floods, wildfires, cyclones, earthquakes, etc.) plotted on the globe with year filtering.
- **Risk Scale (NRI)** — Real-time National Risk Index per country, calculated from live weather & AQI data. Polygon colors reflect danger levels from Ideal Safety (green) to Disaster (purple).
- **Live Weather & Air Quality** — Current temperature, PM2.5, and AQI fetched via OpenWeatherMap, displayed in a per-city panel with historical charts.
- **Weather Cache** — All city weather data is automatically synced to Supabase every 2 hours.
- **Environmental News** — GNews articles with Supabase fallback cache.
- **User Authentication** — Sign up, Sign in, Password reset via Supabase Auth.
- **API Key Management** — Generate, list, and revoke API keys for external access.
- **Public REST API** — Historical data and eco events endpoints secured with API key authentication.
- **Country Search** — Fast polygon search with alias support and auto-complete.
- **Feedback & Reviews** — User feedback submission and display.

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `index.html` | Landing page with overview |
| About Us | `about_us.html` | Project information |
| Explore | `explore_earth.html` | 3D globe with layers, timeline, city data |
| News | `news.html` | Environmental news feed |
| Feedback | `feedback.html` | User reviews & feedback |
| API Keys | `api-keys.html` | API key management dashboard |

## Project Structure

```text
assets/
  images/               # Static images (favicon, etc.)
  layers/               # Layer texture WebP files
    buimin_layer/       # PM2.5 overlay textures
    dientichrung_layer/ # Forest cover overlay textures
    nhietdo_layer/      # Temperature overlay textures
data/
  country.json          # City coordinates by country
  event.json            # Environmental events by year
  historical_data.json  # Historical data (temp, pm25, forest) per country
js/
  api.js                # OpenWeatherMap & GNews client-side calls
  api-keys.js           # Public API keys config
  app.js                # Navigation helpers
  auth.js               # Supabase Auth (sign in / sign up / password reset)
  chart-utils.js        # Canvas-based bar/line charts
  city-panel.js         # City weather panel (live + history)
  data.js               # Shared constants, lookup tables, layer configs
  globe-config.js       # Globe.gl initialization, polygons, textures
  main.js               # Main controller (layers, country selection, timeline)
  news.js               # News fetching + Supabase caching
  reviews.js            # User feedback/reviews
  search.js             # Country search with aliases
  weather-db.js         # Weather cache fallback
server.js               # Express server (API proxy, weather sync, eco score calc)
style.css               # Globe page styles
style_new.css           # Main site styles (nav, footer, etc.)
footer_styles.css       # Footer-specific styles
package.json            # Node dependencies
ecolens_formula_framework.md  # NRI formula documentation
```

🌐 **Live demo**: [https://nhattan2223.github.io/Ecolens/](https://nhattan2223.github.io/Ecolens/)

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
SUPABASE_KEY=your_supabase_anon_key_here

SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
```

API keys are also loaded client-side from `js/api-keys.js` for browser API calls.

### 3. Run the server

```bash
npm run dev
```

The server handles:
- Serves static files (HTML, JS, CSS, assets)
- Proxies OpenWeatherMap and GNews API calls
- **Weather sync** — fetches all cities every 2 hours and saves to Supabase
- **Eco Score calculation** — computes NRI every 2 hours and saves to `country_eco_scores`
- **API key authentication** — verifies X-API-Key header for public API endpoints
- **Self-ping** — keeps the server awake on Render (every 5 minutes)

### 5. Open the app

```
http://localhost:3000/
```

## How the Risk Scale (NRI) works

1. Server reads `temperature`, `pm2_5`, and `aqi` from `city_weather`
2. For each city → **CRS** = `max( max(R_PM2.5, R_Temp) × (1 + 0.15×(AQI-1)), AQI² )`
3. For each country → **NRI** = RMS of top 3 CRS values
4. Globe polygons are colored by NRI:
   - **<= 1** — Ideal (light green)
   - **1–4** — Low (dark green)
   - **4–9** — Moderate (yellow)
   - **9–16** — Alarm (red)
   - **> 16** — Disaster (purple)

Enable via the gear button → **Risk Scale**. See `ecolens_formula_framework.md` for full formula details.

## Public REST API

The server exposes public API endpoints secured via API key (requires `api_keys` table setup).

**Endpoints:**

- `GET /api/v1/historical/:country` — Historical data for a country (ISO alpha-3 code)
- `GET /api/v1/events` — Environmental events (supports `?year=`, `?type=`, `?country=` filters)
- `POST /api/v1/keys` — Generate a new API key (requires Supabase JWT)
- `GET /api/v1/keys` — List user's API keys (requires Supabase JWT)
- `POST /api/v1/keys/revoke` — Revoke an API key (requires Supabase JWT)

Manage keys at `/api-keys.html` (authenticated users).

## License

MIT License — see the `LICENSE` file for details.
