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

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

def fetch_weather_internal(city):
    try:
        # Get Current Weather
        weather_url = f"{BASE_URL}/weather?q={city}&appid={API_KEY}&units=metric"
        weather_resp = requests.get(weather_url)
        weather_data = weather_resp.json()

        if weather_data.get("cod") != 200:
            return None

        # Get Forecast
        lat, lon = weather_data["coord"]["lat"], weather_data["coord"]["lon"]
        forecast_url = f"{BASE_URL}/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        forecast_resp = requests.get(forecast_url)
        forecast_data = forecast_resp.json()

        return {
            "current": weather_data,
            "forecast": forecast_data
        }
    except Exception:
        return None

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

    data = fetch_weather_internal(city)
    if not data:
        return jsonify({"error": "Target not acquired or city not found"}), 404

    # Update Recent Cities
    city_name_full = f"{data['current']['name']}, {data['current'].get('sys', {}).get('country', '')}"
    save_recent_city(city_name_full)
    return jsonify(data)

@app.route("/api/chat", methods=["POST"])
def chat():
    if not GROQ_API_KEY:
        return jsonify({
            "message": {
                "role": "assistant",
                "content": "AetherAI Assistant terminal offline. Please configure a valid **GROQ_API_KEY** in your server environment variables to initialize satellite dialogue."
            },
            "weather_update": None
        })

    req_data = request.get_json() or {}
    messages = req_data.get("messages", [])
    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # Define tool for weather information
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Fetch the current weather and forecast details for a given city.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "The city name, e.g. Tokyo, Paris, New York"
                        }
                    },
                    "required": ["city"]
                }
            }
        }
    ]

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # System instruction to be helpful and weather-focused
    system_msg = {
        "role": "system",
        "content": (
            "You are WeatherBot, a premium holographic AI weather assistant. Speak with a refined, sophisticated, slightly futuristic tone (like an advanced Tesla/Apple virtual assistant). "
            "Always utilize the `get_weather` tool if the user asks about weather or conditions in any city. "
            "In your responses, always structure your suggestions using bold text and clear spacing: "
            "1. **Weather Summary**: Precise and engaging. "
            "2. **Outdoors & Lifestyle Suitability**: Comment specifically on suitability for activities like cricket, jogging, gardening, washing your car, or traveling based on the data. "
            "3. **Clothing Recommendation**: Tailored to the temperature and precipitation. "
            "4. **Health & Wellness Alert**: Provide actionable advice regarding hydration, UV exposure, storm warnings, or comfort indices."
        )
    }

    # Ensure system message is first
    if not any(m.get("role") == "system" for m in messages):
        messages.insert(0, system_msg)

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto"
    }

    try:
        response = requests.post(GROQ_URL, headers=headers, json=payload)
        res_json = response.json()

        if "choices" not in res_json:
            # Fallback model in case the 70b model hits limits
            payload["model"] = "llama3-8b-8192"
            response = requests.post(GROQ_URL, headers=headers, json=payload)
            res_json = response.json()
            if "choices" not in res_json:
                return jsonify({"error": "Failed to get response from Groq AI models", "details": res_json}), 500

        choice = res_json["choices"][0]
        message = choice.get("message", {})

        tool_calls = message.get("tool_calls")
        weather_update = None

        if tool_calls:
            messages.append(message)
            for tool_call in tool_calls:
                if tool_call["function"]["name"] == "get_weather":
                    args = json.loads(tool_call["function"]["arguments"])
                    city = args.get("city")
                    if city:
                        weather_data = fetch_weather_internal(city)
                        if weather_data:
                            # Save recent city on tool fetch
                            city_name_full = f"{weather_data['current']['name']}, {weather_data['current'].get('sys', {}).get('country', '')}"
                            save_recent_city(city_name_full)

                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "name": "get_weather",
                                "content": json.dumps(weather_data)
                            })
                            weather_update = weather_data
                        else:
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "name": "get_weather",
                                "content": json.dumps({"error": f"City '{city}' could not be resolved by OpenWeather."})
                            })

            # Fetch the final answer incorporating the weather tool results
            second_payload = {
                "model": payload["model"],
                "messages": messages
            }
            second_response = requests.post(GROQ_URL, headers=headers, json=second_payload)
            second_res_json = second_response.json()

            if "choices" in second_res_json:
                final_message = second_res_json["choices"][0].get("message", {})
                return jsonify({
                    "message": final_message,
                    "weather_update": weather_update
                })
            else:
                return jsonify({"error": "Failed to resolve final chatbot message", "details": second_res_json}), 500

        return jsonify({
            "message": message,
            "weather_update": None
        })

    except Exception as e:
        return jsonify({"error": "Groq communication failed", "details": str(e)}), 500

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
