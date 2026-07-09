// ==========================================================================
// AETHERWEATHER CLIENT ARCHITECTURE
// Glassmorphism 2.0 SPA Logic
// ==========================================================================

let trendChart = null;
let radarMap = null;
let currentMapLayer = null;
let weatherData = null; // Stores current atmospheric cache (current + forecast)
let mapKey = '89dffb23048e7128d9108c10e76b34e8'; // OpenWeather API Key for Tile overlay layers

// Global User Preferences
let currentUnit = 'C'; // 'C' or 'F'
let currentWindUnit = 'ms'; // 'ms', 'kmh', 'mph'
let backgroundMode = 'dynamic'; // 'dynamic' or 'static'
let animSpeed = 'normal'; // 'fast', 'normal', 'eco'

document.addEventListener('DOMContentLoaded', () => {
    // 1. Splash Screen Loader Fadeout
    setTimeout(() => {
        const loader = document.getElementById('splash-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.classList.add('hidden');
                // Check if onboarding is needed (if no recent cities, show onboarding)
                checkOnboarding();
            }, 800);
        }
    }, 2500);

    // 2. Initialize Navigation and Clock
    updateTime();
    setInterval(updateTime, 1000);

    // 3. Search and Suggestion Inputs
    const cityInput = document.getElementById('city-input');
    const searchBtn = document.getElementById('search-btn');
    const locationBtn = document.getElementById('location-btn');
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const settingsPanel = document.getElementById('settings-panel');

    // Auto-load suggestions or recent list on focus
    cityInput.addEventListener('focus', () => {
        loadRecentCitiesDropdown();
    });

    searchBtn.addEventListener('click', () => {
        const city = cityInput.value.trim();
        if (city) scanAtmosphere(city);
    });

    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = cityInput.value.trim();
            if (city) scanAtmosphere(city);
            document.getElementById('custom-suggestions').classList.add('hidden');
        }
    });

    cityInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        const dropdown = document.getElementById('custom-suggestions');
        if (query.length >= 2) {
            fetch(`/api/city-suggestions?q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(list => {
                    dropdown.innerHTML = '';
                    if (list.length > 0) {
                        dropdown.classList.remove('hidden');
                        list.forEach(city => {
                            const li = document.createElement('li');
                            li.innerText = city;
                            li.addEventListener('click', () => {
                                cityInput.value = city;
                                dropdown.classList.add('hidden');
                                scanAtmosphere(city);
                            });
                            dropdown.appendChild(li);
                        });
                    } else {
                        dropdown.classList.add('hidden');
                    }
                })
                .catch(() => dropdown.classList.add('hidden'));
        } else {
            dropdown.classList.add('hidden');
        }
    });

    // Hide dropdown on clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-section')) {
            document.getElementById('custom-suggestions').classList.add('hidden');
        }
    });

    // Toggle Settings
    settingsToggleBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });
    settingsCloseBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });

    // Setup Location Autodetects
    locationBtn.addEventListener('click', autoLocateAtmosphere);
    document.getElementById('onboarding-locate-btn').addEventListener('click', () => {
        document.getElementById('onboarding-overlay').classList.add('hidden');
        autoLocateAtmosphere();
    });
    document.getElementById('onboarding-skip-btn').addEventListener('click', () => {
        document.getElementById('onboarding-overlay').classList.add('hidden');
        scanAtmosphere('London'); // Default fallback
    });

    // Setup Settings Buttons Toggles
    setupSettingsToggles();

    // Setup Interactive Map Buttons
    setupMapControls();

    // Setup Analytics Buttons
    setupAnalyticsControls();

    // Initialize AI Chat Assistant
    initChatbot();

    // Setup Error Retry
    document.getElementById('error-retry-btn').addEventListener('click', () => {
        document.getElementById('error-screen').classList.add('hidden');
        const city = cityInput.value.trim() || 'New York';
        scanAtmosphere(city);
    });
    document.getElementById('error-close-btn').addEventListener('click', () => {
        document.getElementById('error-screen').classList.add('hidden');
    });
});

// ==========================================================================
// PREFERENCES & SETTINGS LOGIC
// ==========================================================================

function setupSettingsToggles() {
    // Temperature unit C/F
    const btnC = document.getElementById('unit-c-btn');
    const btnF = document.getElementById('unit-f-btn');
    btnC.addEventListener('click', () => {
        if (currentUnit !== 'C') {
            currentUnit = 'C';
            btnC.classList.add('active');
            btnF.classList.remove('active');
            refreshDashboardData();
        }
    });
    btnF.addEventListener('click', () => {
        if (currentUnit !== 'F') {
            currentUnit = 'F';
            btnF.classList.add('active');
            btnC.classList.remove('active');
            refreshDashboardData();
        }
    });

    // Wind speed unit ms/kmh/mph
    const btnMs = document.getElementById('wind-ms-btn');
    const btnKmh = document.getElementById('wind-kmh-btn');
    const btnMph = document.getElementById('wind-mph-btn');
    const resetWindBtns = () => {
        btnMs.classList.remove('active');
        btnKmh.classList.remove('active');
        btnMph.classList.remove('active');
    };
    btnMs.addEventListener('click', () => {
        currentWindUnit = 'ms';
        resetWindBtns(); btnMs.classList.add('active');
        refreshDashboardData();
    });
    btnKmh.addEventListener('click', () => {
        currentWindUnit = 'kmh';
        resetWindBtns(); btnKmh.classList.add('active');
        refreshDashboardData();
    });
    btnMph.addEventListener('click', () => {
        currentWindUnit = 'mph';
        resetWindBtns(); btnMph.classList.add('active');
        refreshDashboardData();
    });

    // Background Gradient Mode
    const btnDynamic = document.getElementById('bg-dynamic-btn');
    const btnStatic = document.getElementById('bg-static-btn');
    btnDynamic.addEventListener('click', () => {
        backgroundMode = 'dynamic';
        btnDynamic.classList.add('active');
        btnStatic.classList.remove('active');
        document.body.className = 'theme-dynamic';
        if (weatherData) updateWeatherTheme(weatherData.current.weather[0].main, weatherData.current.main.temp);
    });
    btnStatic.addEventListener('click', () => {
        backgroundMode = 'static';
        btnStatic.classList.add('active');
        btnDynamic.classList.remove('active');
        document.body.className = ''; // Defaults back to night / clean
    });

    // Animation Speed settings
    const btnFast = document.getElementById('anim-fast-btn');
    const btnNormal = document.getElementById('anim-normal-btn');
    const btnEco = document.getElementById('anim-eco-btn');
    const resetAnimBtns = () => {
        btnFast.classList.remove('active');
        btnNormal.classList.remove('active');
        btnEco.classList.remove('active');
    };
    btnFast.addEventListener('click', () => {
        animSpeed = 'fast';
        resetAnimBtns(); btnFast.classList.add('active');
        if (window.setParticleCount) window.setParticleCount(350); // fast particle count
    });
    btnNormal.addEventListener('click', () => {
        animSpeed = 'normal';
        resetAnimBtns(); btnNormal.classList.add('active');
        if (window.setParticleCount) window.setParticleCount(150);
    });
    btnEco.addEventListener('click', () => {
        animSpeed = 'eco';
        resetAnimBtns(); btnEco.classList.add('active');
        if (window.setParticleCount) window.setParticleCount(0); // disable stars/rain
    });
}

function checkOnboarding() {
    fetch('/api/recent-cities')
        .then(res => res.json())
        .then(cities => {
            if (cities.length === 0) {
                document.getElementById('onboarding-overlay').classList.remove('hidden');
            } else {
                scanAtmosphere(cities[0]); // Load most recent searched
            }
        })
        .catch(() => {
            document.getElementById('onboarding-overlay').classList.remove('hidden');
        });
}

function loadRecentCitiesDropdown() {
    fetch('/api/recent-cities')
        .then(res => res.json())
        .then(cities => {
            const dropdown = document.getElementById('custom-suggestions');
            if (cities.length > 0 && document.activeElement === document.getElementById('city-input') && document.getElementById('city-input').value === '') {
                dropdown.innerHTML = '';
                dropdown.classList.remove('hidden');
                
                // Add a header
                const header = document.createElement('li');
                header.innerHTML = '<span style="font-size:0.75rem; color:#6C7284; font-weight:700; letter-spacing:1px">RECENT Atmospheric SCANS</span>';
                header.style.pointerEvents = 'none';
                dropdown.appendChild(header);

                cities.forEach(city => {
                    const li = document.createElement('li');
                    li.innerText = city;
                    li.addEventListener('click', () => {
                        document.getElementById('city-input').value = city;
                        dropdown.classList.add('hidden');
                        scanAtmosphere(city);
                    });
                    dropdown.appendChild(li);
                });
            }
        });
}

// ==========================================================================
// ATMOSPHERE SATELLITE DATA LOADING (SCANNING API)
// ==========================================================================

function scanAtmosphere(city) {
    // Show Skeletons / loader tags
    document.getElementById('city-name').innerText = "SCANNING ARRAY...";
    
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
        .then(res => {
            if (!res.ok) throw new Error("Atmos scan target coordinate fault");
            return res.json();
        })
        .then(data => {
            weatherData = data;
            refreshDashboardData();
            loadRecentScansList();
        })
        .catch(err => {
            console.error(err);
            document.getElementById('error-message-text').innerText = `Atmospheric scanner failed to parse coordinates for '${city}'. Satellite response code failed. Please verify spelling.`;
            document.getElementById('error-screen').classList.remove('hidden');
            document.getElementById('city-name').innerText = "Coordinate Fault";
        });
}

function autoLocateAtmosphere() {
    document.getElementById('city-name').innerText = "GPS SYNCING...";
    fetch('/api/weather-by-ip')
        .then(res => res.json())
        .then(data => {
            if (data.city) {
                document.getElementById('city-input').value = data.city;
                scanAtmosphere(data.city);
            } else {
                scanAtmosphere('Paris'); // defaults to romantic hub
            }
        })
        .catch(() => {
            scanAtmosphere('New York');
        });
}

function refreshDashboardData() {
    if (!weatherData) return;

    const current = weatherData.current;
    const forecast = weatherData.forecast;

    // A. Update Hero Weather Panel
    document.getElementById('city-name').innerText = `${current.name.toUpperCase()}, ${current.sys.country}`;
    
    // Count up temperature animation for Apple Weather feel
    animateTemperatureCount(current.main.temp);
    
    document.getElementById('description').innerText = `[${current.weather[0].main.toUpperCase()}] - ${current.weather[0].description.toUpperCase()}`;

    // Dynamic dynamic background
    updateWeatherTheme(current.weather[0].main, current.main.temp);

    // Dynamic weather sticker SVG
    const nowTs = Math.floor(Date.now() / 1000);
    const isNight = nowTs > current.sys.sunset || nowTs < current.sys.sunrise;
    setWeatherSticker(current.weather[0].main, isNight);

    // B. Detailed Metrics values
    document.getElementById('feels-like-val').innerText = `${convertTempDisplay(current.main.feels_like)}`;
    document.getElementById('humidity-val').innerText = `${current.main.humidity}%`;
    document.getElementById('wind-val').innerText = `${convertWindDisplay(current.wind.speed)}`;
    document.getElementById('wind-dir-val').innerText = `Direction Angle: ${current.wind.deg}°`;
    document.getElementById('pressure-val').innerText = `${current.main.pressure} hPa`;
    document.getElementById('visibility-val').innerText = `${(current.visibility / 1000).toFixed(1)} km`;
    
    // Custom metrics simulated UV, AQI, Moon Phase
    const uvIndex = simulateUVIndex(current.main.temp, current.clouds.all);
    document.getElementById('uv-val').innerText = uvIndex.val;
    document.getElementById('uv-desc').innerText = uvIndex.desc;

    const aqi = simulateAQI(current.wind.speed, current.main.pressure);
    document.getElementById('aqi-val').innerText = aqi.val;
    document.getElementById('aqi-desc').innerText = aqi.desc;

    const moon = calculateMoonPhase();
    document.getElementById('moonphase-val').innerText = moon.phase;
    document.getElementById('moon-illumination').innerText = moon.illumination;

    // Transits
    const formatTime = (ts) => {
        return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    document.getElementById('sunrise-time').innerText = formatTime(current.sys.sunrise);
    document.getElementById('sunset-time').innerText = formatTime(current.sys.sunset);

    // C. Rebuild Timeline & Expandable forecast lists
    buildHourlyTimeline(forecast);
    buildDailyForecast(forecast);

    // D. Lifestyle Comfort Index Scores
    calculateLifestylePredictions(current, forecast);

    // E. Initialize & Center Leaflet Weather Radar Map
    initWeatherRadarMap(current.coord.lat, current.coord.lon);

    // F. Rebuild Analytics chart
    const activeChartTab = document.querySelector('.chart-tab.active').id;
    updateAnalyticsChart(forecast, activeChartTab);
}

// ==========================================================================
// METRIC FORMATS & DYNAMIC PREDICTIONS LOGIC
// ==========================================================================

function convertTempDisplay(celsius) {
    if (currentUnit === 'C') {
        return `${celsius.toFixed(1)}°C`;
    } else {
        return `${(celsius * 9/5 + 32).toFixed(1)}°F`;
    }
}

function convertWindDisplay(ms) {
    if (currentWindUnit === 'ms') {
        return `${ms.toFixed(1)} m/s`;
    } else if (currentWindUnit === 'kmh') {
        return `${(ms * 3.6).toFixed(1)} km/h`;
    } else {
        return `${(ms * 2.237).toFixed(1)} mph`;
    }
}

function animateTemperatureCount(targetTemp) {
    const tempElement = document.getElementById('temperature');
    const displayVal = currentUnit === 'C' ? targetTemp : (targetTemp * 9/5 + 32);
    let startVal = displayVal - 8;
    const duration = 1200;
    const startTime = performance.now();

    function step(timestamp) {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out quadratic
        const easeProgress = progress * (2 - progress);
        const currentVal = startVal + (displayVal - startVal) * easeProgress;
        
        tempElement.innerText = currentVal.toFixed(0);
        
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

function simulateUVIndex(temp, clouds) {
    let index = Math.max(1, Math.min(11, Math.round((temp / 5) * (1 - (clouds / 150)))));
    let desc = "Low";
    if (index >= 8) desc = "Very High";
    else if (index >= 6) desc = "High";
    else if (index >= 3) desc = "Moderate";
    return { val: index, desc: desc };
}

function simulateAQI(windSpeed, pressure) {
    let base = Math.round((pressure - 980) / 2) + Math.round(50 / (windSpeed + 1));
    let val = Math.max(12, Math.min(300, base));
    let desc = "Good";
    if (val > 150) desc = "Unhealthy";
    else if (val > 100) desc = "Unhealthy for Sensitive Groups";
    else if (val > 50) desc = "Moderate";
    return { val: val, desc: desc };
}

function calculateMoonPhase() {
    // Basic approximate moon phase calculation
    const d = new Date();
    let year = d.getFullYear();
    let month = d.getMonth();
    let day = d.getDate();
    
    let c = 0, e = 0, jd = 0, b = 0;
    if (month < 3) { year--; month += 12; }
    month++;
    c = 365.25 * year;
    e = 30.6 * month;
    jd = c + e + day - 694039.09; // Julian date reference
    jd /= 29.5305882; // Synodic month ratio
    b = parseInt(jd);
    jd -= b;
    let phaseVal = Math.round(jd * 8) % 8;

    const phases = [
        "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
        "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"
    ];
    let illum = Math.round(Math.abs(Math.sin(jd * Math.PI)) * 100);

    return { phase: phases[phaseVal], illumination: `${illum}%` };
}

function updateWeatherTheme(weatherMain, temp) {
    if (backgroundMode !== 'dynamic') return;

    const body = document.body;
    body.className = 'theme-dynamic'; // Clear previous classes
    const cond = weatherMain.toLowerCase();

    if (cond.includes('thunderstorm')) body.classList.add('theme-stormy');
    else if (cond.includes('rain') || cond.includes('drizzle')) body.classList.add('theme-rainy');
    else if (cond.includes('snow')) body.classList.add('theme-snowy');
    else if (cond.includes('cloud')) body.classList.add('theme-cloudy');
    else if (cond.includes('clear') || temp >= 28) body.classList.add('theme-sunny');

    // Trigger canvas particle adjustments
    if (window.setParticleWeather && animSpeed !== 'eco') {
        window.setParticleWeather(weatherMain, isNightAtmosphere());
    }
}

function isNightAtmosphere() {
    if (!weatherData) return false;
    const current = weatherData.current;
    const nowTs = Math.floor(Date.now() / 1000);
    return nowTs > current.sys.sunset || nowTs < current.sys.sunrise;
}

// ==========================================================================
// APPLE WEATHER HOURLY & EXPANDABLE 7-DAY FORECASTS
// ==========================================================================

function buildHourlyTimeline(forecast) {
    const grid = document.getElementById('hourly-timeline-grid');
    grid.innerHTML = '';

    // Extract first 12 items (36 hours of weather)
    const items = forecast.list.slice(0, 12);
    
    items.forEach((item, idx) => {
        const time = new Date(item.dt * 1000);
        const hourStr = idx === 0 ? "Now" : time.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true, minute: '2-digit' }).replace(':00', '');
        const tempStr = convertTempDisplay(item.main.temp);
        const cond = item.weather[0].main;
        const pop = Math.round(item.pop * 100);
        
        const hourDiv = document.createElement('div');
        hourDiv.className = `hourly-item ${idx === 0 ? 'active' : ''}`;
        
        // Map icon to mini SVG sticker
        const timeOfDay = time.getHours();
        const isNight = timeOfDay > 18 || timeOfDay < 6;
        const stickerSVG = getMiniStickerSVG(cond, isNight);

        hourDiv.innerHTML = `
            <span class="hourly-time-lbl">${hourStr}</span>
            <div class="hourly-icon-container">${stickerSVG}</div>
            <span class="hourly-temp-lbl">${tempStr.replace('°C','').replace('°F','')}°</span>
            ${pop > 10 ? `<span class="hourly-pop-lbl">💧 ${pop}%</span>` : ''}
        `;
        grid.appendChild(hourDiv);
    });
}

function buildDailyForecast(forecast) {
    const container = document.getElementById('daily-forecast-container');
    container.innerHTML = '';

    // Group 3-hour forecasts by date
    const dayGroups = {};
    forecast.list.forEach(item => {
        const dateStr = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        if (!dayGroups[dateStr]) {
            dayGroups[dateStr] = [];
        }
        dayGroups[dateStr].push(item);
    });

    const weekdayKeys = Object.keys(dayGroups).slice(0, 5); // display 5 days

    weekdayKeys.forEach((dayKey, idx) => {
        const slots = dayGroups[dayKey];
        
        // Compute min/max temp and average stats
        let minTemp = 100, maxTemp = -100;
        let pops = [];
        let conds = {};

        slots.forEach(slot => {
            if (slot.main.temp_min < minTemp) minTemp = slot.main.temp_min;
            if (slot.main.temp_max > maxTemp) maxTemp = slot.main.temp_max;
            pops.push(slot.pop);
            conds[slot.weather[0].main] = (conds[slot.weather[0].main] || 0) + 1;
        });

        // Determine dominant weather condition
        let dominantCond = Object.keys(conds).reduce((a, b) => conds[a] > conds[b] ? a : b);
        let avgPop = Math.max(...pops); // Peak rain probability

        // Find slots for morning (09:00), afternoon (12:00), evening (18:00), night (21:00)
        let morningTemp = "--", afternoonTemp = "--", eveningTemp = "--", nightTemp = "--";
        slots.forEach(slot => {
            const hour = new Date(slot.dt * 1000).getHours();
            if (hour === 9) morningTemp = convertTempDisplay(slot.main.temp);
            else if (hour === 12 || hour === 15) afternoonTemp = convertTempDisplay(slot.main.temp);
            else if (hour === 18) eveningTemp = convertTempDisplay(slot.main.temp);
            else if (hour === 21 || hour === 0) nightTemp = convertTempDisplay(slot.main.temp);
        });

        // If specific hours not found, use fallback
        if (morningTemp === "--") morningTemp = convertTempDisplay(minTemp + 2);
        if (afternoonTemp === "--") afternoonTemp = convertTempDisplay(maxTemp);
        if (eveningTemp === "--") eveningTemp = convertTempDisplay(maxTemp - 3);
        if (nightTemp === "--") nightTemp = convertTempDisplay(minTemp);

        const stickerSVG = getMiniStickerSVG(dominantCond, false);
        const dayLabel = idx === 0 ? "Today" : dayKey.split(',')[0];
        
        // Generate clothing and comfort tips
        const clothingInfo = generateClothingAdvice(maxTemp, dominantCond);

        const wrapper = document.createElement('div');
        wrapper.className = 'daily-card-wrapper';
        wrapper.innerHTML = `
            <div class="daily-card-main">
                <span class="daily-day-name">${dayLabel}</span>
                <div class="daily-sticker">${stickerSVG}</div>
                <div class="daily-bar-container">
                    <span class="daily-temp-low">${minTemp.toFixed(0)}°</span>
                    <div class="daily-temp-bar">
                        <div class="daily-temp-bar-fill" style="left: 20%; width: 60%"></div>
                    </div>
                    <span class="daily-temp-high">${maxTemp.toFixed(0)}°</span>
                </div>
                <div class="daily-pop-info">
                    ${avgPop > 0.1 ? `<i data-lucide="droplet" style="width:14px;height:14px;color:#00E5FF"></i> ${Math.round(avgPop*100)}%` : '<span style="color:#6C7284">-</span>'}
                </div>
                <div class="daily-expand-arrow"><i data-lucide="chevron-down" style="width:20px;height:20px"></i></div>
            </div>
            
            <div class="daily-card-drawer">
                <div class="drawer-timelines">
                    <div class="timeline-segment">
                        <span class="segment-label">🌅 MORNING</span>
                        <span class="segment-temp">${morningTemp}</span>
                    </div>
                    <div class="timeline-segment">
                        <span class="segment-label">☀️ AFTERNOON</span>
                        <span class="segment-temp">${afternoonTemp}</span>
                    </div>
                    <div class="timeline-segment">
                        <span class="segment-label">🌇 EVENING</span>
                        <span class="segment-temp">${eveningTemp}</span>
                    </div>
                    <div class="timeline-segment">
                        <span class="segment-label">🌙 NIGHT</span>
                        <span class="segment-temp">${nightTemp}</span>
                    </div>
                </div>
                <div class="drawer-details-grid">
                    <div class="drawer-ai-card">
                        <div class="ai-pill"><i data-lucide="shirt" style="width:12px;height:12px"></i> AI CLOTHING RECOMMENDATION</div>
                        <p>${clothingInfo.clothing}</p>
                    </div>
                    <div class="drawer-metrics-card">
                        <div class="drawer-mini-metric">
                            <i data-lucide="wind" class="neon-teal"></i>
                            <div>
                                <span class="mini-metric-lbl">WIND SPEED</span>
                                <span class="mini-metric-val">${convertWindDisplay(slots[0].wind.speed)}</span>
                            </div>
                        </div>
                        <div class="drawer-mini-metric">
                            <i data-lucide="compass" class="neon-pink"></i>
                            <div>
                                <span class="mini-metric-lbl">PRESSURE</span>
                                <span class="mini-metric-val">${slots[0].main.pressure} hPa</span>
                            </div>
                        </div>
                        <div class="drawer-mini-metric">
                            <i data-lucide="droplets" class="neon-blue"></i>
                            <div>
                                <span class="mini-metric-lbl">HUMIDITY</span>
                                <span class="mini-metric-val">${slots[0].main.humidity}%</span>
                            </div>
                        </div>
                        <div class="drawer-mini-metric">
                            <i data-lucide="sparkles" class="neon-green"></i>
                            <div>
                                <span class="mini-metric-lbl">COMFORT</span>
                                <span class="mini-metric-val">${clothingInfo.score}/100</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Toggle card expansion
        wrapper.querySelector('.daily-card-main').addEventListener('click', () => {
            // Close any currently expanded daily card
            document.querySelectorAll('.daily-card-wrapper').forEach(card => {
                if (card !== wrapper) card.classList.remove('expanded');
            });
            wrapper.classList.toggle('expanded');
        });

        container.appendChild(wrapper);
    });
    
    // Re-create icons for appended elements
    lucide.createIcons();
}

