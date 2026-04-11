let trendChart = null;

document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);

    const cityInput = document.getElementById('city-input');
    const searchBtn = document.getElementById('search-btn');
    const locationBtn = document.getElementById('location-btn');
    
    // Load recent cities into custom dropdown
    fetch('/api/recent-cities')
        .then(res => res.json())
        .then(cities => {
            const dataList = document.getElementById('custom-suggestions');
            dataList.innerHTML = '';
            cities.forEach(city => {
                const li = document.createElement('li');
                li.innerText = city;
                li.addEventListener('click', () => {
                    cityInput.value = city;
                    dataList.classList.add('hidden');
                    fetchWeather(city);
                });
                dataList.appendChild(li);
            });
        });

    // Handle Search
    searchBtn.addEventListener('click', () => {
        const city = cityInput.value;
        if(city) fetchWeather(city);
    });

    cityInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            const city = cityInput.value;
            if(city) fetchWeather(city);
        }
    });

    // Handle City Suggestion input
    cityInput.addEventListener('input', (e) => {
        const query = e.target.value;
        const dataList = document.getElementById('custom-suggestions');
        if(query.length >= 2) {
            fetch(`/api/city-suggestions?q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(list => {
                    dataList.innerHTML = '';
                    if(list.length > 0) {
                        dataList.classList.remove('hidden');
                        list.forEach(city => {
                            const li = document.createElement('li');
                            li.innerText = city;
                            li.addEventListener('click', () => {
                                cityInput.value = city;
                                dataList.classList.add('hidden');
                                fetchWeather(city);
                            });
                            dataList.appendChild(li);
                        });
                    } else {
                        dataList.classList.add('hidden');
                    }
                });
        } else {
            dataList.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if(!e.target.closest('.search-frame')) {
            document.getElementById('custom-suggestions').classList.add('hidden');
        }
    });

    initChatbot();

    // Handle Location Button
    locationBtn.addEventListener('click', () => {
        fetch('/api/weather-by-ip')
            .then(res => res.json())
            .then(data => {
                if(data.city) {
                    cityInput.value = data.city;
                    fetchWeather(data.city);
                } else {
                    alert("Location not found.");
                }
            })
            .catch(err => alert("Error finding location"));
    });
});

function updateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    document.getElementById('time-display').innerText = `${dateStr}  //  ${timeStr}`;
}

function fetchWeather(city) {
    // Hide panels for animation
    const panels = document.querySelectorAll('.sliding-panel');
    panels.forEach(p => p.classList.replace('slide-up', 'slide-down'));

    document.getElementById('city-name').innerText = "SCANNING API...";

    setTimeout(() => {
        fetch(`/api/weather?city=${encodeURIComponent(city)}`)
            .then(res => {
                if(!res.ok) throw new Error("API Error");
                return res.json();
            })
            .then(data => {
                if(data.error) throw new Error(data.error);
                updateUI(data.current, data.forecast);
            })
            .catch(err => {
                alert("Error fetching weather: " + err.message);
                document.getElementById('city-name').innerText = "Awaiting Interface...";
                panels.forEach(p => p.classList.replace('slide-down', 'slide-up'));
            });
    }, 600); // Wait for slide down
}

function updateUI(current, forecast) {
    // Update labels
    document.getElementById('city-name').innerText = `${current.name.toUpperCase()}`;
    document.getElementById('temperature').innerText = `${current.main.temp.toFixed(1)}°C`;
    document.getElementById('description').innerText = `[${current.weather[0].main.toUpperCase()}] - ${current.weather[0].description.replace(/\b\w/g, l => l.toUpperCase())}`;

    // Format Times
    const formatTime = (ts) => {
        return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const details = `THERMAL SENS:    ${current.main.feels_like.toFixed(1)}°C
ATMOS HUMIDITY:  ${current.main.humidity}%
WIND VELOCITY:   ${current.wind.speed} m/s
BARO PRESSURE:   ${current.main.pressure} hPa
VISIBILITY:      ${(current.visibility / 1000).toFixed(1)} km

ASTRAL DAWN:     ${formatTime(current.sys.sunrise)}
ASTRAL DUSK:     ${formatTime(current.sys.sunset)}`;
    
    document.getElementById('details-text').innerText = details;

    updateBackground(current.weather[0].main, current.main.temp, current.sys.sunset, current.sys.sunrise);

    // Slide up
    const panels = document.querySelectorAll('.sliding-panel');
    panels.forEach(p => p.classList.replace('slide-down', 'slide-up'));

    // Draw Chart
    setTimeout(() => {
        drawChart(forecast);
    }, 600);
}

function updateBackground(weatherMain, temp, sunsetTs, sunriseTs) {
    const nowTs = Math.floor(Date.now() / 1000);
    const isNight = nowTs > sunsetTs || nowTs < sunriseTs;
    const cond = weatherMain.toLowerCase();
    
    let bgFile = '';

    if (cond.includes('rain') || cond.includes('drizzle')) {
        bgFile = isNight ? 'rainy.gif' : 'rainy1.gif';
    } else if (cond.includes('thunder')) {
        bgFile = 'thunder.gif';
    } else if (temp >= 30) {
        bgFile = isNight ? 'NIght (1).gif' : 'summer.gif';
    } else if (temp <= 5) {
        bgFile = isNight ? 'NIght (1).gif' : 'cloudy.gif';
    } else if (cond.includes('cloud')) {
        bgFile = 'cloudy.gif';
    } else if (cond.includes('clear')) {
        bgFile = isNight ? 'NIght (1).gif' : 'sunlight.gif';
    } else {
        bgFile = isNight ? 'NIght (1).gif' : 'sunlight.gif';
    }

    const sun = document.getElementById('sun');
    const moon = document.getElementById('moon');
    const sky = document.getElementById('sky-gradient');

    if (isNight) {
        sun.classList.add('hidden');
        if (cond.includes('clear') || cond.includes('cloud')) {
            moon.classList.remove('hidden');
        } else {
            moon.classList.add('hidden');
        }
        sky.style.background = 'linear-gradient(180deg, #020111 0%, #20124d 100%)';
    } else {
        moon.classList.add('hidden');
        if (cond.includes('clear') || cond.includes('cloud')) {
            sun.classList.remove('hidden');
        } else {
            sun.classList.add('hidden');
        }
        sky.style.background = 'linear-gradient(180deg, #1fa2ff 0%, #12d8fa 50%, #a6ffcb 100%)';
    }

    if (cond.includes('rain') || cond.includes('thunder') || cond.includes('snow')) {
        sky.style.background = 'linear-gradient(180deg, #373B44 0%, #4286f4 100%)';
    }

    const img = document.getElementById('bg-image');
    img.style.opacity = '0';
    setTimeout(() => {
        img.src = `/icons/${bgFile}`;
        // Adjust panel colors slightly based on temps (simulating python animate_panel_colors)
        updatePanelColors(temp);
        
        img.onload = () => {
            img.style.opacity = '1';
            // Also trigger particles!
            if(window.setParticleWeather) {
                window.setParticleWeather(weatherMain, isNight);
            }
        };
    }, 500);
}

function updatePanelColors(temp) {
    const panels = document.querySelectorAll('.glass');
    let bg = 'rgba(13, 13, 17, 0.65)';
    
    if (temp >= 30) bg = 'rgba(26, 5, 5, 0.75)';      // Very Hot
    else if (temp >= 20) bg = 'rgba(21, 10, 2, 0.75)'; // Warm
    else if (temp <= 5) bg = 'rgba(2, 10, 21, 0.75)';  // Very Cold
    else if (temp <= 15) bg = 'rgba(5, 16, 21, 0.75)'; // Cold

    panels.forEach(p => {
        p.style.backgroundColor = bg;
    });
}

function drawChart(forecast) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if(!forecast || !forecast.list) return;

    const labels = [];
    const data = [];

    // Take max 12 items (36 hours)
    const list = forecast.list.slice(0, 12);

    list.forEach(item => {
        const date = new Date(item.dt * 1000);
        labels.push(date.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}));
        data.push(item.main.temp);
    });

    if(trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: data,
                borderColor: '#00E5FF',
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#00E5FF',
                pointBorderColor: '#000',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                    },
                    ticks: {
                        color: '#aaaaaa'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#aaaaaa',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#00E5FF',
                    bodyColor: '#FFF',
                    borderColor: '#00E5FF',
                    borderWidth: 1
                }
            }
        }
    });
}

