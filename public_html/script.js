// public/script.js

// --- DOM ELEMENTS ---
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const weatherResult = document.getElementById('weather-result');
// Pastikan tombol ini ada di home.html
const currentLocationBtn = document.getElementById('current-location-btn'); 

// --- HELPER FUNCTION: RENDER WEATHER CARD ---
/**
 * Renders a new weather card based on the fetched data, using the unified card style.
 * @param {object} data - Weather data object from the backend API.
 */
function renderWeatherCard(data) {
    const newWeatherCard = document.createElement('div');
    
    // Tentukan kelas dasar, tambahkan kelas gelap jika isNight=true
    let cardClasses = 'weather-card weather-card--dynamic';
    if (data.isNight) {
        cardClasses += ' weather-card--dark';
    }
    newWeatherCard.className = cardClasses;

    // Hapus pesan error/loading dari area tombol
    const locationCtaElement = document.querySelector('.location-cta');
    const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
    if (existingMessage) existingMessage.remove();

    // STRUKTUR KARTU DISESUAIKAN MIRIP KARTU DEFAULT (Ikon di samping suhu):
    newWeatherCard.innerHTML = `
        <div class="city-name">${data.city}</div>
        
        <div class="temp-icon-wrapper">
            <span class="temp">${Math.round(data.temp)}°</span>
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
    weatherResult.prepend(newWeatherCard);

    // BATASI JUMLAH KARTU MAKSIMAL 6
    const maxCards = 6;
    while (weatherResult.children.length > maxCards) {
        // Hapus kartu terakhir (yang paling lama)
        weatherResult.removeChild(weatherResult.lastChild);
    }
}

// --- CORE FUNCTION: FETCH WEATHER DATA ---
/**
 * Fetches weather data from the local backend API.
 * @param {object} params - Parameters (either {location: 'city'} or {lat: X, lon: Y}).
 */
async function fetchWeather(params) {
    const queryParams = new URLSearchParams(params).toString();
    const locationCtaElement = document.querySelector('.location-cta');

    // Hapus pesan error/sukses sebelumnya
    const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
    if (existingMessage) existingMessage.remove();

    // Tampilkan loading state
    const loadingCard = document.createElement('div');
    loadingCard.className = 'weather-card loading-card';
    loadingCard.innerHTML = '<h2>Loading...</h2><i class="fas fa-spinner fa-spin fa-2x mt-4 text-blue-400"></i>';
    weatherResult.prepend(loadingCard);

    try {
        // Fetch data dari server lokal (diasumsikan berjalan di port 3000)
        const response = await fetch(`http://localhost:3000/api/weather?${queryParams}`);
        const data = await response.json();

        // Hapus loading state
        if (document.contains(loadingCard)) {
            weatherResult.removeChild(loadingCard);
        }

        if (response.status !== 200) {
            // Tampilkan error di area kartu
            const errorCard = document.createElement('div');
            errorCard.className = 'weather-card error-card';
            errorCard.innerHTML = `<h2>Error ${response.status}</h2><p>${data.error || 'Gagal mengambil data cuaca.'}</p>`;
            weatherResult.prepend(errorCard);
            return;
        }

        // Render hasil yang sukses
        renderWeatherCard(data);

    } catch (error) {
        console.error('Fetch error:', error);
        // Hapus loading state jika terjadi error jaringan
        if (document.contains(loadingCard)) {
            weatherResult.removeChild(loadingCard);
        }
        
        // Tampilkan pesan error di bawah tombol pencarian
        const errorText = document.createElement('p');
        errorText.className = 'weather-message text-red-500 mt-2 text-sm';
        errorText.style.color = 'red'; // CSS inline fallback
        errorText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Kesalahan Jaringan. Pastikan server.js berjalan.`;
        if (locationCtaElement) locationCtaElement.appendChild(errorText);

        const errorCard = document.createElement('div');
        errorCard.className = 'weather-card error-card';
        errorCard.innerHTML = `<h2>Jaringan Gagal</h2><p>Server backend tidak merespon.</p>`;
        weatherResult.prepend(errorCard);
    }
}


// --- EVENT LISTENER: SEARCH FORM ---
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const location = searchInput.value.trim();

    if (location) {
        fetchWeather({ location: location });
        searchInput.value = ''; // Hapus input setelah pencarian
    } else {
        // Umpan balik visual untuk input kosong
        searchInput.placeholder = 'Mohon masukkan lokasi!';
        setTimeout(() => searchInput.placeholder = 'Search location', 2000);
    }
});


// --- EVENT LISTENER: GEOLOCATION ---
currentLocationBtn.addEventListener('click', () => {
    const locationCtaElement = document.querySelector('.location-cta');
    
    // Hapus pesan error sebelumnya
    const existingMessage = locationCtaElement ? locationCtaElement.querySelector('.weather-message') : null;
    if (existingMessage) existingMessage.remove();

    if (navigator.geolocation) {
        // Geolocation tersedia
        currentLocationBtn.disabled = true;
        currentLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mendapatkan Lokasi...';
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success callback
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchWeather({ lat: lat, lon: lon });
                
                // Reset status tombol
                currentLocationBtn.disabled = false;
                currentLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Gunakan Lokasi Saat Ini';
            },
            (error) => {
                // Error callback
                console.error("Geolocation Error:", error);
                
                // Tampilkan pesan error kepada pengguna
                const errorText = document.createElement('p');
                errorText.className = 'weather-message text-red-500 mt-2 text-sm';
                errorText.style.color = 'red'; // CSS inline fallback
                errorText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}. Mohon izinkan akses lokasi.`;
                if (locationCtaElement) locationCtaElement.appendChild(errorText);

                // Reset status tombol
                currentLocationBtn.disabled = false;
                currentLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Gunakan Lokasi Saat Ini';
                
                // Hapus pesan error setelah jeda
                setTimeout(() => { if (document.contains(errorText)) errorText.remove(); }, 5000);
            }
        );
    } else {
        // Geolocation tidak didukung
        const errorText = document.createElement('p');
        errorText.className = 'weather-message text-red-500 mt-2 text-sm';
        errorText.style.color = 'red'; // CSS inline fallback
        errorText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Geolocation tidak didukung oleh browser Anda.`;
        if (locationCtaElement) locationCtaElement.appendChild(errorText);
        setTimeout(() => { if (document.contains(errorText)) errorText.remove(); }, 5000);
    }
});
