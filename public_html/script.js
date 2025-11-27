// public/script.js

// =================================================================================
// KONFIGURASI GLOBAL
// =================================================================================
// GANTI INI DENGAN API KEY ANDA jika ingin menampilkan lapisan peta suhu OWM (optional).
const OWM_API_KEY = 'bd5e378503939ddaee76f12ad7a97608'; 
const GLOBAL_CITIES = [
    'Tokyo', 'Jakarta', 'New Delhi', 'Cairo', 'Rio de Janeiro', 'Sydney', 'Paris', 'Dubai'
];
const SERVER_URL = 'http://localhost:3000'; // Base URL Backend


// =================================================================================
// GLOBAL STATES (Untuk Peta Rute)
// =================================================================================
let routeMap;
let routeControl;
let weatherOverlay = null; // Menyimpan objek lapisan cuaca OWM
let rainMarkers = []; // Menyimpan marker/lingkaran cuaca (digunakan untuk fallback)


// =================================================================================
// HELPER FUNCTIONS (Render & Fetch Umum)
// =================================================================================

/**
 * Merender kartu cuaca baru.
 */
function renderWeatherCard(data, targetContainer) {
    const newWeatherCard = document.createElement('div');
    let cardClasses = 'weather-card weather-card--dynamic';
    if (data.isNight) {
        cardClasses += ' weather-card--dark';
    }
    newWeatherCard.className = cardClasses;

    if (targetContainer.id === 'weather-result') {
        const locationCtaElement = document.querySelector('.search-box'); 
        const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
        if (existingMessage) existingMessage.remove();
    }

    newWeatherCard.innerHTML = `
        <div class="city-name">${data.city}</div>
        
        <div class="temp-icon-wrapper">
            <span class="temp">${Math.round(data.temp)}°</span>
            <span class="dynamic-icon"><i class="${data.icon}"></i></span> 
        </div>
        
        <div class="condition">${data.condition}</div>

        <div class="details-row">
            <span class="detail-item">
                <i class="fas fa-tint"></i> <span class="detail-label">${Math.round(data.humidity)}%</span>
            </span>
            <span class="detail-item">
                <i class="fas fa-wind"></i> <span class="detail-label">${data.windSpeed} m/s</span>
            </span>
        </div>
    `;

    targetContainer.prepend(newWeatherCard);

    if (targetContainer.id === 'weather-result') {
        const maxCards = 6;
        while (targetContainer.children.length > maxCards) {
            targetContainer.removeChild(targetContainer.lastChild);
        }
    }
}

/**
 * Mengambil data cuaca standar (Home & World Forecast).
 */
