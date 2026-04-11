import os
import json
import requests
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__)

API_KEY = os.environ.get("OPENWEATHER_API_KEY", "89dffb23048e7128d9108c10e76b34e8")
BASE_URL = "http://api.openweathermap.org/data/2.5"
GEO_URL = "http://api.openweathermap.org/geo/1.0/direct"
RECENT_CITIES_FILE = "recent_cities.json"

def load_recent_cities():
    if os.path.exists(RECENT_CITIES_FILE):
        try:
            with open(RECENT_CITIES_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_recent_city(city):
    recent_cities = load_recent_cities()
    if city not in recent_cities:
        recent_cities.insert(0, city)
        recent_cities = recent_cities[:10]
        with open(RECENT_CITIES_FILE, "w") as f:
            json.dump(recent_cities, f)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/icons/<path:filename>")
def serve_icons(filename):
    return send_from_directory("icons", filename)

@app.route("/api/recent-cities")
def get_recent_cities():
    return jsonify(load_recent_cities())

@app.route("/api/city-suggestions")
def get_city_suggestions():
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify([])
    try:
        url = f"{GEO_URL}?q={query}&limit=4&appid={API_KEY}"
        resp = requests.get(url).json()
        suggestions = [f"{c['name']}, {c.get('country', '')}" for c in resp if 'name' in c]
        return jsonify(suggestions)
    except Exception as e:
        return jsonify([])

@app.route("/api/weather")
def get_weather():
    city = request.args.get("city")
    if not city:
        return jsonify({"error": "City parameter missing"}), 400

    try:
        # Get Current Weather
        weather_url = f"{BASE_URL}/weather?q={city}&appid={API_KEY}&units=metric"
        weather_data = requests.get(weather_url).json()

        if weather_data.get("cod") != 200:
            return jsonify({"error": weather_data.get("message", "Target not acquired")}), int(weather_data.get("cod", 400))

        # Update Recent Cities
        city_name_full = f"{weather_data['name']}, {weather_data.get('sys', {}).get('country', '')}"
        save_recent_city(city_name_full)

        # Get Forecast
        lat, lon = weather_data["coord"]["lat"], weather_data["coord"]["lon"]
        forecast_url = f"{BASE_URL}/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        forecast_data = requests.get(forecast_url).json()

        return jsonify({
            "current": weather_data,
            "forecast": forecast_data
        })
    except Exception as e:
        return jsonify({"error": "Satellite connection failed or API issue.", "details": str(e)}), 500

@app.route("/api/weather-by-ip")
def get_weather_by_ip():
    try:
        city = requests.get("https://ipinfo.io/json").json().get("city", "Unknown")
        if city != "Unknown":
            return jsonify({"city": city})
        return jsonify({"error": "Could not determine city"}), 400
    except Exception:
        return jsonify({"error": "IP lookup failed"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
