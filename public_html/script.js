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
        const response = await fetch(`http://localhost:3000/api/weather?${queryParams}`);
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
        
        const errorCard = document.createElement('div');
        errorCard.className = 'weather-card error-card';
        errorCard.innerHTML = `<h2>Jaringan Gagal</h2><p>Server backend tidak merespon.</p>`;
        targetContainer.prepend(errorCard);
    }
}


// =================================================================================
// LOGIC KHUSUS PETA HOME PAGE (home.html)
// =================================================================================

function initHomeMap() {
    const mapElement = document.getElementById('home-weather-map');
    
    if (!mapElement || typeof L === 'undefined') {
        return;
    }
    
    // Inisialisasi peta di lokasi tengah yang relevan (misalnya, Asia Tenggara)
    const map = L.map('home-weather-map').setView([0, 100], 3);
    
    // Lapisan Peta Dasar (CARTO Light)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18,
        minZoom: 2,
    }).addTo(map);
    
    // Tambahkan Lapisan Curah Hujan OWM jika API Key valid
    if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
        const precipitationLayer = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
            maxZoom: 18,
            opacity: 0.6, // Transparansi untuk melihat peta dasar
            attribution: 'Curah Hujan &copy; <a href="https://openweathermap.org">OWM</a>'
        }).addTo(map);
        
        // Buat kontrol layer sederhana
        L.control.layers(null, { "Curah Hujan": precipitationLayer }, { collapsed: true }).addTo(map);
        
    } else {
        // Fallback untuk menunjukkan API Key hilang
        L.marker([0, 100]).addTo(map)
             .bindPopup('<b>Peringatan</b><br>API Key OWM diperlukan untuk lapisan cuaca real-time.').openPopup();
    }
    
    // PERBAIKAN: Memanggil invalidateSize untuk memastikan Leaflet menghitung ulang ukuran
    // Ini sering memperbaiki masalah peta yang tidak terlihat di sidebar/container non-standar.
    setTimeout(() => {
        map.invalidateSize();
    }, 100); 
}


// =================================================================================
// LOGIC KHUSUS PETA DUNIA (world_forecast.html)
// =================================================================================

function initWorldMap() {
    const mapElement = document.getElementById('temperature-map');
    
    if (!mapElement || typeof L === 'undefined') {
        return;
    }
    
    const map = L.map('temperature-map').setView([20, 0], 2);
    
    const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18,
        minZoom: 2,
    }).addTo(map);
    
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    let tempOverlayLayer;
    let baseLayers = { "CARTO Light": baseLayer, "OSM Standard": osmLayer };
    let overlayLayers = {};
    const warningText = document.querySelector('.weather-map-container p.mt-2');
    
    if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
        tempOverlayLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
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

/**
 * Menghapus semua marker cuaca lama dan lapisan overlay cuaca.
 */
function clearRainMarkers() {
    // 1. Hapus lapisan overlay cuaca OpenWeatherMap jika ada
    if (weatherOverlay && routeMap.hasLayer(weatherOverlay)) {
        routeMap.removeLayer(weatherOverlay);
        weatherOverlay = null;
    }
    // 2. Hapus fallback markers (jika digunakan)
    rainMarkers.forEach(marker => {
        if (routeMap && routeMap.hasLayer(marker)) {
            routeMap.removeLayer(marker);
        }
    });
    rainMarkers = [];
}

/**
 * Helper untuk menentukan warna peta berdasarkan kondisi dan suhu.
 * Ini sekarang hanya berfungsi sebagai fallback jika OWM_API_KEY tidak valid
 */
function getWeatherColor(temp, wmoCode) {
    // Kode WMO untuk hujan atau badai (51-82, 95-99)
    const isRainy = (wmoCode >= 51 && wmoCode <= 82) || wmoCode >= 95;

    if (isRainy) {
        // BIRU: Hujan
        return { color: '#1e90ff', fill: '#4d9eff', opacity: 0.7 }; 
    } 
    
    // Suhu Panas (di atas 30C)
    if (temp >= 30) {
        // MERAH: Panas
        return { color: '#dc2626', fill: '#f87171', opacity: 0.6 }; 
    } 
    
    // Suhu Normal/Sedang (20C - 30C)
    if (temp >= 20) {
        // KUNING: Sedang/Cerah
        return { color: '#facc15', fill: '#fde047', opacity: 0.6 }; 
    } 
    
    // Suhu Dingin (di bawah 20C) atau kondisi lain
    return { color: '#6b7280', fill: '#d1d5db', opacity: 0.5 }; // Abu-abu (Dingin/Netral)
}

/**
 * Merender prakiraan cuaca jam per jam (maks 3 jam) dengan visualisasi kartu mini.
 */
