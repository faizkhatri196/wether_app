from ast import copy_location
import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
from PIL import Image, ImageTk
import requests
import os
import math
import datetime
from itertools import count
import threading


# ========== CONFIG ==========
API_KEY = "89dffb23048e7128d9108c10e76b34e8"  # Replace with your OpenWeatherMap API key
BASE_URL = "http://api.openweathermap.org/data/2.5/weather"
ICON_PATH = "icons/"

# ========== FETCH WEATHER ==========
def get_location():
    try:
          response = requests.get("https://ipinfo.io/json")
          data = response.json()
          return data.get("city", "Unknown")
    except:
        return "Unknown"
    
    
    
    # ================= ANIMATED BACKGROUND =================
class AnimatedGIF(tk.Label):
    def __init__(self, master, path, *args, **kwargs):
        tk.Label.__init__(self, master, *args, **kwargs)
        self.frames = []
        self.loc = 0
        self.delay = 100
        self.load(path)

    def load(self, path):
        im = Image.open(path)
        for frame in count(1):
            try:
                self.frames.append(ImageTk.PhotoImage(im.copy()))
                im.seek(frame)
            except EOFError:
                break
        self.after(self.delay, self.play)

    def play(self):
        frame = self.frames[self.loc]
        self.loc = (self.loc + 1) % len(self.frames)
        self.config(image=frame)
        self.after(self.delay, self.play)
        
        
        # ================= BACKGROUND LOGIC =================
def update_background(weather_main):
    global bg_animation
    current_hour = datetime.datetime.now().hour
    is_night = current_hour >= 18 or current_hour <= 6

    if 'rain' in weather_main.lower():
        bg_file = 'rainy1.gif'
    elif 'thunder' in weather_main.lower():
        bg_file = 'snow.gif'
    elif 'cloud' in weather_main.lower():
        bg_file = 'thunder.gif'
    elif 'tornado' in weather_main.lower():
        bg_file = 'rainy.gif'
    elif is_night:
        bg_file = 'night1.gif'
    else:
        bg_file = 'sunlight.gif'

    img_path = os.path.join("icons", bg_file)

    if 'bg_animation' in globals() and bg_animation:
        bg_animation.destroy()

    bg_animation = AnimatedGIF(root, img_path)
    bg_animation.place(x=0, y=0, relwidth=1, relheight=1)
    bg_animation.lower()  # Send background behind all widgets


def get_weather():
    city = city_entry.get().strip()
    if not city:
        city=get_location()
        if city == "Unknown":
         messagebox.showwarning("Input Error", "Please enter a city name.")
        return
    
    try:
        url = f"{BASE_URL}?q={city}&appid={API_KEY}&units=metric"
        response = requests.get(url)
        data = response.json()

        if data["cod"] != 200:
            messagebox.showerror("Error", f"City not found: {city}")
            return

        weather_main = data["weather"][0]["main"]
        desc = data["weather"][0]["description"].title()
        temp = data["main"]["temp"]
        feels_like = data["main"]["feels_like"]
        humidity = data["main"]["humidity"]
        pressure = data["main"]["pressure"]
        wind_speed = data["wind"]["speed"]
        lon = data["coord"]["lon"]
        lat = data["coord"]["lat"]
        pressure = data['main']['pressure']
        wind_speed = data['wind']['speed']
        wind_deg = data['wind']['deg']
        clouds = data['clouds']['all']
        weather_desc = data['weather'][0]['description'].title()
        sunrise = datetime.datetime.fromtimestamp(data['sys']['sunrise']).strftime('%I:%M %p')
        sunset = datetime.datetime.fromtimestamp(data['sys']['sunset']).strftime('%I:%M %p')
        lon = data['coord']['lon']
        lat = data['coord']['lat']

        # Update Background
        update_background(weather_main)

        # Update UI Labels
        result_label.config(
            text=f"📍 {city}\n"
                f"🌤 {desc}\n"
                f"🌡 Temp: {temp:.1f}°C (Feels like {feels_like:.1f}°C)\n"
                f"💧 Humidity: {humidity}%\n"
                f"💨 Wind Speed: {wind_speed} m/s\n"
                f"📊 Pressure: {pressure} hPa\n"
                f"🧭 Coordinates: {lat}, {lon}"
                f"🤗 Feels Like: {feels_like:.1f}°C\n\n"
                f"☁️ Weather: {weather_desc}\n"
                f"💧 Humidity: {humidity}%   💨 Wind: {wind_speed} m/s {wind_deg}\n"
                f"🌫️ Clouds: {clouds}%   🧭 Pressure: {pressure} hPa\n\n"
                f"🌅 Sunrise: {sunrise}\n"
                f"🌇 Sunset: {sunset}\n"
        )

    except Exception as e:
        messagebox.showerror("Error", f"Something went wrong: {e}")

# ================= TIME UPDATE =================
def update_time():
    now = datetime.datetime.now()
    date_str = now.strftime("%A, %d %B %Y")
    time_str = now.strftime("%I:%M:%S %p")
    time_label.config(text=f"{date_str}\n{time_str}")
    root.after(1000, update_time)

# ================= CITY AUTOCOMPLETE =================
def fetch_city_suggestions(event):
    query = city_entry.get().strip()
    if len(query) < 2:
        suggestion_box['values'] = []
        return
    threading.Thread(target=get_city_list, args=(query,)).start()

def get_city_list(query):
    try:
        url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit=5&appid={API_KEY}"
        response = requests.get(url)
        data = response.json()
        city_names = [f"{c['name']}, {c['country']}" for c in data]
        suggestion_box['values'] = city_names
    except:
        suggestion_box['values'] = []

# ================= GUI =================
root = tk.Tk()
root.title("🌎 Smart Weather App v3.0")
root.state('zoomed')  # full screen mode
root.configure(bg="#000")

bg_animation = None

# Time Label
time_label = tk.Label(root, font=("Segoe UI", 18, "bold"), fg="white", bg="#000000")
time_label.place(relx=0.5, y=50, anchor="center")

# City Search
suggestion_box = ttk.Combobox(root, font=("Segoe UI", 16))
suggestion_box.set("Enter or select city")
def clear_placeholder(event):
    if suggestion_box.get() == "Enter or select city":
        suggestion_box.set("")

suggestion_box.bind("<FocusIn>", clear_placeholder)

suggestion_box.place(relx=0.5, y=150, anchor="center", width=400, height=40)
suggestion_box.bind("<KeyRelease>", fetch_city_suggestions)
city_entry = suggestion_box  # alias for compatibility

# Button
get_button = tk.Button(root, text="Get Weather 🌦", font=("Segoe UI", 14, "bold"), bg="#2196F3", fg="white",
                       relief="flat", command=get_weather)
get_button.place(relx=0.5, y=210, anchor="center", width=200, height=45)

# Result Label
result_label = tk.Label(root, text="", font=("Segoe UI", 14, "bold"),
                        fg="white", bg="#000000", justify="left", anchor="w",
                        bd=0, padx=20, pady=15)
result_label.place(relx=0.05, rely=0.75, relwidth=0.45, relheight=0.5)



# Start clock
update_time()

root.mainloop()
   