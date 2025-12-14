// public/script.js

// =================================================================================
// KONFIGURASI GLOBAL
// =================================================================================
// GANTI INI DENGAN API KEY ANDA jika ingin menampilkan lapisan peta suhu OWM (optional).
const OWM_API_KEY = 'bd5e378503939ddaee76f12ad7a97608'; 
const GLOBAL_CITIES = [
    'Tokyo', 'London', 'New Delhi', 'Cairo', 'Rio de Janeiro', 'Sydney', 'Paris', 'Dubai'
];


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
 * DIPERBARUI: Menambahkan event klik untuk membuka detail.html
 */
function renderWeatherCard(data, targetContainer) {
    const newWeatherCard = document.createElement('div');
    
    // --- UPDATE: Style agar terlihat bisa diklik ---
    newWeatherCard.style.cursor = 'pointer';
    newWeatherCard.setAttribute('title', 'Klik untuk melihat detail lengkap');

    // --- UPDATE: Event Listener untuk Pindah Halaman ---
    newWeatherCard.onclick = function() {
        // Redirect ke detail.html dengan membawa parameter nama kota
        window.location.href = `detail.html?lokasi=${encodeURIComponent(data.city)}`;
    };

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
        
        <div style="margin-top: 15px; font-size: 0.8rem; opacity: 0.7; text-align: center;">
            <i class="fas fa-info-circle"></i> Klik untuk detail
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
 * URL sudah diperbaiki menjadi relatif ('/api/weather')
 */
async function fetchWeather(params, targetContainer = document.getElementById('weather-result')) {
    const queryParams = new URLSearchParams(params).toString();
    const locationCtaElement = document.querySelector('.search-box'); 
    let loadingCard = null;
    let isHomePage = targetContainer.id === 'weather-result';

    if (isHomePage) {
        const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
        if (existingMessage) existingMessage.remove();
    }

    if (isHomePage && !params.lat && !params.lon) {
        loadingCard = document.createElement('div');
        loadingCard.className = 'weather-card loading-card';
        loadingCard.innerHTML = '<h2>Memuat...</h2><i class="fas fa-spinner fa-spin fa-2x mt-4 text-blue-400"></i>';
        targetContainer.prepend(loadingCard);
    }
    
    if (isHomePage && document.querySelectorAll('.weather-card--default')) {
         document.querySelectorAll('.weather-card--default').forEach(card => card.remove());
    }

    try {
        // UPDATE URL: Menggunakan relative path
        const response = await fetch(`/api/weather?${queryParams}`);
        const data = await response.json();

        if (loadingCard && document.contains(loadingCard)) {
            targetContainer.removeChild(loadingCard);
        }

        if (response.status !== 200) {
            const errorCard = document.createElement('div');
            errorCard.className = 'weather-card error-card';
            const errorCityName = params.location || (params.lat ? 'Lokasi Saat Ini' : 'Tidak Dikenal');
            errorCard.innerHTML = `<h2>${errorCityName}</h2><p>Error ${response.status}: ${data.error || 'Gagal mengambil data cuaca.'}</p>`;
            targetContainer.prepend(errorCard);
            return;
        }

        renderWeatherCard(data, targetContainer);

    } catch (error) {
        console.error('Fetch error:', error);
        
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
        
        const errorCard = document.createElement('div');
        errorCard.className = 'weather-card error-card';
        errorCard.innerHTML = `<h2>Jaringan Gagal</h2><p>Server backend tidak merespon.</p>`;
        targetContainer.prepend(errorCard);
    }
}

/**
 * Merender daftar berita baru.
 */
function renderNews(newsData) {
    const newsContainer = document.querySelector('.news-list');
    if (!newsContainer) return;

    newsContainer.innerHTML = ''; 

    if (newsData.length === 0) {
        newsContainer.innerHTML = '<p class="news-meta">Tidak ada berita cuaca terbaru yang ditemukan.</p>';
        return;
    }

    const limitedNews = newsData.slice(0, 5); 

    limitedNews.forEach(item => {
        const date = new Date(item.date);
        const timeAgo = isNaN(date.getTime()) ? 'Beberapa waktu lalu' : timeSince(date); 
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

/**
 * Mengambil berita cuaca dari backend.
 * URL sudah diperbaiki menjadi relatif ('/api/weather-news')
 */
async function fetchWeatherNews() {
    const newsContainer = document.querySelector('.news-list');
    if (!newsContainer) return;
    
    newsContainer.innerHTML = `<article class="news-item"><i class="fas fa-spinner fa-spin"></i> Memuat berita terbaru...</article>`;

    try {
        // UPDATE URL: Relative path
        const response = await fetch(`/api/weather-news`);
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
// LOGIC KHUSUS HALAMAN DETAIL (detail.html) - BARU
// =================================================================================

async function fetchDetailWeather(locationName) {
    const container = document.getElementById('detail-content');
    const loading = document.getElementById('detail-loading');
    
    if (!container || !loading) return; 

    try {
        // GUNAKAN ENDPOINT BARU: /api/weather-detail
        const response = await fetch(`/api/weather-detail?location=${encodeURIComponent(locationName)}`);
        const data = await response.json();

        if (response.status !== 200) {
            loading.innerHTML = `<p style="color: red;">Error: ${data.error || 'Gagal mengambil data'}</p>`;
            return;
        }

        loading.style.display = 'none';
        container.style.display = 'block';

        // --- BUAT HTML UNTUK PRAKIRAAN 24 JAM ---
        let hourlyHtml = '';
        data.hourly.forEach(hour => {
            hourlyHtml += `
                <div style="
                    min-width: 80px; 
                    text-align: center; 
                    padding: 10px; 
                    background: #fff; 
                    border-radius: 10px; 
                    border: 1px solid #eee;
                    margin-right: 10px;
                ">
                    <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">${hour.time}</div>
                    <i class="${hour.icon}" style="font-size: 1.5rem; color: var(--color-primary); margin-bottom: 5px;"></i>
                    <div style="font-weight: bold; font-size: 1rem;">${hour.temp}°C</div>
                </div>
            `;
        });

        // --- RENDER TAMPILAN DETAIL LENGKAP ---
        container.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #333;">${data.city}</h1>
                    <p style="color: #666; font-size: 1.1rem;">
                        ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <div style="display: flex; justify-content: center; align-items: center; gap: 30px; margin-bottom: 2rem; flex-wrap: wrap;">
                    <i class="${data.current.icon}" style="font-size: 6rem; color: var(--color-primary);"></i>
                    <div>
                        <div style="font-size: 5rem; font-weight: 800; color: #333; line-height: 1;">${Math.round(data.current.temp)}°C</div>
                        <div style="font-size: 1.5rem; font-weight: 500; color: #555; margin-top: 10px;">${data.current.condition}</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 2rem; background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                    <div style="text-align: center;">
                        <i class="fas fa-tint" style="color: #1e90ff; margin-bottom: 5px;"></i>
                        <div style="font-size: 0.9rem; color: #888;">Kelembaban</div>
                        <div style="font-weight: bold;">${data.current.humidity}%</div>
                    </div>
                    <div style="text-align: center;">
                        <i class="fas fa-wind" style="color: #aaa; margin-bottom: 5px;"></i>
                        <div style="font-size: 0.9rem; color: #888;">Angin</div>
                        <div style="font-weight: bold;">${data.current.windSpeed} m/s</div>
                    </div>
                     <div style="text-align: center;">
                        <i class="fas fa-eye" style="color: #666; margin-bottom: 5px;"></i>
                        <div style="font-size: 0.9rem; color: #888;">Jarak Pandang</div>
                        <div style="font-weight: bold;">10 km</div>
                    </div>
                </div>

                <h3 style="margin-bottom: 1rem; color: #333; padding-left: 5px; border-left: 4px solid var(--color-primary);">Prakiraan 24 Jam ke Depan</h3>
                <div style="
                    display: flex; 
                    overflow-x: auto; 
                    padding-bottom: 15px; 
                    scrollbar-width: thin;
                ">
                    ${hourlyHtml}
                </div>
            </div>
        `;

    } catch (error) {
        console.error(error);
        loading.innerHTML = `<p style="color: red;">Gagal memuat data detail.</p>`;
    }
}


// =================================================================================
// LOGIC KHUSUS CLIMATE PAGE (climate.html)
// =================================================================================

function renderHistoricalChart(data) {
    const ctx = document.getElementById('historical-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    ctx.parentElement.innerHTML = '<canvas id="historical-chart" style="width: 100%; height: 100%;"></canvas>';
    const finalCtx = document.getElementById('historical-chart').getContext('2d');
    
    const labels = data.time.map(t => {
        const date = new Date(t);
        return date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
    }).filter((value, index, self) => self.indexOf(value) === index); 
    
    const monthlyMaxTemps = [];
    const monthlyDataMap = {}; 

    data.time.forEach((timeStr, index) => {
        const monthYear = new Date(timeStr).toLocaleString('id-ID', { month: 'short', year: 'numeric' });
        const temp = data.temperature_2m_max[index];
        
        if (!monthlyDataMap[monthYear]) {
            monthlyDataMap[monthYear] = [];
        }
        monthlyDataMap[monthYear].push(temp);
    });

    for (const monthYear of labels) {
        const sum = monthlyDataMap[monthYear].reduce((a, b) => a + b, 0);
        const avg = sum / monthlyDataMap[monthYear].length;
        monthlyMaxTemps.push(parseFloat(avg.toFixed(1)));
    }


    new Chart(finalCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Suhu Maks. Bulanan Rata-Rata (°C)',
                data: monthlyMaxTemps,
                borderColor: 'rgb(30, 144, 255)', 
                backgroundColor: 'rgba(30, 144, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 4,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Suhu (°C)' }
                },
                x: {
                    title: { display: true, text: 'Bulan' }
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                title: { display: true, text: 'Tren Suhu Maksimum Harian Tahunan (Jakarta)' }
            }
        }
    });
}

async function fetchHistoricalData() {
    const chartContainer = document.querySelector('.section--historical .placeholder-graphic');
    if (!chartContainer) return;
    
    const loadingMessage = '<i class="fas fa-spinner fa-spin fa-3x mb-3"></i><p>Memuat data iklim historis...</p>';
    chartContainer.innerHTML = loadingMessage;
    
    // Lokasi Jakarta, Data 2024
    const LAT = -6.2088; 
    const LON = 106.8456; 
    const START_DATE = '2024-01-01';
    const END_DATE = '2024-12-31';

    try {
        // API Eksternal tetap menggunakan URL lengkap
        const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${START_DATE}&end_date=${END_DATE}&daily=temperature_2m_max&timezone=auto`);
        
        const data = await response.json();

        if (response.status !== 200 || !data.daily) {
            chartContainer.innerHTML = '<i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Gagal memuat data historis. API Error.</p>';
            return;
        }
        
        renderHistoricalChart(data.daily);

    } catch (error) {
        console.error('Fetch historical data error:', error);
        chartContainer.innerHTML = '<i class="fas fa-exclamation-triangle fa-3x mb-3"></i><p>Kesalahan Jaringan. Gagal koneksi ke API Open-Meteo.</p>';
    }
}


// =================================================================================
// LOGIC KHUSUS PETA & RUTE (Home, World, Travel)
// =================================================================================

function initHomeMap() {
    const mapElement = document.getElementById('home-weather-map');
    if (!mapElement || typeof L === 'undefined') return;
    
    const map = L.map('home-weather-map').setView([0, 100], 3);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18, minZoom: 2,
    }).addTo(map);
    
    if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
        const precipitationLayer = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
            maxZoom: 18, opacity: 0.6,
            attribution: 'Curah Hujan &copy; <a href="https://openweathermap.org">OWM</a>'
        }).addTo(map);
        L.control.layers(null, { "Curah Hujan": precipitationLayer }, { collapsed: true }).addTo(map);
    } else {
        L.marker([0, 100]).addTo(map).bindPopup('<b>Peringatan</b><br>API Key OWM diperlukan.').openPopup();
    }
    
    setTimeout(() => { map.invalidateSize(); }, 100); 
}