function generateClothingAdvice(temp, cond) {
    let clothing = "";
    let score = 90;
    const rain = cond.toLowerCase().includes('rain') || cond.toLowerCase().includes('drizzle');
    const snow = cond.toLowerCase().includes('snow');

    if (temp >= 30) {
        clothing = "Highly advised to wear light clothing like T-shirts, shorts, and linen shirts. Apply high SPF sunscreen and carry sunglasses. Avoid heavy layering.";
        score = 75; // Heat comfort index drops
    } else if (temp >= 20) {
        clothing = "Perfect outdoor conditions. Light long-sleeve shirts, polo shirts, or chinos are ideal. No jackets required.";
        score = 98;
    } else if (temp >= 12) {
        clothing = "Mild temperatures. A light sweater, hoodie, or cardigans over a shirt is recommended. Keep a light jacket handy for windy areas.";
        score = 88;
    } else if (temp >= 5) {
        clothing = "Chilly weather. Layer up with a solid sweater, thick jacket, and scarf. Heavy trousers or thermal underwear are good fits.";
        score = 65;
    } else {
        clothing = "Extreme cold alert. Heavy insulation jacket (down coat), gloves, wool socks, winter hat, and thermals. Protect extremities.";
        score = 45;
    }

    if (rain) {
        clothing += " **Rainfall detected: Essential to carry an umbrella or wear a waterproof trench coat and water-resistant shoes.**";
        score -= 20;
    }
    if (snow) {
        clothing += " **Snowfall active: Insulated snow boots and thick water-repellent gloves are highly recommended.**";
        score -= 25;
    }

    return { clothing: clothing, score: Math.max(10, score) };
}