function renderHourlyForecast(forecast) {
    let html = '';
    html += '<div style="display: flex; gap: 10px; justify-content: start; border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1rem; overflow-x: auto;">';
    
    const limitedForecast = forecast.slice(0, 3); // Batasi 3 jam

    limitedForecast.forEach(f => {
        const temp = Math.round(f.temp);
        let iconColor = '#888'; 
        if (f.rain > 0.1) {
            iconColor = '#1e90ff';
        } else if (temp >= 30) {
            iconColor = '#dc2626'; // Merah
        } else if (temp >= 20) {
            iconColor = '#facc15'; // Kuning
        }
        
        // Memastikan visualisasi konsisten dengan Home Page
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

        // 1. Render Peta Rute
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
            show: false, // Sembunyikan panel instruksi
            lineOptions: {
                styles: [{ color: '#1e90ff', weight: 6, opacity: 0.7 }]
            },
            showAlternatives: false,
        }).addTo(routeMap);
        
        // 2. Visualisasi Warna Cuaca di Peta
        routeControl.on('routesfound', function(e) {
            const bbox = e.routes[0].coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, L.latLngBounds(waypoints[0], waypoints[1]));
            routeMap.fitBounds(bbox.pad(0.5)); // Zoom out sedikit

            // Sembunyikan instruksi rute yang tersisa
            const routingContainer = routeControl.getContainer();
            if (routingContainer) {
                 const instructions = routingContainer.querySelector('.leaflet-routing-instructions');
                 if (instructions) instructions.style.display = 'none';
                 
                 const summaryPanel = routingContainer.querySelector('.leaflet-routing-alt');
                 if (summaryPanel) {
                     // Atur posisi summary box
                     summaryPanel.style.cssText = 'position: absolute; top: 10px; left: 10px; padding: 10px; background-color: white; border-radius: 8px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 90%;';
                 }
            }
            
            // --- Logika Visualisasi Lapisan OWM ---
            if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
                // Gunakan Lapisan Peta Cuaca dari OWM (visualisasi non-kaku)
                // Kita akan menggunakan lapisan Curah Hujan ('precipitation') untuk menunjukkan area basah.
                weatherOverlay = L.tileLayer('https://tile.openweathermap.org/map/precipitation/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
                    maxZoom: 18,
                    opacity: 0.6,
                    attribution: 'Cuaca &copy; <a href="https://openweathermap.org">OWM</a>'
                }).addTo(routeMap);

                routeMessage.textContent = `Rute dari ${data.start.name} ke ${data.end.name} siap ditinjau. (Lapisan curah hujan aktif)`;
                
            } else if (data.rainPoints && data.rainPoints.length > 0) {
                 // --- FALLBACK VISUAL (Jika API Key OWM tidak valid) ---
                 // Jika API Key tidak ada, gunakan kembali L.circle untuk visualisasi titik
                data.rainPoints.forEach(p => {
                    const colorProps = getWeatherColor(parseFloat(p.temp), parseInt(p.wmoCode));
                    
                    const circle = L.circle([p.lat, p.lon], {
                        radius: 2000, // Radius 2000 meter (2 km)
                        color: colorProps.color, 
                        fillColor: colorProps.fill,
                        fillOpacity: colorProps.opacity,
                        weight: 2
                    }).addTo(routeMap);
                    
                    circle.bindPopup(`
                        <strong>Zona Cuaca Utama (Fallback)</strong><br>
                        Waktu: ${new Date(p.time).getHours().toString().padStart(2, '0')}:00<br>
                        Kondisi: ${p.condition} (${p.temp}°C)<br>
                        ${p.precipitation > 0.1 ? `Curah Hujan: ${p.precipitation} mm` : 'Kondisi Kering'}
                    `);
                    
                    rainMarkers.push(circle); // Simpan objek L.circle
                });
                routeMessage.textContent = `Rute dari ${data.start.name} ke ${data.end.name} siap ditinjau. (Visualisasi titik aktif - perlukan OWM Key)`;
            } else {
                 routeMessage.textContent = `Rute dari ${data.start.name} ke ${data.end.name} siap ditinjau. (Cuaca cerah)`;
            }
        });
        
        // 3. Render Rekomendasi AI
        renderAIAdvice(data.advice, data.rainPoints);

    } catch (error) {
        console.error('Route fetch error:', error);
        routeMessage.textContent = 'Terjadi kesalahan jaringan atau lokasi tidak ditemukan.';
    }
}


function initTravelMap() {
    const mapElement = document.getElementById('map-route');
    if (!mapElement || typeof L === 'undefined') return;

    if (routeMap) {
        routeMap.remove(); 
    }
    // Set view ke Jakarta (sebagai default Indonesia)
    routeMap = L.map('map-route').setView([-6.2088, 106.8456], 10); 

    // Tambahkan Tile Layer (CARTO Light untuk tampilan modern)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
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
                const errorText = document.createElement('p');
                errorText.className = 'weather-message text-red-500 mt-2 text-sm';
                errorText.style.color = 'red'; 
                errorText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Geolocation tidak didukung oleh browser Anda.`;
                if (locationCtaElement) locationCtaElement.appendChild(errorText);
                setTimeout(() => { if (document.contains(errorText)) errorText.remove(); }, 5000);
            }
        });
    }

    // Inisialisasi peta sidebar di Home Page
    const homeMapElement = document.getElementById('home-weather-map');
    if (homeMapElement) {
        initHomeMap();
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
        initTravelMap(); // Inisialisasi peta

        const routeForm = document.getElementById('route-form');
        const startInput = document.getElementById('start-location');
        const endInput = document.getElementById('end-location');

        routeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const start = startInput.value.trim();
            const end = endInput.value.trim();
            
            // 1. Ambil jam saat ini secara otomatis (HH)
            const startHour = new Date().getHours(); 

            if (start && end) {
                fetchRouteWeatherAndAdvice(start, end, startHour);
            } else {
                document.getElementById('route-message').textContent = 'Mohon masukkan Lokasi Awal dan Tujuan yang valid.';
            }
        });
    }
});