async function fetchWeather(params, targetContainer = document.getElementById('weather-result')) {
    const queryParams = new URLSearchParams(params).toString();
    const locationCtaElement = document.querySelector('.search-box'); 
    let loadingCard = null;
    let isHomePage = targetContainer.id === 'weather-result';

    if (isHomePage) {
        const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
        if (existingMessage) existingMessage.remove();
        document.querySelectorAll('.weather-card--default').forEach(card => card.remove());
    }

    if (isHomePage && !params.lat && !params.lon) {
        loadingCard = document.createElement('div');
        loadingCard.className = 'weather-card loading-card';
        loadingCard.innerHTML = '<h2>Memuat...</h2><i class="fas fa-spinner fa-spin fa-2x mt-4 text-blue-400"></i>';
        targetContainer.prepend(loadingCard);
    }
    
    try {
        // Menggunakan hardcoded localhost sesuai kode Anda sebelumnya
        const response = await fetch(`http://localhost:3000/api/weather?${queryParams}`);
        const data = await response.json();

        if (loadingCard && document.contains(loadingCard)) {
            targetContainer.removeChild(loadingCard);
        }

        if (response.status !== 200) {
            const errorCard = document.createElement('div');
            errorCard.className = 'weather-card error-card';
            const errorCityName = params.location || (params.lat ? 'Lokasi Saat Ini' : 'Tidak Dikenal');
            errorCard.innerHTML = `<h2>${errorCityName}</h2><p>Error: ${data.error || 'Gagal mengambil data cuaca.'}</p>`;
            targetContainer.prepend(errorCard);
            return;
        }

        renderWeatherCard(data, targetContainer);

    } catch (error) {
        console.error('Fetch error (Pastikan server.js berjalan):', error);
        
        if (loadingCard && document.contains(loadingCard)) {
            targetContainer.removeChild(loadingCard);
        }
        
        if (isHomePage && locationCtaElement) {
            const errorText = document.createElement('p');
            errorText.className = 'weather-message text-red-500 mt-2 text-sm';
            errorText.style.color = 'red'; 
            errorText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Kesalahan Jaringan. Pastikan server.js berjalan.`;
            locationCtaElement.appendChild(errorText);
        }
    }
}

/**
 * Merender daftar berita baru.
 */
function renderNews(newsData) {
    const newsContainer = document.querySelector('.news-list');
    if (!newsContainer) return;

    newsContainer.innerHTML = ''; 

    if (!newsData || newsData.length === 0) {
        newsContainer.innerHTML = '<p class="news-meta">Tidak ada berita cuaca terbaru yang ditemukan.</p>';
        return;
    }

    const limitedNews = newsData.slice(0, 5); 

    limitedNews.forEach(item => {
        const date = new Date(item.date);
        const timeAgo = isNaN(date.getTime()) ? 'Baru saja' : timeSince(date); 
        const sourceName = item.source || 'Cuacane';

        const article = document.createElement('article');
        article.className = 'news-item';
        article.innerHTML = `
            <a href="${item.link}" target="_blank" class="news-link">${item.title}</a>
            <p class="news-meta">${timeAgo} - ${sourceName}</p>
        `;
        newsContainer.appendChild(article);
    });
}

function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " tahun lalu";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " bulan lalu";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " hari lalu";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " jam lalu";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " menit lalu";
    return "Baru saja";
}

async function fetchWeatherNews() {
    const newsContainer = document.querySelector('.news-list');
    if (!newsContainer) return;
    
    newsContainer.innerHTML = `<article class="news-item"><i class="fas fa-spinner fa-spin"></i> Memuat berita terbaru...</article>`;

    try {
        const response = await fetch(`http://localhost:3000/api/weather-news`);
        const data = await response.json();

        if (response.status !== 200) {
            newsContainer.innerHTML = `<article class="news-item"><p class="news-meta" style="color: red;">Error: Gagal memuat berita.</p></article>`;
            return;
        }

        renderNews(data.news);

    } catch (error) {
        console.error('Fetch news error:', error);
        newsContainer.innerHTML = `<article class="news-item"><p class="news-meta" style="color: red;">Kesalahan Jaringan: Gagal koneksi ke server berita.</p></article>`;
    }
}


// =================================================================================
// LOGIC KHUSUS CLIMATE PAGE (PERBAIKAN UTAMA DI SINI)
// =================================================================================

function renderHistoricalChart(data) {
    const canvas = document.getElementById('historical-chart');
    if (!canvas) return;
    
    if (typeof Chart === 'undefined') {
        const msg = '<div style="text-align:center; padding:20px; color:red;">Error: Library Chart.js tidak ditemukan. Pastikan Anda sudah mengupdate file <b>climate.html</b>.</div>';
        if(canvas.parentElement) canvas.parentElement.innerHTML = msg;
        return;
    }

    const ctx = canvas.getContext('2d');
    
    const labels = data.time.map(t => new Date(t).toLocaleString('id-ID', { month: 'short', day: 'numeric' }));
    const temps = data.temperature_2m_max;

    if (window.myHistoricalChart) {
        window.myHistoricalChart.destroy();
    }

    window.myHistoricalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Suhu Maksimum Harian 2025 (°C)',
                data: temps,
                borderColor: 'rgb(30, 144, 255)', 
                backgroundColor: 'rgba(30, 144, 255, 0.1)',
                borderWidth: 1,
                pointRadius: 0,
                hitRadius: 10,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false, title: { display: true, text: 'Suhu (°C)' } },
                x: { ticks: { maxTicksLimit: 12 } }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}