function initWorldMap() {
    const mapElement = document.getElementById('temperature-map');
    if (!mapElement || typeof L === 'undefined') return;
    
    const map = L.map('temperature-map').setView([20, 0], 2);
    
    const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        maxZoom: 18, minZoom: 2,
    }).addTo(map);
    
    if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
        const tempOverlayLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
            maxZoom: 18, opacity: 0.7, 
            attribution: 'Suhu &copy; <a href="https://openweathermap.org">OWM</a>'
        }).addTo(map);
        L.control.layers({ "Base": baseLayer }, { "Suhu Global": tempOverlayLayer }, { collapsed: false }).addTo(map);
    }
    L.control.scale({ imperial: false }).addTo(map); 
}

function clearRainMarkers() {
    if (weatherOverlay && routeMap.hasLayer(weatherOverlay)) {
        routeMap.removeLayer(weatherOverlay);
        weatherOverlay = null;
    }
    rainMarkers.forEach(marker => {
        if (routeMap && routeMap.hasLayer(marker)) routeMap.removeLayer(marker);
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
    let html = '';
    html += '<div style="display: flex; gap: 10px; justify-content: start; border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1rem; overflow-x: auto;">';
    
    const limitedForecast = forecast.slice(0, 3); 

    limitedForecast.forEach(f => {
        const temp = Math.round(f.temp);
        let iconColor = '#888'; 
        if (f.rain > 0.1) iconColor = '#1e90ff';
        else if (temp >= 30) iconColor = '#dc2626'; 
        else if (temp >= 20) iconColor = '#facc15'; 
        
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

function renderAIAdvice(advice, rainPoints) {
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
            *Analisis didasarkan pada prakiraan 3 jam ke depan dari waktu saat ini.
        </p>
    `;
    
    html += '<h5 style="font-weight: 700; margin-top: 1.5rem; color: var(--color-text-dark); font-size: 1.1rem;">Prakiraan Cuaca 3 Jam ke Depan:</h5>';
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
        start: start, end: end, startTime: startTime 
    }).toString();

    try {
        // UPDATE URL: Relative path
        const response = await fetch(`/api/route-weather?${queryParams}`);
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
        
        if (routeControl) routeMap.removeControl(routeControl);

        routeControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false, show: false,
            lineOptions: { styles: [{ color: '#1e90ff', weight: 6, opacity: 0.7 }] },
            showAlternatives: false,
        }).addTo(routeMap);
        
        routeControl.on('routesfound', function(e) {
            const bbox = e.routes[0].coordinates.reduce((bounds, coord) => bounds.extend(coord), L.latLngBounds(waypoints[0], waypoints[1]));
            routeMap.fitBounds(bbox.pad(0.5)); 

            const routingContainer = routeControl.getContainer();
            if (routingContainer) {
                 const instructions = routingContainer.querySelector('.leaflet-routing-instructions');
                 if (instructions) instructions.style.display = 'none';
                 const summaryPanel = routingContainer.querySelector('.leaflet-routing-alt');
                 if (summaryPanel) summaryPanel.style.cssText = 'position: absolute; top: 10px; left: 10px; padding: 10px; background-color: white; border-radius: 8px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 90%;';
            }
            
            if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
                weatherOverlay = L.tileLayer('https://tile.openweathermap.org/map/precipitation/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
                    maxZoom: 18, opacity: 0.6,
                    attribution: 'Cuaca &copy; OWM'
                }).addTo(routeMap);
                routeMessage.textContent = `Rute dari ${data.start.name} ke ${data.end.name} siap ditinjau. (Lapisan curah hujan aktif)`;
            } else if (data.rainPoints && data.rainPoints.length > 0) {
                data.rainPoints.forEach(p => {
                    const colorProps = getWeatherColor(parseFloat(p.temp), parseInt(p.wmoCode));
                    const circle = L.circle([p.lat, p.lon], {
                        radius: 2000, color: colorProps.color, fillColor: colorProps.fill,
                        fillOpacity: colorProps.opacity, weight: 2
                    }).addTo(routeMap);
                    
                    circle.bindPopup(`<strong>Zona Cuaca Utama (Fallback)</strong><br>Waktu: ${new Date(p.time).getHours()}:00<br>Kondisi: ${p.condition} (${p.temp}°C)<br>${p.precipitation > 0.1 ? `Hujan: ${p.precipitation} mm` : 'Kering'}`);
                    rainMarkers.push(circle); 
                });
                routeMessage.textContent = `Rute dari ${data.start.name} ke ${data.end.name} siap ditinjau. (Visualisasi titik aktif)`;
            } else {
                 routeMessage.textContent = `Rute dari ${data.start.name} ke ${data.end.name} siap ditinjau.`;
            }
        });
        
        renderAIAdvice(data.advice, data.rainPoints);

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
        attribution: '&copy; OSM &copy; CARTO',
        subdomains: 'abcd', maxZoom: 19
    }).addTo(routeMap);
}


// =================================================================================
// EVENT LISTENERS UTAMA (DOM Load)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Logika Home Page: Pencarian ---
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        const searchInput = document.getElementById('search-input');
        const homeWeatherResult = document.getElementById('weather-result');

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

    // --- Logika Geolocation (Home Page) ---
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
                        const errorText = document.createElement('p');
                        errorText.className = 'weather-message text-red-500 mt-2 text-sm';
                        errorText.style.color = 'red'; 
                        errorText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}. Mohon izinkan akses lokasi.`;
                        if (locationCtaElement) locationCtaElement.appendChild(errorText);

                        currentLocationBtn.disabled = false;
                        currentLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Gunakan Lokasi Saat Ini';
                        setTimeout(() => { if (document.contains(errorText)) errorText.remove(); }, 5000);
                    }
                );
            } else {
                // ... error handling
            }
        });
    }

    // Inisialisasi peta sidebar di Home Page
    const homeMapElement = document.getElementById('home-weather-map');
    if (homeMapElement) initHomeMap();
    
    // --- Logika News Fetch (Home Page) ---
    if (document.querySelector('.news-list')) fetchWeatherNews();
    
    // --- Logika Climate Page ---
    const historicalChartElement = document.getElementById('historical-chart');
    if (historicalChartElement) fetchHistoricalData();

    // --- Logika World Forecast Page ---
    const worldContainer = document.getElementById('world-weather-result');
    if (worldContainer) {
        const loadingCard = worldContainer.querySelector('.loading-card');
        if(loadingCard) loadingCard.remove();
        GLOBAL_CITIES.forEach(city => fetchWeather({ location: city }, worldContainer));
        initWorldMap();
    }

    // --- Logika Travel Map Page ---
    const mapRouteElement = document.getElementById('map-route');
    if (mapRouteElement) {
        initTravelMap(); 
        const routeForm = document.getElementById('route-form');
        const startInput = document.getElementById('start-location');
        const endInput = document.getElementById('end-location');
        
        // --- LOGIKA BARU: TOMBOL CURRENT LOCATION ---
        const useLocationBtn = document.getElementById('use-location-route-btn');
        if (useLocationBtn) {
            useLocationBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    alert("Browser Anda tidak mendukung Geolocation.");
                    return;
                }

                // Ubah tampilan tombol saat loading
                const originalText = useLocationBtn.innerHTML;
                useLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mencari lokasi...';
                useLocationBtn.disabled = true;

                navigator.geolocation.getCurrentPosition(async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    try {
                        // Reverse Geocoding (Cari nama kota berdasarkan koordinat)
                        // Menggunakan Nominatim OSM (Gratis & Public)
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
                        const data = await response.json();
                        
                        // Ambil komponen alamat yang paling relevan (Kota/Kabupaten/Kecamatan)
                        const address = data.address;
                        const cityName = address.city || address.town || address.village || address.county || address.state_district || "Lokasi Saya";
                        
                        // Isi kolom input
                        startInput.value = cityName;
                        
                        // Kembalikan tombol ke semula
                        useLocationBtn.innerHTML = originalText;
                        useLocationBtn.disabled = false;
                        
                    } catch (error) {
                        console.error("Reverse geocoding error:", error);
                        alert("Gagal mendapatkan nama lokasi otomatis. Silakan ketik manual.");
                        useLocationBtn.innerHTML = originalText;
                        useLocationBtn.disabled = false;
                    }
                }, (error) => {
                    console.error("Geolocation error:", error);
                    alert("Gagal mengakses lokasi. Pastikan GPS aktif dan izin diberikan.");
                    useLocationBtn.innerHTML = originalText;
                    useLocationBtn.disabled = false;
                });
            });
        }
        // ---------------------------------------------

        routeForm.addEventListener('submit', (e) => {
            // ... (kode submit yang lama tetap sama) ...
            e.preventDefault();
            const start = startInput.value.trim();
            const end = endInput.value.trim();
            const startHour = new Date().getHours(); 

            if (start && end) {
                fetchRouteWeatherAndAdvice(start, end, startHour);
            } else {
                document.getElementById('route-message').textContent = 'Mohon masukkan Lokasi Awal dan Tujuan.';
            }
        });
    }
});