// ==========================================================================
// INTERACTIVE RADAR WEATHER MAP (LEAFLET.JS)
// ==========================================================================

function initWeatherRadarMap(lat, lon) {
    if (!radarMap) {
        // Initialize Map
        radarMap = L.map('map-radar', {
            zoomControl: true,
            attributionControl: false
        }).setView([lat, lon], 7);

        // Add Base Tile Layer (CartoDB Dark Matter for futuristic UI)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(radarMap);
        
        // Add default overlay layer (Temperature)
        currentMapLayer = L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${mapKey}`).addTo(radarMap);
    } else {
        // Center Map on new city coordinates
        radarMap.setView([lat, lon], 7);
    }

    // Clear previous custom marker if it exists, and place a new styled neon marker
    if (window.radarMapMarker) {
        radarMap.removeLayer(window.radarMapMarker);
    }
    
    // Create custom neon circle marker
    const neonIcon = L.divIcon({
        className: 'custom-map-marker',
        html: '<div class="radar-ping"><div class="ping-wave"></div><div class="ping-core"></div></div>',
        iconSize: [20, 20]
    });
    
    window.radarMapMarker = L.marker([lat, lon], { icon: neonIcon }).addTo(radarMap);
}

function setupMapControls() {
    const layers = {
        'temp': `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${mapKey}`,
        'clouds': `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${mapKey}`,
        'precipitation': `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${mapKey}`,
        'wind': `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${mapKey}`
    };

    const buttons = {
        'temp': document.getElementById('map-layer-temp'),
        'clouds': document.getElementById('map-layer-clouds'),
        'precipitation': document.getElementById('map-layer-precipitation'),
        'wind': document.getElementById('map-layer-wind')
    };

    Object.keys(buttons).forEach(key => {
        buttons[key].addEventListener('click', () => {
            // Manage Active Button States
            Object.values(buttons).forEach(btn => btn.classList.remove('active'));
            buttons[key].classList.add('active');

            // Switch Tile Overlay Layer
            if (radarMap && currentMapLayer) {
                radarMap.removeLayer(currentMapLayer);
                currentMapLayer = L.tileLayer(layers[key]).addTo(radarMap);
            }
        });
    });
}

// ==========================================================================
// DYNAMIC PREDICTION INDICES GENERATION
// ==========================================================================

function calculateLifestylePredictions(current, forecast) {
    const temp = current.main.temp;
    const wind = current.wind.speed;
    const humidity = current.main.humidity;
    const cloud = current.clouds.all;
    const rain = current.weather[0].main.toLowerCase().includes('rain') || current.weather[0].main.toLowerCase().includes('drizzle');

    // 1. Workout Score (dumbbell)
    let workout = 95;
    if (rain) workout -= 40;
    if (temp > 32 || temp < 3) workout -= 30;
    else if (temp > 27 || temp < 10) workout -= 15;
    document.getElementById('score-workout').innerText = `${Math.round(workout)}`;
    setScoreColorClass(document.getElementById('score-workout'), workout);

    // 2. Travel Score (plane)
    let travel = 100;
    if (rain) travel -= 25;
    if (wind > 12) travel -= 20;
    if (current.visibility < 3000) travel -= 30;
    document.getElementById('score-travel').innerText = `${Math.round(travel)}`;
    setScoreColorClass(document.getElementById('score-travel'), travel);

    // 3. Outdoors score (flower)
    let outdoors = 100 - Math.round(cloud * 0.4);
    if (rain) outdoors -= 50;
    if (temp > 35 || temp < 0) outdoors -= 40;
    document.getElementById('score-outdoors').innerText = `${Math.max(10, Math.round(outdoors))}`;
    setScoreColorClass(document.getElementById('score-outdoors'), outdoors);

    // 4. Farming Score (sprout)
    let farming = 50; // Neutral baseline
    if (rain) farming += 30; // Good for watering
    if (temp > 15 && temp < 28) farming += 20; // Perfect growth temp
    if (temp < 2 || temp > 38) farming -= 30; // Frost/Scorching hazard
    document.getElementById('score-farming').innerText = `${Math.max(10, Math.min(100, Math.round(farming)))}`;
    setScoreColorClass(document.getElementById('score-farming'), farming);

    // 5. Skin Care (smile)
    let skin = 100;
    const uvIndex = simulateUVIndex(temp, cloud).val;
    if (uvIndex > 6) skin -= 30; // High UV sunburn hazard
    if (humidity < 35) skin -= 20; // Dry air chapping hazard
    document.getElementById('score-skincare').innerText = `${Math.round(skin)}`;
    setScoreColorClass(document.getElementById('score-skincare'), skin);

    // 6. Hydration (cup)
    let hydration = 30; // Baseline intake difficulty
    if (temp > 28) hydration += 50; // Hot: requires extreme water
    else if (temp > 20) hydration += 25;
    document.getElementById('score-hydration').innerText = `${Math.round(hydration)}%`;

    // AI Weather Synopsis Generation (Dynamic client side fallback text)
    const city = current.name;
    const predictionText = generateClientPredictionSynopsis(city, temp, dominantForecastCondition(forecast), uvIndex, rain);
    document.getElementById('ai-prediction-text').innerText = predictionText;
}

function setScoreColorClass(element, score) {
    element.className = 'pill-score'; // Reset classes
    if (score >= 80) element.classList.add('neon-green');
    else if (score >= 50) element.classList.add('neon-yellow');
    else element.classList.add('neon-pink');
}

function dominantForecastCondition(forecast) {
    let conds = {};
    forecast.list.forEach(f => {
        let c = f.weather[0].main;
        conds[c] = (conds[c] || 0) + 1;
    });
    return Object.keys(conds).reduce((a, b) => conds[a] > conds[b] ? a : b, 'Clear');
}

function generateClientPredictionSynopsis(city, temp, dominantCond, uv, rain) {
    let summary = `Scanner metrics for **${city}** indicate a current atmospheric state of **${temp.toFixed(1)}°C** with **${dominantCond.toUpperCase()}** trends. `;
    if (rain) {
        summary += `Precipitation levels are high; workout suitability has dropped to active hazard levels indoors. Carry an umbrella for commuting. `;
    } else if (temp > 28) {
        summary += `Higher thermal stress detected. Skin care UV warning is in effect (Index ${uv}). Layer up sunscreen and keep hydrated. `;
    } else {
        summary += `Atmospheric conditions are stable. Outdoors comfort indexes are high; excellent time for traveling, jogging, and outdoor athletics. `;
    }
    summary += `Weekly comfort scores peak on Saturday afternoon.`;
    return summary;
}

// ==========================================================================
// ADVANCED TREND ANALYTICS PLOTS (CHART.JS AREA/BAR GRAPH)
// ==========================================================================

function setupAnalyticsControls() {
    const tabs = {
        'chart-tab-temp': 'temp',
        'chart-tab-humid': 'humid',
        'chart-tab-wind': 'wind',
        'chart-tab-pressure': 'pressure'
    };

    Object.keys(tabs).forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
            Object.keys(tabs).forEach(k => document.getElementById(k).classList.remove('active'));
            document.getElementById(id).classList.add('active');
            
            if (weatherData) {
                updateAnalyticsChart(weatherData.forecast, id);
            }
        });
    });
}

function updateAnalyticsChart(forecast, tabId) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (!forecast || !forecast.list) return;

    const labels = [];
    const dataPoints = [];
    let datasetLabel = '';
    let borderColor = '#00E5FF';
    let fillGradientStart = 'rgba(0, 229, 255, 0.2)';
    
    // Read first 16 slots (48 Hours Trend)
    const list = forecast.list.slice(0, 16);

    list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const timeStr = date.toLocaleTimeString('en-US', { weekday: 'short', hour: '2-digit', hour12: false });
        labels.push(timeStr);

        if (tabId === 'chart-tab-temp') {
            const rawTemp = item.main.temp;
            dataPoints.push(currentUnit === 'C' ? rawTemp : (rawTemp * 9/5 + 32));
            datasetLabel = `Temperature (${currentUnit === 'C' ? '°C' : '°F'})`;
            borderColor = '#FF9100'; // Warm orange
            fillGradientStart = 'rgba(255, 145, 0, 0.2)';
        } else if (tabId === 'chart-tab-humid') {
            dataPoints.push(item.main.humidity);
            datasetLabel = 'Humidity (%)';
            borderColor = '#2979FF'; // Ocean blue
            fillGradientStart = 'rgba(41, 121, 255, 0.2)';
        } else if (tabId === 'chart-tab-wind') {
            const rawWind = item.wind.speed;
            if (currentWindUnit === 'ms') dataPoints.push(rawWind);
            else if (currentWindUnit === 'kmh') dataPoints.push(rawWind * 3.6);
            else dataPoints.push(rawWind * 2.237);
            datasetLabel = `Wind speed (${currentWindUnit})`;
            borderColor = '#00E676'; // Neon green
            fillGradientStart = 'rgba(0, 230, 118, 0.2)';
        } else {
            dataPoints.push(item.main.pressure);
            datasetLabel = 'Barometer Pressure (hPa)';
            borderColor = '#FF4081'; // Pink
            fillGradientStart = 'rgba(255, 64, 129, 0.2)';
        }
    });

    if (trendChart) {
        trendChart.destroy();
    }

    // Chart.js Area styling
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, fillGradientStart);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: datasetLabel,
                data: dataPoints,
                borderColor: borderColor,
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: borderColor,
                pointBorderColor: '#0A0B12',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#8C92A6',
                        font: { family: 'Space Grotesk', size: 10 }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8C92A6',
                        maxRotation: 45,
                        minRotation: 45,
                        font: { family: 'Space Grotesk', size: 10 }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 11, 18, 0.95)',
                    titleColor: borderColor,
                    bodyColor: '#FFF',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', weight: 'bold' },
                    bodyFont: { family: 'Space Grotesk' },
                    padding: 10
                }
            }
        }
    });
}

// ==========================================================================
// RECENT Atmospheric SCANS LOGGER
// ==========================================================================

function loadRecentScansList() {
    fetch('/api/recent-cities')
        .then(res => res.json())
        .then(cities => {
            const list = document.getElementById('recent-scans-list');
            list.innerHTML = '';
            
            // Limit to 4 for visual simplicity
            cities.slice(0, 4).forEach(city => {
                const item = document.createElement('div');
                item.className = 'scan-item hover-lift';
                item.innerHTML = `
                    <span class="scan-city"><i data-lucide="compass" class="inline-icon" style="width:14px;height:14px"></i> ${city.split(',')[0]}</span>
                    <span class="scan-temp">SCAN →</span>
                `;
                item.addEventListener('click', () => {
                    document.getElementById('city-input').value = city;
                    scanAtmosphere(city);
                });
                list.appendChild(item);
            });
            lucide.createIcons();
        });
}

// ==========================================================================
// INTEGRATED GROQ AI WEATHER CHATBOT
// ==========================================================================

let chatHistory = [];

function formatMarkdown(text) {
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    let formatted = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    let paragraphs = formatted.split(/\n\n+/);
    return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

function initChatbot() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const messages = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('chat-typing-indicator');
    const clearBtn = document.getElementById('clear-chat-btn');

    let botWorking = false;

    if (messages.children.length === 0) {
        addBotMessage("Greetings, human. I am the AetherAI Assistant node. Ask me weather-oriented lifestyle questions, apparel recommendations, or general parameters. (e.g. 'Can I play cricket today in Delhi?')");
    }

    clearBtn.addEventListener('click', () => {
        messages.innerHTML = '';
        chatHistory = [];
        addBotMessage("Conversation logs cleared. AI cognitive buffers reset.");
    });

    function addBotMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-msg bot-msg';
        div.innerHTML = formatMarkdown(text);
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-msg user-msg';
        div.innerText = text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    function handleSend(textOverride) {
        if (botWorking) return;
        const text = textOverride ? textOverride.trim() : input.value.trim();
        if (!text) return;
        
        addUserMessage(text);
        if (!textOverride) input.value = '';
        botWorking = true;

        chatHistory.push({ role: "user", content: text });
        typingIndicator.classList.remove('hidden');
        messages.scrollTop = messages.scrollHeight;

        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory })
        })
        .then(res => res.json())
        .then(data => {
            typingIndicator.classList.add('hidden');
            botWorking = false;

            if (data.error) {
                addBotMessage("Cognitive sync loop failure: Groq assistant was unable to resolve this request.");
                console.error("AI Error:", data.details);
                return;
            }

            const responseMsg = data.message;
            addBotMessage(responseMsg.content);
            chatHistory.push(responseMsg);

            // Sync main dashboard UI if weather data was retrieved
            if (data.weather_update) {
                weatherData = data.weather_update;
                document.getElementById('city-input').value = `${weatherData.current.name}, ${weatherData.current.sys.country}`;
                refreshDashboardData();
            }
        })
        .catch(err => {
            typingIndicator.classList.add('hidden');
            botWorking = false;
            addBotMessage("Critical error: AI satellite link lost.");
            console.error("Fetch error:", err);
        });
    }

    sendBtn.addEventListener('click', () => handleSend());
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    // Wire up suggestion chips
    document.querySelectorAll('.suggest-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            handleSend(chip.innerText);
        });
    });
}

// ==========================================================================
// SVG STICKER LIBRARY & INLINE RENDERERS
// ==========================================================================

const sunSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <g class="sticker-sun-ray" stroke="#FF9800" stroke-width="3" stroke-linecap="round">
    <line x1="50" y1="12" x2="50" y2="20" />
    <line x1="50" y1="80" x2="50" y2="88" />
    <line x1="12" y1="50" x2="20" y2="50" />
    <line x1="80" y1="50" x2="88" y2="50" />
    <line x1="23.2" y1="23.2" x2="28.8" y2="28.8" />
    <line x1="71.2" y1="71.2" x2="76.8" y2="76.8" />
    <line x1="23.2" y1="76.8" x2="28.8" y2="71.2" />
    <line x1="71.2" y1="28.8" x2="76.8" y2="23.2" />
  </g>
  <circle cx="50" cy="50" r="20" class="sticker-sun" />
</svg>`;

const moonSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <g stroke="#ffffff" stroke-width="0.5" stroke-linecap="round">
    <path d="M20,25 L21,27 L23,28 L21,29 L20,31 L19,29 L17,28 L19,27 Z" class="sticker-star" />
    <path d="M75,20 L76,22 L78,23 L76,24 L75,26 L74,24 L72,23 L74,22 Z" class="sticker-star" />
    <path d="M65,70 L65.5,71.5 L67,72 L65.5,72.5 L65,74 L64.5,72.5 L63,72 L64.5,71.5 Z" class="sticker-star" />
  </g>
  <path d="M40 25 C56.5 25 70 38.5 70 55 C70 71.5 56.5 85 40 85 C48 85 57 77 57 55 C57 33 48 25 40 25 Z" class="sticker-moon" />
</svg>`;

const cloudSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M30 62 A12 12 0 0 1 38 40 A18 18 0 0 1 70 45 A15 15 0 0 1 72 62 Z" class="sticker-cloud-back" />
  <path d="M20 68 A15 15 0 0 1 30 43 A22 22 0 0 1 70 48 A18 18 0 0 1 70 68 Z" class="sticker-cloud-front" />
</svg>`;

const rainSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M25 55 A12 12 0 0 1 35 35 A18 18 0 0 1 68 40 A15 15 0 0 1 68 55 Z" class="sticker-cloud-front" />
  <line x1="33" y1="63" x2="28" y2="73" class="sticker-rain-drop" />
  <line x1="45" y1="65" x2="40" y2="75" class="sticker-rain-drop" />
  <line x1="57" y1="63" x2="52" y2="73" class="sticker-rain-drop" />
  <line x1="40" y1="71" x2="35" y2="81" class="sticker-rain-drop" />
</svg>`;

const stormSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M25 50 A12 12 0 0 1 35 30 A18 18 0 0 1 68 35 A15 15 0 0 1 68 50 Z" class="sticker-cloud-front" style="fill: #546E7A;" />
  <polygon points="46,47 38,63 46,63 42,80 54,60 46,60" class="sticker-lightning" />
  <line x1="30" y1="56" x2="25" y2="66" class="sticker-rain-drop" />
  <line x1="58" y1="56" x2="53" y2="66" class="sticker-rain-drop" />
</svg>`;

const snowSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M25 55 A12 12 0 0 1 35 35 A18 18 0 0 1 68 40 A15 15 0 0 1 68 55 Z" class="sticker-cloud-front" />
  <path d="M30,65 L36,71 M36,65 L30,71 M33,63 L33,73 M28,68 L38,68" stroke="#E0F7FA" stroke-width="1.5" stroke-linecap="round" class="sticker-snowflake" />
  <path d="M46,68 L52,74 M52,68 L46,74 M49,66 L49,76 M44,71 L54,71" stroke="#E0F7FA" stroke-width="1.5" stroke-linecap="round" class="sticker-snowflake" />
  <path d="M60,65 L66,71 M66,65 L60,71 M63,63 L63,73 M58,68 L68,68" stroke="#E0F7FA" stroke-width="1.5" stroke-linecap="round" class="sticker-snowflake" />
</svg>`;

const windSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <line x1="20" y1="35" x2="80" y2="35" class="sticker-wind-line" />
  <line x1="15" y1="50" x2="75" y2="50" class="sticker-wind-line" />
  <line x1="25" y1="65" x2="85" y2="65" class="sticker-wind-line" />
</svg>`;

const tornadoSVG = `
<svg viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M15 20 L85 20 M20 32 L80 32 M28 45 L72 45 M35 58 L65 58 M42 70 L58 70 M48 82 L52 82" class="sticker-tornado" />
</svg>`;

function setWeatherSticker(weatherMain, isNight) {
    const container = document.getElementById('weather-sticker-container');
    if (!container) return;
    container.innerHTML = getMiniStickerSVG(weatherMain, isNight);
}

function getMiniStickerSVG(weatherMain, isNight) {
    const cond = weatherMain.toLowerCase();
    if (cond.includes('thunderstorm')) return stormSVG;
    if (cond.includes('rain') || cond.includes('drizzle')) return rainSVG;
    if (cond.includes('snow')) return snowSVG;
    if (cond.includes('cloud')) return cloudSVG;
    if (cond.includes('clear')) return isNight ? moonSVG : sunSVG;
    if (cond.includes('tornado')) return tornadoSVG;
    return windSVG; // Mist/Fog/Haze/Wind
}

function updateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    document.getElementById('time-display').innerText = `${dateStr}  //  ${timeStr}`;
}
