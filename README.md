# ⚡ AetherWeather AI - Luxury Atmospheric Satellite Dashboard

AetherWeather is an award-winning, premium, next-generation weather satellite terminal and AI assistant. Fusing design principles from Apple Weather, Nothing OS, and Tesla virtual interfaces, it transforms mundane weather data into a gorgeous, interactive liquid-glass dashboard.

![Dashboard Preview](file:///C:/Users/Infinity/.gemini/antigravity-ide/brain/649ea1ae-f878-40ce-ae37-829498e8c774/tokyo_weather_and_chat_1783613121521.png)

## 🌌 Core Features

### 1. Glassmorphism 2.0 & Weather-Responsive Auroras
- Frosted liquid-glass panels (`backdrop-filter: blur(32px)`), neon specular borders, and organic grain overlays.
- Dynamic background auroras that automatically transition gradients based on the local weather condition (gold/amber for Sunny, cyan/blue for Rain, purple/black for Storm, silver/blue for Snow).

### 2. Apple Weather-Inspired Scrolling Timelines
- Scrollable hourly timelines featuring custom-designed animated SVG weather stickers (spinning sun, twinkling stars, drifting clouds, falling rain tracks).
- Interactive 48-hour trend area charts mapping temperature, humidity, wind, and barometric pressure.

### 3. Expandable Forecast Cards & Comfort Indices
- 7-day forecast cards that smoothly spring-expand to display morning, afternoon, evening, and night slots.
- Provides client-side and server-side AI-driven suitability scores (workout, travel comfort, farming, skin care, hydration) alongside contextual clothing recommendations.

### 4. Interactive Weather Radar
- Integrated Leaflet satellite map using custom dark theme tiling layers.
- Interactive toggle controls overlaying live precipitation radar, cloud layers, temperature heatmaps, and wind vectors.

### 5. Groq Llama 3.3 Chatbot Integration & UI Sync
- Integrated sidebar chat widget querying `llama-3.3-70b-versatile` over Groq.
- The assistant is capable of calling weather tools to retrieve real-time atmospheric readings and formulate witty, tech-savvy suggestions.
- **UI Sync**: If you ask the chatbot about a city (e.g. *"Should I bring an umbrella to Tokyo tomorrow?"*), the client automatically captures the response and synchronizes the entire dashboard background, radar map, metrics, and forecast timelines with Tokyo instantly.

---

## 🧰 Tech Stack

- **Backend**: Python, Flask, Requests, Groq SDK
- **Frontend**: HTML5, Vanilla CSS (Liquid Glassmorphism 2.0 System), JS ES6
- **Visuals & Charts**: Leaflet.js, Chart.js, Lucide Icons, Custom Animated SVGs
- **Model Node**: Llama 3.3 (70B) & Llama 3 (8B) via Groq API

---

## ⚙️ Setup & Activation

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Credentials
Set your API keys as environment variables:
```bash
set OPENWEATHER_API_KEY="your_openweather_key"
set GROQ_API_KEY="your_groq_key"
```
*Note: A default fallback key is configured in `app.py` for immediate execution.*

### 3. Launch Terminal Server
```bash
python app.py
```
Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser to initialize the satellite connection.