/* WEATHERBOT LOGIC */
function initChatbot() {
    const toggleBtn = document.getElementById('chat-toggle');
    const closeBtn = document.getElementById('chat-close');
    const windowDiv = document.getElementById('chat-window');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const messages = document.getElementById('chat-messages');

    if(!toggleBtn) return;

    let botWorking = false;

    toggleBtn.addEventListener('click', () => {
        windowDiv.classList.toggle('hidden');
        if(!windowDiv.classList.contains('hidden')) {
            if(messages.children.length === 0) {
                addBotMessage("Hello! I am WeatherBot. Ask me about the weather anywhere in the world! (e.g. 'What is the weather in Tokyo?')");
            }
        }
    });

    closeBtn.addEventListener('click', () => {
        windowDiv.classList.add('hidden');
    });

    function addBotMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-msg bot-msg';
        div.innerText = text;
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

    function handleSend() {
        if(botWorking) return;
        const text = input.value.trim();
        if(!text) return;
        
        addUserMessage(text);
        input.value = '';
        botWorking = true;

        setTimeout(() => {
            let cityMatch = text.match(/(?:weather in|weather for|show me weather for|show me weather in|temperature in|how is it in|how is the weather in|in)\s+([a-zA-Z\s,]+)/i);
            
            let cityToSearch = text;
            if(cityMatch && cityMatch[1]) {
                cityToSearch = cityMatch[1].trim();
            }
            cityToSearch = cityToSearch.replace(/[?!.]+$/, '');

            addBotMessage(`I am looking up the weather for ${cityToSearch}...`);
            
            fetch(`/api/weather?city=${encodeURIComponent(cityToSearch)}`)
            .then(res => res.json())
            .then(data => {
                if(data.error) {
                    addBotMessage(`Sorry, I couldn't find the weather for '${cityToSearch}'. Did you misspell it?`);
                } else {
                    addBotMessage(`It's currently ${data.current.main.temp.toFixed(1)}°C in ${data.current.name} with ${data.current.weather[0].description}.`);
                    document.getElementById('city-input').value = data.current.name;
                    fetchWeather(data.current.name);
                }
                botWorking = false;
            })
            .catch(e => {
                addBotMessage("An error occurred while contacting the satellite.");
                botWorking = false;
            });

        }, 800);
    }

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleSend();
    });
}
