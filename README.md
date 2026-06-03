# Earth 3D Visualization

An interactive web application that visualizes Earth's geographic and environmental data in 3D across multiple historical layers. Users can explore different years, view country information, climate data, live weather, air pollution, and environmental news.

## Features
- **Time-travel layers** - Browse land-use and climate layers for specific years via WebP image overlays.
- **Country lookup** - Click on a country to see detailed information pulled from `data/country.json`.
- **Historical climate data** - Visualize temperature trends using the `data/historical_data.json` dataset.
- **Live weather and air quality** - Fetch OpenWeatherMap data through the local backend proxy.
- **Environmental news** - Fetch GNews articles through the local backend proxy.
- **Search and navigation** - Fast city-panel search, map zoom/pan, and a responsive UI built with vanilla JavaScript.

## Project Structure
```text
assets/              # Static assets (images, layers, icons)
  layers/            # Year-specific WebP overlays
  images/            # Miscellaneous images
data/                # JSON datasets
js/                  # Browser-side application logic
server.js            # Local API proxy for OpenWeatherMap and GNews
package.json         # Node scripts and backend dependencies
style.css            # Globe page styles
style_new.css        # Main site styles
index.html           # Landing page
explore_earth.html   # Main 3D globe view
news.html            # Environmental news page
```

## Getting Started
1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd earth-3d
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API keys**

   Copy `.env.example` to `.env`, then add your keys:
   ```env
   OPEN_WEATHER_KEY=your_openweathermap_key_here
   GNEWS_KEY=your_gnews_key_here
   PORT=3000
   ```

4. **Run the local backend**
   ```bash
   npm run dev
   ```

5. **Open the app**
   ```text
   http://localhost:3000/explore_earth.html
   http://localhost:3000/news.html
   ```

The OpenWeatherMap and GNews keys are read by `server.js`, so they are not exposed in browser-side JavaScript. Do not open the HTML files directly when using live weather or news APIs, because `/api/get-weather` and `/api/get-news` require the Node server.

## Contributing
- Fork the repo and create a feature branch.
- Keep JavaScript modular; add new layers under `assets/layers/` and reference them in `js/globe-config.js`.
- Run `npm install` before using the local API proxy.

## License
MIT License - see the `LICENSE` file for details.