async function fetchHistoricalData() {
    const chartContainer = document.querySelector('.section--historical .placeholder-graphic');
    if (!chartContainer) return;
    
    // Tampilkan Loading Spinner
    chartContainer.innerHTML = '<div style="text-align:center; padding-top: 50px;"><i class="fas fa-spinner fa-spin fa-3x mb-3"></i><p>Memuat data iklim historis...</p></div>';
    
    const LAT = -6.2088; 
    const LON = 106.8456; 
    const START_DATE = '2025-01-01';
    const END_DATE = '2025-11-10';

    try {
        const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${START_DATE}&end_date=${END_DATE}&daily=temperature_2m_max&timezone=auto`);
        const data = await response.json();

        if (response.status !== 200 || !data.daily) {
            chartContainer.innerHTML = '<p>Data historis tidak tersedia saat ini.</p>';
            return;
        }
        
        // --- FIX PENTING ---
        // Hapus spinner dan Buat Ulang Element Canvas
        // Ini wajib dilakukan karena innerHTML='...spinner...' di atas telah menghapus canvas asli
        chartContainer.innerHTML = ''; 
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'historical-chart';
        newCanvas.style.width = '100%';
        newCanvas.style.height = '100%';
        chartContainer.appendChild(newCanvas);

        // Render Chart
        renderHistoricalChart(data.daily);

    } catch (error) {
        console.error('Fetch historical data error:', error);
        chartContainer.innerHTML = '<div style="text-align:center; padding-top:50px; color:red;"><i class="fas fa-exclamation-triangle fa-2x mb-2"></i><p>Gagal mengambil data. Cek koneksi internet.</p></div>';
    }
}


// =================================================================================
// LOGIC PETA (HOME & WORLD)
// =================================================================================

function initHomeMap() {
    const mapElement = document.getElementById('home-weather-map');
    
    if (!mapElement || typeof L === 'undefined') {
        return;
    }
    
    const map = L.map('home-weather-map').setView([0, 100], 3);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18,
        minZoom: 2,
    }).addTo(map);
    
    if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
        const precipitationLayer = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
            maxZoom: 18,
            opacity: 0.6,
            attribution: 'Curah Hujan &copy; <a href="https://openweathermap.org">OWM</a>'
        }).addTo(map);
        
        L.control.layers(null, { "Curah Hujan": precipitationLayer }, { collapsed: true }).addTo(map);
        
    } else {
        L.marker([0, 100]).addTo(map)
             .bindPopup('<b>Peringatan</b><br>API Key OWM diperlukan untuk lapisan cuaca real-time.').openPopup();
    }
    
    setTimeout(() => { map.invalidateSize(); }, 200); 
}


// =================================================================================
// LOGIC KHUSUS PETA DUNIA (world_forecast.html)
// =================================================================================

function initWorldMap() {
    const mapElement = document.getElementById('temperature-map');
    if (!mapElement || typeof L === 'undefined') return;
    
    const map = L.map('temperature-map').setView([20, 0], 2);
    
    const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18,
        minZoom: 2,
    }).addTo(map);
    
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    let baseLayers = { "CARTO Light": baseLayer, "OSM Standard": osmLayer };
    let overlayLayers = {};
    const warningText = document.querySelector('.weather-map-container p.mt-2');
    
    if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
        const tempOverlayLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
            maxZoom: 18,
            opacity: 0.7, 
            attribution: 'Suhu &copy; <a href="https://openweathermap.org">OWM</a>'
        });
        overlayLayers["Suhu Global"] = tempOverlayLayer;
        
    } else {
        const fallbackMarkers = [
            [35.6895, 139.6917, "Tokyo"], [51.5074, -0.1278, "London"],
            [28.6139, 77.2090, "New Delhi"], [-6.2088, 106.8456, "Jakarta"]
        ];
        fallbackMarkers.forEach(coord => {
            L.marker([coord[0], coord[1]]).addTo(map)
             .bindPopup(`<b>${coord[2]}</b><br>API Key Diperlukan untuk Lapisan Suhu`);
        });
        
        if (warningText) {
             warningText.style.display = 'block';
             warningText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Data suhu tidak dapat dimuat. Mohon masukkan API Key OWM yang valid.';
        }
    }

    L.control.layers(baseLayers, overlayLayers, { collapsed: false }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map); 
}


// =================================================================================
// LOGIC KHUSUS PETA PERJALANAN (travel_map.html)
// =================================================================================

function clearRainMarkers() {
    if (weatherOverlay && routeMap.hasLayer(weatherOverlay)) {
        routeMap.removeLayer(weatherOverlay);
        weatherOverlay = null;
    }
    rainMarkers.forEach(marker => {
        if (routeMap && routeMap.hasLayer(marker)) {
            routeMap.removeLayer(marker);
        }
    });
    rainMarkers = [];
}

function getWeatherColor(temp, wmoCode) {
    const isRainy = (wmoCode >= 51 && wmoCode <= 82) || wmoCode >= 95;
    if (isRainy) return { color: '#1e90ff', fill: '#4d9eff', opacity: 0.7 }; 
    if (temp >= 30) return { color: '#dc2626', fill: '#f87171', opacity: 0.6 }; 
    if (temp >= 20) return { color: '#facc15', fill: '#fde047', opacity: 0.6 }; 
    return { color: '#6b7280', fill: '#d1d5db', opacity: 0.5 }; 
}

function renderHourlyForecast(forecast) {
    if (!forecast || forecast.length === 0) return '';
    
    let html = '';
    html += '<div style="display: flex; gap: 10px; justify-content: start; border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1rem; overflow-x: auto;">';
    
    const limitedForecast = forecast.slice(0, 3); 

    limitedForecast.forEach(f => {
        const temp = Math.round(f.temp);
        let iconColor = '#888'; 
        if (f.rain > 0.1) {
            iconColor = '#1e90ff';
        } else if (temp >= 30) {
            iconColor = '#dc2626'; 
        } else if (temp >= 20) {
            iconColor = '#facc15'; 
        }
        
        html += `
            <div class="weather-card" style="width: 110px; height: auto; padding: 10px; flex-shrink: 0; box-shadow: none; border: 1px solid #eee;">
                <p style="font-weight: 600; font-size: 0.9rem; margin: 0; color: var(--color-text-dark);">${f.hour.toString().padStart(2, '0')}:00</p>
                <i class="${f.icon}" style="font-size: 1.8rem; color: ${iconColor}; margin: 5px 0;"></i>
                <p style="font-size: 1.1rem; font-weight: 700; margin: 0;">${temp}°C</p>
                ${f.rain > 0.1 ? `<p style="font-size: 0.7rem; color: #1e90ff; font-weight: 600;">Hujan (${f.rain} mm)</p>` : '<p style="font-size: 0.7rem; color: #ccc;">Kering</p>'}
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function renderAIAdvice(advice) {
    const advisorOutput = document.getElementById('ai-advisor-output');
    const advisorContent = document.getElementById('advisor-content');
    
    let html = '';
    let recommendationIcon = 'fas fa-umbrella-beach';
    let recommendationText = 'Cuaca Cenderung Cerah. Payung tidak wajib.';
    let recommendationClass = '';

    if (advice.needsUmbrella) {
        recommendationClass = 'alert';
        recommendationIcon = advice.needsRainCoat ? 'fas fa-cloud-showers-heavy' : 'fas fa-umbrella';
        recommendationText = advice.needsRainCoat 
            ? `Wajib Bawa Jas Hujan: Hujan Lebat (${advice.highestPrecipitation} mm) diprediksi di beberapa titik rute.`
            : `Sangat Disarankan: Bawa Payung atau Jas Hujan ringan untuk potensi hujan.`;
    }

    html += `
        <div class="item-recommendation ${recommendationClass}" style="margin-bottom: 15px;">
            <i class="${recommendationIcon}" style="font-size: 1.5rem; color: ${advice.needsUmbrella ? '#dc2626' : '#28a745'};"></i>
            <span>${recommendationText}</span>
        </div>
        <p class="mt-2 text-sm text-gray-500">
            Analisis didasarkan pada prakiraan 3 jam ke depan dari waktu saat ini.
        </p>
    `;
    
    html += '<h5 style="font-weight: 700; margin-top: 1.5rem; color: var(--color-text-dark); font-size: 1.1rem;">Prakiraan Cuaca 3 Jam ke Depan (Titik Awal):</h5>';
    html += renderHourlyForecast(advice.forecast);

    advisorContent.innerHTML = html;
    advisorOutput.style.display = 'block';
}

async function fetchRouteWeatherAndAdvice(start, end, startTime) {
    const routeMessage = document.getElementById('route-message');
    const advisorOutput = document.getElementById('ai-advisor-output');

    routeMessage.textContent = 'Menganalisis rute dan cuaca...';
    advisorOutput.style.display = 'none';
    clearRainMarkers();
    
    const queryParams = new URLSearchParams({
        start: start,
        end: end,
        startTime: startTime 
    }).toString();

    try {
        const response = await fetch(`http://localhost:3000/api/route-weather?${queryParams}`);
        const data = await response.json();

        if (response.status !== 200) {
            routeMessage.textContent = `Error: ${data.error || 'Gagal mengambil data cuaca rute.'}`;
            if (routeControl) routeMap.removeControl(routeControl);
            routeControl = null;
            return;
        }

        const waypoints = [
            L.latLng(data.start.lat, data.start.lon),
            L.latLng(data.end.lat, data.end.lon)
        ];
        
        if (routeControl) {
            routeMap.removeControl(routeControl);
        }

        routeControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            show: false, 
            lineOptions: { styles: [{ color: '#1e90ff', weight: 6, opacity: 0.7 }] },
            showAlternatives: false,
        }).addTo(routeMap);
        
        routeControl.on('routesfound', function(e) {
            const bbox = e.routes[0].coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, L.latLngBounds(waypoints[0], waypoints[1]));
            routeMap.fitBounds(bbox.pad(0.5)); 

            const routingContainer = routeControl.getContainer();
            if (routingContainer) {
                 const instructions = routingContainer.querySelector('.leaflet-routing-instructions');
                 if (instructions) instructions.style.display = 'none';
                 const summaryPanel = routingContainer.querySelector('.leaflet-routing-alt');
                 if (summaryPanel) {
                     summaryPanel.style.cssText = 'position: absolute; top: 10px; left: 10px; padding: 10px; background-color: white; border-radius: 8px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 90%;';
                 }
            }
            
            if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
                weatherOverlay = L.tileLayer('https://tile.openweathermap.org/map/precipitation/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
                    maxZoom: 18, opacity: 0.6,
                    attribution: 'Cuaca &copy; <a href="https://openweathermap.org">OWM</a>'
                }).addTo(routeMap);

            } else if (data.rainPoints && data.rainPoints.length > 0) {
                data.rainPoints.forEach(p => {
                    const colorProps = getWeatherColor(parseFloat(p.temp), parseInt(p.wmoCode));
                    const circle = L.circle([p.lat, p.lon], {
                        radius: 2000, color: colorProps.color, 
                        fillColor: colorProps.fill, fillOpacity: colorProps.opacity, weight: 2
                    }).addTo(routeMap);
                    rainMarkers.push(circle); 
                });
                routeMessage.textContent = `Rute siap ditinjau. (Visualisasi titik aktif)`;
            } else {
                 routeMessage.textContent = `Rute siap ditinjau. (Cuaca cerah)`;
            }
        });
        
        renderAIAdvice(data.advice);

    } catch (error) {
        console.error('Route fetch error:', error);
        routeMessage.textContent = 'Terjadi kesalahan jaringan atau lokasi tidak ditemukan.';
    }
}


