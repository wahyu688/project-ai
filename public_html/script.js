// public/script.js

// =================================================================================
// KONFIGURASI GLOBAL
// =================================================================================
// GANTI INI DENGAN API KEY ANDA jika ingin menampilkan lapisan peta suhu OWM (optional).
// Jika diisi 'YOUR_OWM_API_KEY', peta akan menampilkan marker fallback.
const OWM_API_KEY = 'YOUR_OWM_API_KEY'; 

// Data kota yang akan dimuat di halaman World Forecast
const GLOBAL_CITIES = [
    'Tokyo', 'London', 'New Delhi', 'Cairo', 'Rio de Janeiro', 'Sydney', 'Paris', 'Dubai'
];


// =================================================================================
// DOM ELEMENTS & HELPERS (Hanya Home Page)
// =================================================================================
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const homeWeatherResult = document.getElementById('weather-result');
const currentLocationBtn = document.getElementById('current-location-btn'); 


// --- HELPER FUNCTION: RENDER WEATHER CARD ---
/**
 * Merender kartu cuaca baru berdasarkan data yang diambil.
 * @param {object} data - Objek data cuaca dari backend API.
 * @param {HTMLElement} targetContainer - Container tempat kartu harus dirender.
 */
function renderWeatherCard(data, targetContainer) {
    const newWeatherCard = document.createElement('div');
    
    // Tentukan kelas dasar, tambahkan kelas gelap jika isNight=true
    let cardClasses = 'weather-card weather-card--dynamic';
    if (data.isNight) {
        cardClasses += ' weather-card--dark';
    }
    newWeatherCard.className = cardClasses;

    // Hapus pesan error/loading dari area tombol HANYA pada home page
    if (targetContainer.id === 'weather-result') {
        const locationCtaElement = document.querySelector('.search-box'); 
        const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
        if (existingMessage) existingMessage.remove();
    }

    // Struktur Kartu dengan Ikon Dinamis
    newWeatherCard.innerHTML = `
        <div class="city-name">${data.city}</div>
        
        <div class="temp-icon-wrapper">
            <span class="temp">${Math.round(data.temp)}°</span>
            <!-- Menggunakan class Font Awesome yang dikirim dari server -->
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

    // Tambahkan kartu baru di awal kontainer (Terbaru di Depan)
    targetContainer.prepend(newWeatherCard);

    // BATASI JUMLAH KARTU MAKSIMAL 6 HANYA UNTUK HOME PAGE
    if (targetContainer.id === 'weather-result') {
        const maxCards = 6;
        // Hapus kartu terakhir (yang paling lama) jika melebihi batas
        while (targetContainer.children.length > maxCards) {
            targetContainer.removeChild(targetContainer.lastChild);
        }
    }
    
    // Pengaturan tata letak grid CSS untuk World Forecast Page (terutama jika memuat pertama kali)
    if (targetContainer.id === 'world-weather-result') {
         targetContainer.style.display = 'grid';
         targetContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
         targetContainer.style.gap = '1.5rem';
    }
}


// =================================================================================
// CORE FUNCTION: FETCH WEATHER DATA
// =================================================================================
/**
 * Mengambil data cuaca dari API backend lokal.
 * @param {object} params - Parameter ({location: 'city'} atau {lat: X, lon: Y}).
 * @param {HTMLElement} targetContainer - Kontainer untuk merender hasil. Default: homeWeatherResult.
 */
async function fetchWeather(params, targetContainer = homeWeatherResult) {
    const queryParams = new URLSearchParams(params).toString();
    const locationCtaElement = document.querySelector('.search-box'); 
    let loadingCard = null;
    let isHomePage = targetContainer.id === 'weather-result';

    if (isHomePage) {
        // Hapus pesan error/sukses sebelumnya
        const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
        if (existingMessage) existingMessage.remove();
    }


    // Tampilkan loading state hanya jika ini pencarian tunggal di home page
    if (isHomePage && !params.lat && !params.lon) {
        loadingCard = document.createElement('div');
        loadingCard.className = 'weather-card loading-card';
        loadingCard.innerHTML = '<h2>Loading...</h2><i class="fas fa-spinner fa-spin fa-2x mt-4 text-blue-400"></i>';
        targetContainer.prepend(loadingCard);
    }
    
    // Hapus placeholder kartu cuaca default (hanya di home page, jika ada)
    if (isHomePage) {
         document.querySelectorAll('.weather-card--default').forEach(card => card.remove());
    }

    try {
        const response = await fetch(`http://localhost:3000/api/weather?${queryParams}`);
        const data = await response.json();

        // Hapus loading state
        if (loadingCard && document.contains(loadingCard)) {
            targetContainer.removeChild(loadingCard);
        }

        if (response.status !== 200) {
            const errorCard = document.createElement('div');
            errorCard.className = 'weather-card error-card';
            const errorCityName = params.location || (params.lat ? 'Current Location' : 'Unknown');
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
        
        // Tampilkan pesan error di bawah tombol pencarian (Hanya di home page)
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
// LOGIC KHUSUS PETA DUNIA (world_forecast.html)
// =================================================================================

/**
 * Menginisialisasi peta Leaflet untuk halaman World Forecast.
 */
function initWorldMap() {
    const mapElement = document.getElementById('temperature-map');
    
    // Pastikan Leaflet sudah dimuat
    if (!mapElement || typeof L === 'undefined') {
        console.warn('Leaflet library belum dimuat atau elemen peta tidak ditemukan.');
        return;
    }
    
    const warningText = document.querySelector('.weather-map-container p.mt-2');
    if (warningText) warningText.style.display = 'none';

    const map = L.map('temperature-map').setView([20, 0], 2);

    // 1. Tile Layer (Gaya Peta Dasar Modern) - CartoDB Positron
    const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18,
        minZoom: 2,
    }).addTo(map);
    
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });


    // 2. Lapisan Data Suhu (Membutuhkan OWM API Key)
    let tempOverlayLayer;
    let baseLayers = { "CARTO Light": baseLayer, "OSM Standard": osmLayer };
    let overlayLayers = {};
    
    if (OWM_API_KEY && OWM_API_KEY !== 'YOUR_OWM_API_KEY') {
        tempOverlayLayer = L.tileLayer('https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' + OWM_API_KEY, {
            maxZoom: 18,
            opacity: 0.7, 
            attribution: 'Suhu &copy; <a href="https://openweathermap.org">OWM</a>'
        }).addTo(map);
        overlayLayers["Suhu Global"] = tempOverlayLayer;
        
    } else {
        // Fallback: Tampilkan Marker untuk kota-kota utama jika API Key tidak ada
        console.warn("PERINGATAN: OpenWeatherMap API Key tidak ditemukan. Menampilkan marker fallback.");
        
        const fallbackMarkers = [
            [35.6895, 139.6917, "Tokyo"], [51.5074, -0.1278, "London"],
            [28.6139, 77.2090, "New Delhi"], [30.0444, 31.2357, "Cairo"],
            [-22.9068, -43.1729, "Rio de Janeiro"], [-33.8688, 151.2093, "Sydney"],
            [48.8566, 2.3522, "Paris"], [25.2048, 55.2708, "Dubai"],
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
let routeMap;
let routeControl;

/**
 * Inisialisasi peta dan event handler untuk halaman Travel Advisor.
 */
function initTravelMap() {
    const mapElement = document.getElementById('map-route');
    const routeForm = document.getElementById('route-form');
    const startInput = document.getElementById('start-location');
    const endInput = document.getElementById('end-location');
    const advisorOutput = document.getElementById('ai-advisor-output');
    const advisorContent = document.getElementById('advisor-content');
    const routeMessage = document.getElementById('route-message');

    // Pastikan Leaflet dan Leaflet Routing Machine sudah dimuat
    if (!mapElement || typeof L === 'undefined' || typeof L.Routing === 'undefined') {
        console.error('Leaflet atau Leaflet Routing Machine belum dimuat.');
        return;
    }
    
    // Inisialisasi Peta
    routeMap = L.map('map-route').setView([-6.2, 106.8], 10); // Default ke Jakarta
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(routeMap);

    // Event Handler Form
    routeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const start = startInput.value.trim();
        const end = endInput.value.trim();

        if (!start || !end) {
            routeMessage.textContent = "Mohon isi kedua lokasi awal dan tujuan.";
            return;
        }

        routeMessage.textContent = 'Menganalisis rute dan cuaca...';
        advisorOutput.style.display = 'none';

        try {
            // 1. Ambil data rute dan cuaca dari server
            const response = await fetch(`http://localhost:3000/api/route-weather?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
            const data = await response.json();
            
            if (response.status !== 200) {
                 routeMessage.textContent = `Error: ${data.error || 'Gagal mengambil data rute.'}`;
                 return;
            }
            
            // 2. Tampilkan Rute di Peta (Menggunakan Leaflet Routing Machine)
            if (routeControl) {
                routeMap.removeControl(routeControl);
            }
            
            routeControl = L.Routing.control({
                waypoints: [
                    L.latLng(data.start.lat, data.start.lon),
                    L.latLng(data.end.lat, data.end.lon)
                ],
                routeWhileDragging: true,
                language: 'en',
                show: false, // OPSI BARU: Menyembunyikan panel instruksi rute
                routeLine: function(route) {
                    // Kustomisasi garis rute jika diperlukan (contoh: garis lebih tebal)
                    return L.polyline(route.coordinates, { color: '#1e90ff', weight: 6 });
                },
                // Hapus widget instruksi rute dari peta
                summaryTemplate: '<h2>{name}</h2><h3>{distance}, {time}</h3>', 
                // Menggunakan container kosong untuk instruksi.
                // Namun, cara terbaik adalah menyembunyikannya melalui CSS atau menggunakan container kosong
            }).on('routesfound', function(e) {
                // Sembunyikan panel instruksi rute setelah rute ditemukan
                const routingContainer = routeControl.getContainer();
                if (routingContainer) {
                    const instructionsPanel = routingContainer.querySelector('.leaflet-routing-container');
                    if (instructionsPanel) {
                        instructionsPanel.style.display = 'none';
                    }
                }
                
                // Pindahkan ringkasan rute (jarak dan waktu) ke atas peta.
                // Leaflet Routing Machine secara default menempatkan summary di bagian atas.
                // Jika masih terlihat, kita sembunyikan semua elemen routing container kecuali peta itu sendiri.
                
            }).addTo(routeMap);

            // Set Peta untuk menampung seluruh rute
            routeMap.fitBounds(L.latLngBounds([
                [data.start.lat, data.start.lon],
                [data.end.lat, data.end.lon]
            ]).pad(0.5)); 

            // Tandai titik tengah (midpoint) tempat perkiraan cuaca dihitung
            L.marker([data.midpoint.lat, data.midpoint.lon])
                .addTo(routeMap)
                .bindPopup(`<b>Titik Tengah Perkiraan Cuaca</b><br>Kondisi: ${data.advice.majorCondition}`)
                .openPopup();
                
            // 3. Tampilkan Rekomendasi AI
            renderAIAdvice(data.advice);
            routeMessage.textContent = `Rute dari ${data.start.name} ke ${data.end.name} siap ditinjau.`;


        } catch (error) {
            console.error("Route analysis error:", error);
            routeMessage.textContent = 'Gagal memproses rute. Pastikan server.js berjalan dan lokasi valid.';
        }
    });
}

/**
 * Merender rekomendasi barang bawaan dari AI Advisor.
 * @param {object} advice - Objek yang berisi rekomendasi dari backend.
 */
function renderAIAdvice(advice) {
    const advisorOutput = document.getElementById('ai-advisor-output');
    const advisorContent = document.getElementById('advisor-content');
    
    let html = '';
    
    // Saran 1: Payung
    if (advice.needsUmbrella) {
        html += `<div class="item-recommendation alert"><i class="fas fa-exclamation-triangle"></i> Bawa Payung atau Jas Hujan (Ada Potensi Hujan)</div>`;
    } else {
        html += `<div class="item-recommendation"><i class="fas fa-umbrella-beach"></i> Cuaca Cenderung Cerah. Payung tidak wajib.</div>`;
    }
    
    // Saran 2: Jas Hujan/ Mantel Berat
    if (advice.needsRainCoat) {
        html += `<div class="item-recommendation alert"><i class="fas fa-cloud-showers-heavy"></i> Disarankan membawa Jas Hujan/Mantel Tebal (Curah hujan tinggi: ${advice.highestPrecipitation.toFixed(1)} mm).</div>`;
    } else if (advice.needsUmbrella) {
        html += `<div class="item-recommendation"><i class="fas fa-cloud-sun-rain"></i> Hujan Ringan diperkirakan, payung sudah cukup.</div>`;
    }

    // Saran 3: Kondisi Umum
    const conditionIcon = advice.needsUmbrella ? 'fas fa-cloud-rain' : 'fas fa-sun';
    const conditionText = `Prakiraan Utama: ${advice.majorCondition} di sepanjang rute.`;
    
    html += `<div class="item-recommendation"><i class="${conditionIcon}"></i> ${conditionText}</div>`;
    html += `<p class="mt-2 text-xs text-gray-500">Analisis didasarkan pada prakiraan 5 hari ke depan dari tanggal ${advice.startDate}.</p>`;

    advisorContent.innerHTML = html;
    advisorOutput.style.display = 'block';
}


// =================================================================================
// EVENT LISTENERS UTAMA (DOM Load)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Logika untuk Home Page ---
    // Pengecekan elemen untuk menghindari TypeError saat script dimuat di halaman lain
    if (searchForm) {
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
                        fetchWeather({ lat: lat, lon: lon }, homeWeatherResult); 
                        
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
    
    // --- Logika untuk World Forecast Page ---
    const worldContainer = document.getElementById('world-weather-result');
    if (worldContainer) {
        // 1. Muat Kartu Kota Global
        const loadingCard = worldContainer.querySelector('.loading-card');
        if(loadingCard) loadingCard.remove();
        
        GLOBAL_CITIES.forEach(city => {
            fetchWeather({ location: city }, worldContainer);
        });

        // 2. Inisialisasi Peta
        initWorldMap();
    }
    
    // --- Logika untuk Travel Map Page ---
    const mapRouteElement = document.getElementById('map-route');
    if (mapRouteElement) {
        // Panggil inisialisasi peta dan event handler rute
        initTravelMap();
    }
});
