const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animFrame;
let currentMode = 'clear'; // 'clear', 'rain', 'snow', 'cloudy'

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Particle {
    constructor(mode, isNight) {
        this.reset(mode, isNight, true);
    }

    reset(mode, isNight, randomY = false) {
        this.mode = mode;
        this.x = Math.random() * canvas.width;
        
        if (mode === 'rain') {
            this.y = randomY ? Math.random() * canvas.height : -20;
            this.vy = 10 + Math.random() * 15;
            this.vx = (Math.random() - 0.5) * 2;
            this.length = 15 + Math.random() * 20;
            this.alpha = 0.4 + Math.random() * 0.3;
        } else if (mode === 'snow') {
            this.y = randomY ? Math.random() * canvas.height : -10;
            this.vy = 1 + Math.random() * 3;
            this.vx = (Math.random() - 0.5) * 2;
            this.radius = 1 + Math.random() * 3;
            this.alpha = 0.5 + Math.random() * 0.5;
        } else {
            // clear / stars only visible if night
            this.y = Math.random() * canvas.height;
            this.vy = 0;
            this.vx = 0;
            this.radius = Math.random() * 1.5;
            this.alpha = isNight ? Math.random() : 0; // invisible if day clear
            this.twinkleSpeed = 0.02 + Math.random() * 0.03;
            this.twinkleDir = Math.random() > 0.5 ? 1 : -1;
        }
    }

    update(isNight) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.mode === 'rain') {
            if (this.y > canvas.height) this.reset(this.mode, isNight);
        } else if (this.mode === 'snow') {
            if (this.y > canvas.height) this.reset(this.mode, isNight);
        } else {
            if (isNight) {
                this.alpha += this.twinkleSpeed * this.twinkleDir;
                if (this.alpha > 1) {
                    this.alpha = 1;
                    this.twinkleDir = -1;
                } else if (this.alpha < 0.1) {
                    this.alpha = 0.1;
                    this.twinkleDir = 1;
                }
            } else {
                this.alpha = 0;
            }
        }
    }

    draw() {
        if(this.alpha <= 0) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.strokeStyle = `rgba(200, 240, 255, ${this.alpha})`;
        
        if (this.mode === 'rain') {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.vx, this.y + this.length);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (this.mode === 'snow' || this.mode === 'clear') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

let isNightMode = false;
let maxParticles = 150;

window.setParticleCount = function(count) {
    maxParticles = count;
    window.setParticleWeather(currentMode, isNightMode);
};

window.setParticleWeather = function(weatherMain, isNight) {
    isNightMode = isNight;
    const cond = weatherMain.toLowerCase();
    
    if (cond.includes('rain') || cond.includes('drizzle')) currentMode = 'rain';
    else if (cond.includes('snow')) currentMode = 'snow';
    else currentMode = 'clear';

    // Set particle count
    let count = maxParticles;
    if (currentMode === 'rain' && maxParticles > 0) count = Math.round(maxParticles * 1.6);
    else if (maxParticles === 0) count = 0;

    particles = [];
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(currentMode, isNightMode));
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.update(isNightMode);
        p.draw();
    });
    animFrame = requestAnimationFrame(animateParticles);
}

// Init
window.setParticleWeather('clear', true);
animateParticles();