function initTravelMap() {
    const mapElement = document.getElementById('map-route');
    if (!mapElement || typeof L === 'undefined') return;

    if (routeMap) routeMap.remove(); 
    
    routeMap = L.map('map-route').setView([-6.2088, 106.8456], 10); 

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: 'OSM & CARTO'
    }).addTo(routeMap);
}


// =================================================================================
// EVENT LISTENERS UTAMA (DOM Load)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Logika Home Page ---
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        const searchInput = document.getElementById('search-input');
        const homeWeatherResult = document.getElementById('weather-result');

        // Init Map
        initHomeMap();
        // Init News
        fetchWeatherNews();

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const location = searchInput.value.trim();
            if (location) {
                fetchWeather({ location: location }, homeWeatherResult); 
                searchInput.value = ''; 
            } else {
                searchInput.placeholder = 'Mohon masukkan lokasi!';
                setTimeout(() => searchInput.placeholder = 'Search location', 2000);
            }
        });
    }

    const currentLocationBtn = document.getElementById('current-location-btn'); 
    if (currentLocationBtn) {
        currentLocationBtn.addEventListener('click', () => {
            const locationCtaElement = document.querySelector('.search-box'); 
            const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
            if (existingMessage) existingMessage.remove();

            if (navigator.geolocation) {
                currentLocationBtn.disabled = true;
                currentLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendapatkan Lokasi...';
                
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        fetchWeather({ lat: lat, lon: lon }, document.getElementById('weather-result')); 
                        
                        currentLocationBtn.disabled = false;
                        currentLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Gunakan Lokasi Saat Ini';
                    },
                    (error) => {
                        console.error("Geolocation Error:", error);
                        alert(`Error: ${error.message}. Mohon izinkan akses lokasi.`);
                        currentLocationBtn.disabled = false;
                        currentLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Gunakan Lokasi Saat Ini';
                    }
                );
            } else {
                alert('Geolocation tidak didukung oleh browser Anda.');
            }
        });
    }
    
    // --- Logika Climate Page ---
    if (document.getElementById('historical-chart')) {
        fetchHistoricalData();
    }

    // --- Logika World Forecast Page ---
    const worldContainer = document.getElementById('world-weather-result');
    if (worldContainer) {
        const loadingCard = worldContainer.querySelector('.loading-card');
        if(loadingCard) loadingCard.remove();
        
        GLOBAL_CITIES.forEach(city => {
            fetchWeather({ location: city }, worldContainer);
        });

        initWorldMap();
    }
    
    // --- Logika Travel Map Page ---
    const mapRouteElement = document.getElementById('map-route');
    if (mapRouteElement) {
        initTravelMap(); 

        const routeForm = document.getElementById('route-form');
        const startInput = document.getElementById('start-location');
        const endInput = document.getElementById('end-location');

        routeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const start = startInput.value.trim();
            const end = endInput.value.trim();
            const startHour = new Date().getHours(); 

            if (start && end) {
                fetchRouteWeatherAndAdvice(start, end, startHour);
            } else {
                document.getElementById('route-message').textContent = 'Mohon masukkan Lokasi Awal dan Tujuan yang valid.';
            }
        });
    }
});