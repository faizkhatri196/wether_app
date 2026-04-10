import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
import requests
import datetime
from itertools import count
import threading
import json
import os
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib.dates as mdates

# ========== CONFIG ==========
API_KEY = "89dffb23048e7128d9108c10e76b34e8"
BASE_URL = "http://api.openweathermap.org/data/2.5"
RECENT_CITIES_FILE = "recent_cities.json"

# ========== HEX COLOR INTERPOLATION ==========
def hex_to_rgb(hexagon):
    hexagon = hexagon.lstrip('#')
    return tuple(int(hexagon[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return f"#{int(rgb[0]):02x}{int(rgb[1]):02x}{int(rgb[2]):02x}"

def interpolate_color(c1, c2, factor):
    rgb1 = hex_to_rgb(c1)
    rgb2 = hex_to_rgb(c2)
    new_rgb = (
        rgb1[0] + (rgb2[0] - rgb1[0]) * factor,
        rgb1[1] + (rgb2[1] - rgb1[1]) * factor,
        rgb1[2] + (rgb2[2] - rgb1[2]) * factor
    )
    return rgb_to_hex(new_rgb)

# ========== ANIMATED BUTTON ==========
class HoverButton(tk.Button):
    def __init__(self, master, bg_color, hover_color, **kwargs):
        super().__init__(master, bg=bg_color, **kwargs)
        self.bg_color = bg_color
        self.hover_color = hover_color
        self.current_factor = 0.0
        self.animating = False
        self.direction = 0
        
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def on_enter(self, e):
        self.direction = 1
        if not self.animating:
            self.animate()

    def on_leave(self, e):
        self.direction = -1
        if not self.animating:
            self.animate()
            
    def animate(self):
        self.animating = True
        self.current_factor += 0.1 * self.direction
        
        if self.current_factor >= 1.0:
            self.current_factor = 1.0
            self.config(bg=self.hover_color)
            self.animating = False
            return
        elif self.current_factor <= 0.0:
            self.current_factor = 0.0
            self.config(bg=self.bg_color)
            self.animating = False
            return
            
        new_color = interpolate_color(self.bg_color, self.hover_color, self.current_factor)
        self.config(bg=new_color)
        self.after(16, self.animate) # ~60fps

# ========== ANIMATED BACKGROUND ==========
class AnimatedGIF(tk.Label):
    def __init__(self, master, path, *args, **kwargs):
        tk.Label.__init__(self, master, *args, **kwargs)
        self.frames = []
        self.loc = 0
        self.delay = 100
        self.is_animated = True
        self.load(path)

    def load(self, path):
        try:
            im = Image.open(path)
            if getattr(im, "is_animated", False):
                for frame in count(1):
                    try:
                        self.frames.append(ImageTk.PhotoImage(im.copy()))
                        im.seek(frame)
                    except EOFError:
                        break
                self.after(self.delay, self.play)
            else:
                self.is_animated = False
                photo = ImageTk.PhotoImage(im)
                self.config(image=photo)
                self.image = photo
        except Exception as e:
            pass

    def play(self):
        if self.is_animated and self.frames:
            frame = self.frames[self.loc]
            self.loc = (self.loc + 1) % len(self.frames)
            self.config(image=frame)
            self.after(self.delay, self.play)

# ========== MAIN APP ==========
class SmartWeatherApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("🌎 Smart Weather App v5.0 - Ultra Advanced")
        self.state('zoomed')
        self.configure(bg="#020202")
        
        self.bg_animation = None
        self.recent_cities = self.load_recent_cities()
        
        self.setup_ui()
        self.update_time()
        
        self.style = ttk.Style(self)
        self.style.theme_use("clam")

    def load_recent_cities(self):
        if os.path.exists(RECENT_CITIES_FILE):
            with open(RECENT_CITIES_FILE, "r") as f:
                return json.load(f)
        return []

    def save_recent_city(self, city):
        if city not in self.recent_cities:
            self.recent_cities.insert(0, city)
            self.recent_cities = self.recent_cities[:10]
            with open(RECENT_CITIES_FILE, "w") as f:
                json.dump(self.recent_cities, f)
            self.suggestion_box['values'] = self.recent_cities

    def setup_ui(self):
        # Translucent Wrapper
        self.wrapper = tk.Frame(self, bg="#000000", bd=0)
        self.wrapper.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.85, relheight=0.88)

        # Top Bar
        self.top_frame = tk.Frame(self.wrapper, bg="#000000")
        self.top_frame.pack(fill=tk.X, pady=(15, 20))
        
        self.time_label = tk.Label(self.top_frame, font=("Segoe UI Light", 18), fg="#00E5FF", bg="#000000")
        self.time_label.pack(side=tk.LEFT, padx=20)
        
        search_frame = tk.Frame(self.top_frame, bg="#000000")
        search_frame.pack(side=tk.RIGHT, padx=20)
        
        self.suggestion_box = ttk.Combobox(search_frame, font=("Segoe UI", 13), width=28)
        self.suggestion_box.set("Enter or select city")
        self.suggestion_box['values'] = self.recent_cities
        self.suggestion_box.bind("<FocusIn>", self.clear_placeholder)
        self.suggestion_box.bind("<KeyRelease>", self.fetch_city_suggestions)
        self.suggestion_box.bind("<Return>", lambda e: self.get_weather())
        self.suggestion_box.pack(side=tk.LEFT, padx=10, ipady=4)
        
        get_button = HoverButton(search_frame, bg_color="#0A246A", hover_color="#00E5FF", text="SEARCH", font=("Segoe UI", 12, "bold"), fg="white", relief="flat", command=self.get_weather, cursor="hand2", padx=20)
        get_button.pack(side=tk.LEFT, padx=5, ipady=2)
        
        loc_button = HoverButton(search_frame, bg_color="#804000", hover_color="#FF9800", text="📍", font=("Segoe UI", 12, "bold"), fg="white", relief="flat", command=self.get_by_ip, cursor="hand2")
        loc_button.pack(side=tk.LEFT, padx=5, ipady=2)

        # MAIN LAYOUT (Using place for sliding animations)
        self.main_container = tk.Frame(self.wrapper, bg="#050505", bd=0)
        self.main_container.pack(expand=True, fill=tk.BOTH)

        # Left Panel (Fixed boundaries, animated inner content)
        self.left_clip = tk.Frame(self.main_container, bg="#0D0D11", bd=0)
        self.left_clip.place(relx=0.03, rely=0.02, relwidth=0.42, relheight=0.94)

        self.current_frame = tk.Frame(self.left_clip, bg="#0D0D11", bd=0)
        # Place it completely below view initially
        self.current_frame.place(relx=0, rely=1.0, relwidth=1.0, relheight=1.0)
        
        self.city_label = tk.Label(self.current_frame, text="Awaiting Interface...", font=("Segoe UI", 28, "bold"), fg="#FFFFFF", bg="#0D0D11", wraplength=450)
        self.city_label.pack(pady=(40, 5))
        
        self.temp_label = tk.Label(self.current_frame, text="--°", font=("Segoe UI Light", 75), fg="#00E5FF", bg="#0D0D11")
        self.temp_label.pack()
        
        self.desc_label = tk.Label(self.current_frame, text="Please initiate search scan", font=("Segoe UI Light", 16), fg="#A0A0A0", bg="#0D0D11")
        self.desc_label.pack(pady=5)
        
        self.details_frame = tk.Frame(self.current_frame, bg="#0D0D11")
        self.details_frame.pack(pady=30, padx=30, fill=tk.X)
        self.details_label = tk.Label(self.details_frame, text="", font=("Consolas", 14), fg="#EAEAEA", bg="#0D0D11", justify="left")
        self.details_label.pack(anchor="w")

        # Right Panel
        self.right_clip = tk.Frame(self.main_container, bg="#0D0D11", bd=0)
        self.right_clip.place(relx=0.48, rely=0.02, relwidth=0.49, relheight=0.94)

        self.chart_frame = tk.Frame(self.right_clip, bg="#0D0D11", bd=0)
        self.chart_frame.place(relx=0, rely=1.0, relwidth=1.0, relheight=1.0)
        
        chart_title = tk.Label(self.chart_frame, text="T R E N D   A N A L Y S I S", font=("Segoe UI", 12, "bold", "italic"), fg="#00E5FF", bg="#0D0D11", tracking=5) if hasattr(tk.Label, 'tracking') else tk.Label(self.chart_frame, text="T R E N D   A N A L Y S I S", font=("Segoe UI", 15, "bold"), fg="#00E5FF", bg="#0D0D11")
        chart_title.pack(pady=(20, 10))
        
        self.canvas_frame = tk.Frame(self.chart_frame, bg="#0D0D11")
        self.canvas_frame.pack(expand=True, fill=tk.BOTH, padx=20, pady=(0, 20))

    def slide_panels_down(self, callback=None):
        def _slide(curr_rely):
            curr_rely += 0.08
            if curr_rely >= 1.0:
                self.current_frame.place(rely=1.0)
                self.chart_frame.place(rely=1.0)
                if callback: callback()
            else:
                self.current_frame.place(rely=curr_rely)
                self.chart_frame.place(rely=curr_rely)
                self.after(16, _slide, curr_rely)
        _slide(float(self.current_frame.place_info()['rely']))

    def slide_panels_up(self):
        def _slide(curr_rely):
            curr_rely -= 0.05
            if curr_rely <= 0.0:
                self.current_frame.place(rely=0.0)
                self.chart_frame.place(rely=0.0)
            else:
                self.current_frame.place(rely=curr_rely)
                self.chart_frame.place(rely=curr_rely)
                self.after(16, _slide, curr_rely)
        _slide(1.0)

    def draw_chart_animated(self, forecast_data):
        for widget in self.canvas_frame.winfo_children():
            widget.destroy()

        if not forecast_data or "list" not in forecast_data:
            return

        dates, temps = [], []
        for item in forecast_data['list']:
            dates.append(datetime.datetime.fromtimestamp(item["dt"]))
            temps.append(item["main"]["temp"])

        plt.style.use("dark_background")
        fig, ax = plt.subplots(figsize=(7, 4), dpi=100)
        fig.patch.set_facecolor('#0D0D11')
        ax.set_facecolor('#0D0D11')
        
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        plt.xticks(rotation=45, ha='right', fontsize=8, color="#555555")
        plt.yticks(fontsize=9, color="#aaaaaa")
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_color('#222222')
        ax.spines['left'].set_color('#222222')
        ax.grid(color='#1a1a1a', linestyle='--', linewidth=0.5)
        plt.tight_layout()

        canvas = FigureCanvasTkAgg(fig, master=self.canvas_frame)
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Animate drawing line
        line, = ax.plot([], [], color="#00E5FF", marker="o", markersize=3, linestyle="-", linewidth=2)
        fill = None

        def animate_draw(i):
            nonlocal fill
            if i > len(dates):
                return
            line.set_data(dates[:i], temps[:i])
            if fill is not None:
                fill.remove()
            if i > 1:
                fill = ax.fill_between(dates[:i], temps[:i], min(temps)-5, color="#00E5FF", alpha=0.1)
            
            ax.relim()
            ax.autoscale_view()
            canvas.draw()
            self.after(20, animate_draw, i+2)

        self.after(100, animate_draw, 1)

    def clear_placeholder(self, event):
        if self.suggestion_box.get() == "Enter or select city":
            self.suggestion_box.set("")

    def fetch_city_suggestions(self, event):
        query = self.suggestion_box.get().strip()
        if len(query) < 2: return
        threading.Thread(target=self.get_city_list, args=(query,), daemon=True).start()

    def get_city_list(self, query):
        try:
            url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit=4&appid={API_KEY}"
            resp = requests.get(url).json()
            self.suggestion_box['values'] = [f"{c['name']}, {c['country']}" for c in resp]
        except: pass

    def get_by_ip(self):
        try:
            city = requests.get("https://ipinfo.io/json").json().get("city", "Unknown")
            if city != "Unknown":
                self.suggestion_box.set(city)
                self.get_weather()
        except: pass

    def get_weather(self):
        city = self.suggestion_box.get().strip()
        if not city or city == "Enter or select city": return

        # Trigger Pulse Animation -> Slide panels down -> Fetch Data -> Slide up
        self.city_label.config(text="SCANNING API...")
        self.city_label.place(relx=0.5, rely=0.5, anchor="center") # temp visual, won't be seen if slid down but good for loading state
        
        self.slide_panels_down(callback=lambda: threading.Thread(target=self._fetch_weather_data, args=(city,), daemon=True).start())

    def _fetch_weather_data(self, city):
        try:
            url = f"{BASE_URL}/weather?q={city}&appid={API_KEY}&units=metric"
            data = requests.get(url).json()
            if data.get("cod") != 200:
                self.after(0, lambda: messagebox.showerror("System Alert", f"Target not acquired: {city}"))
                self.after(0, self.slide_panels_up)
                return
            
            lat, lon = data["coord"]["lat"], data["coord"]["lon"]
            forecast_url = f"{BASE_URL}/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
            forecast_data = requests.get(forecast_url).json()

            self.after(0, lambda: self.apply_new_data(data, forecast_data))
        except Exception as e:
            self.after(0, lambda: messagebox.showerror("System Alert", "Satellite connection failed."))

    def apply_new_data(self, data, forecast_data):
        self.save_recent_city(f"{data['name']}, {data['sys'].get('country', '')}")
        self.update_background(data["weather"][0]["main"], data['main']['temp'], data['sys']['sunset'], data['sys']['sunrise'])
        
        self.city_label.config(text=f"{data['name'].upper()}")
        self.city_label.pack(pady=(40, 5)) # restore pack
        self.temp_label.config(text=f"{data['main']['temp']:.1f}°C")
        self.desc_label.config(text=f"[{data['weather'][0]['main'].upper()}] - {data['weather'][0]['description'].title()}")
        
        details = (
            f"THERMAL SENS:    {data['main']['feels_like']:.1f}°C\n"
            f"ATMOS HUMIDITY:  {data['main']['humidity']}%\n"
            f"WIND VELOCITY:   {data['wind']['speed']} m/s\n"
            f"BARO PRESSURE:   {data['main']['pressure']} hPa\n"
            f"VISIBILITY:      {data.get('visibility', 0) / 1000} km\n\n"
            f"ASTRAL DAWN:     {datetime.datetime.fromtimestamp(data['sys']['sunrise']).strftime('%I:%M %p')}\n"
            f"ASTRAL DUSK:     {datetime.datetime.fromtimestamp(data['sys']['sunset']).strftime('%I:%M %p')}"
        )
        self.details_label.config(text=details)

        # Slide panels up, then draw chart
        self.current_frame.place(rely=1.0)
        self.chart_frame.place(rely=1.0)
        
        self.slide_panels_up()
        self.after(600, lambda: self.draw_chart_animated(forecast_data))

    def update_background(self, weather_main, temp, sunset_ts, sunrise_ts):
        now_ts = datetime.datetime.now().timestamp()
        is_night = now_ts > sunset_ts or now_ts < sunrise_ts

        cond = weather_main.lower()
        if 'rain' in cond or 'drizzle' in cond: bg_file = 'rainy.gif' if is_night else 'rainy1.gif'
        elif 'thunder' in cond: bg_file = 'thunder.gif'
        elif temp >= 30: bg_file = 'summer.gif' if not is_night else 'NIght (1).gif'
        elif temp <= 5: bg_file = 'cloudy.gif' if not is_night else 'NIght (1).gif'
        elif 'cloud' in cond: bg_file = 'cloudy.gif'
        elif 'clear' in cond: bg_file = 'NIght (1).gif' if is_night else 'sunlight.gif'
        else: bg_file = 'NIght (1).gif' if is_night else 'sunlight.gif'

        self.animate_panel_colors(temp)

        img_path = os.path.join("icons", bg_file)
        if not os.path.exists(img_path): return
        
        if self.bg_animation: self.bg_animation.destroy()

        self.bg_animation = AnimatedGIF(self, img_path)
        self.bg_animation.place(x=0, y=0, relwidth=1, relheight=1)
        self.bg_animation.lower()
        self.wrapper.lift()

    def animate_panel_colors(self, temp):
        if temp >= 30: target = "#1A0505"
        elif temp >= 20: target = "#150A02"
        elif temp <= 5: target = "#020A15"
        elif temp <= 15: target = "#051015"
        else: target = "#0D0D11"
        
        current = self.current_frame.cget("bg")
        if current == target: return
        
        self.color_factor = 0.0
        def _anim_color():
            self.color_factor += 0.05
            if self.color_factor >= 1.0:
                new_color = target
            else:
                new_color = interpolate_color(current, target, self.color_factor)
                
            for w in [self.left_clip, self.current_frame, self.city_label, self.temp_label, self.desc_label, self.details_frame, self.details_label, self.right_clip, self.chart_frame]:
                try: w.config(bg=new_color)
                except: pass
            
            if self.color_factor < 1.0:
                self.after(16, _anim_color)
                
        _anim_color()

    def update_time(self):
        now = datetime.datetime.now()
        self.time_label.config(text=f"{now.strftime('%d %B %Y')}  //  {now.strftime('%H:%M:%S')}")
        self.after(1000, self.update_time)

if __name__ == "__main__":
    app = SmartWeatherApp()
    app.mainloop()