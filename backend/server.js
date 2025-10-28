// server.js
const express = require('express');
const axios = require('axios');
const path = require('path'); 
const app = express();
const port = 3000;

// Use CORS middleware (penting untuk frontend/backend communication)
const cors = require('cors');
app.use(cors());

// PERHATIAN: __dirname adalah folder tempat server.js berada (yaitu 'backend')
// Kita perlu keluar satu tingkat (..) untuk mencapai 'public_html'
const publicPath = path.join(__dirname, '..', 'public_html');

// 1. Melayani File Statis (CSS, JS, Gambar, HTML lainnya)
app.use(express.static(publicPath));

// 2. Route Root untuk melayani home.html
app.get('/', (req, res) => {
    // Mengatasi error "Cannot GET /" dengan mengirimkan home.html
    res.sendFile(path.join(publicPath, 'home.html')); 
});


// --- KONSTANTA API ---
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// Helper function to map WMO code to Font Awesome icon and text
function mapWeatherCode(wmoCode, isDay) {
    let iconClass = 'fas fa-question';
    let conditionText = 'Variable'; // Default to variable

    // Open-Meteo Weather Codes (WMO)
    switch (wmoCode) {
        case 0: // Clear sky
            iconClass = isDay ? 'fas fa-sun' : 'fas fa-moon';
            conditionText = 'Clear Sky';
            break;
        case 1: // Mainly clear
        case 2: // Partly cloudy
            iconClass = isDay ? 'fas fa-cloud-sun' : 'fas fa-cloud-moon';
            conditionText = 'Partly Cloudy';
            break;
        case 3: // Overcast
            iconClass = 'fas fa-cloud';
            conditionText = 'Overcast';
            break;
        case 45: // Fog
        case 48: // Depositing rime fog
            iconClass = 'fas fa-smog';
            conditionText = 'Fog';
            break;
        case 51: // Drizzle: Light
        case 53: // Drizzle: Moderate
        case 55: // Drizzle: Dense
            iconClass = 'fas fa-cloud-rain';
            conditionText = 'Drizzle';
            break;
        case 61: // Rain: Slight
            iconClass = 'fas fa-cloud-rain';
            conditionText = 'Slight Rain';
            break;
        case 63: // Rain: Moderate
            iconClass = 'fas fa-cloud-showers-heavy';
            conditionText = 'Moderate Rain';
            break;
        case 65: // Rain: Heavy
            iconClass = 'fas fa-cloud-showers-heavy';
            conditionText = 'Heavy Rain';
            break;
        case 80: // Rain showers: Slight
        case 81: // Rain showers: Moderate
        case 82: // Rain showers: Violent
            iconClass = 'fas fa-cloud-showers-heavy';
            conditionText = 'Rain Showers';
            break;
        case 95: // Thunderstorm: Slight or moderate
        case 96: // Thunderstorm with slight hail
        case 99: // Thunderstorm with heavy hail
            iconClass = 'fas fa-bolt';
            conditionText = 'Thunderstorm';
            break;
        default:
            iconClass = 'fas fa-question-circle';
            conditionText = 'Variable';
    }
    return { iconClass, conditionText };
}

/**
 * Helper function untuk geocoding nama lokasi menggunakan Nominatim.
 * @param {string} locationName - Nama lokasi yang dicari.
 * @returns {Promise<{lat: number, lon: number, name: string}>} - Koordinat dan nama yang sudah di-clean.
 */
async function geocodeLocation(locationName) {
    const geoResponse = await axios.get(NOMINATIM_BASE_URL, {
        params: { q: locationName, format: 'json', limit: 1 }
    });

    if (!geoResponse.data || geoResponse.data.length === 0) {
        throw new Error(`Location not found for: ${locationName}`);
    }

    const data = geoResponse.data[0];
    const lat = parseFloat(data.lat);
    const lon = parseFloat(data.lon);
    
    // Ambil nama kota utama
    let name = data.display_name.split(',')[0].trim();
    if (!name || name === data.lat) { // Fallback jika nama terlalu spesifik/hanya koordinat
        name = locationName; 
    }

    return { lat, lon, name };
}

// --- API Route Cuaca Standar (Untuk Home dan World Forecast) ---
app.get('/api/weather', async (req, res) => {
    let { location, lat, lon } = req.query; 
    let geoLoc = {}; // Objek untuk menyimpan hasil geocoding jika ada

    try {
        if (location) {
            // Langkah 1: Konversi Nama Kota ke Lat/Lon menggunakan Nominatim
            geoLoc = await geocodeLocation(location);
            lat = geoLoc.lat;
            lon = geoLoc.lon;
            location = geoLoc.name;
        } else if (!lat || !lon) {
            return res.status(400).json({ error: 'Location or valid coordinates (lat/lon) parameter is required' });
        }

        // Langkah 2: Ambil data cuaca dari Open-Meteo
        const weatherResponse = await axios.get(OPEN_METEO_BASE_URL, {
            params: {
                latitude: lat,
                longitude: lon,
                // Meminta data yang diperlukan, termasuk 'is_day' dan prakiraan harian 7 hari
                current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
                daily: 'weather_code,temperature_2m_max,temperature_2m_min', // Tambahkan prakiraan harian
                temperature_unit: 'celsius',
                wind_speed_unit: 'ms',
                timezone: 'auto',
                forecast_days: 7 // Meminta prakiraan 7 hari
            }
        });

        if (!weatherResponse.data || !weatherResponse.data.current) {
            return res.status(500).json({ error: 'Failed to retrieve current weather data from Open-Meteo.' });
        }
        
        const current = weatherResponse.data.current;
        const daily = weatherResponse.data.daily;

        if (current.weather_code === undefined || current.is_day === undefined) {
             return res.status(500).json({ error: 'Missing critical weather codes in API response.' });
        }
        
        const wmoCode = current.weather_code;
        const isDay = current.is_day === 1;
        const isNight = current.is_day === 0; // Logika kartu gelap

        const { iconClass, conditionText } = mapWeatherCode(wmoCode, isDay);

        // Langkah 3: Balas ke frontend
        res.json({
            temp: current.temperature_2m,
            city: location || 'Current Location', 
            condition: conditionText,
            icon: iconClass, 
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            isNight: isNight, 
            // Sertakan prakiraan harian untuk analisis rute jika dibutuhkan di masa depan
            dailyForecast: daily 
        });

    } catch (error) {
        console.error("Error fetching weather data:", error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch weather data from external APIs.' });
    }
});


// --- API Route Khusus Analisis Rute ---
app.get('/api/route-weather', async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: 'Start and end location parameters are required.' });
    }

    try {
        // 1. Geocoding Titik A dan B
        const locA = await geocodeLocation(start);
        const locB = await geocodeLocation(end);

        // 2. Hitung Titik Tengah (Midpoint)
        // Logika sederhana: rata-rata koordinat untuk perkiraan cuaca "di sepanjang rute"
        const midLat = (locA.lat + locB.lat) / 2;
        const midLon = (locA.lon + locB.lon) / 2;

        // 3. Ambil Prakiraan Cuaca 7 Hari di Titik Tengah
        const weatherResponse = await axios.get(OPEN_METEO_BASE_URL, {
            params: {
                latitude: midLat,
                longitude: midLon,
                daily: 'weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min', 
                temperature_unit: 'celsius',
                timezone: 'auto',
                forecast_days: 5 // Ambil prakiraan 5 hari ke depan untuk perjalanan
            }
        });
        
        if (!weatherResponse.data || !weatherResponse.data.daily) {
             return res.status(500).json({ error: 'Failed to retrieve daily forecast for route analysis.' });
        }
        
        const dailyData = weatherResponse.data.daily;
        const dates = dailyData.time;
        const wmoCodes = dailyData.weather_code;
        const precipitation = dailyData.precipitation_sum;
        
        let shouldCarryUmbrella = false;
        let shouldCarryCoat = false;
        let highestRain = 0;
        let majorCondition = '';
        
        // Analisis Sederhana: Tinjau Prakiraan 5 Hari Pertama (Asumsi lama perjalanan)
        for (let i = 0; i < wmoCodes.length; i++) {
            const code = wmoCodes[i];
            const rain = precipitation[i];
            
            // Cek hujan (Code 51-82)
            if (code >= 51 && code <= 82) {
                shouldCarryUmbrella = true;
                if (rain > highestRain) highestRain = rain;
                if (code >= 63) { // Moderate to heavy rain
                    shouldCarryCoat = true; 
                }
            }
            
            // Tentukan kondisi cuaca utama (hanya ambil kondisi terburuk)
            const { conditionText } = mapWeatherCode(code, true);
            if (conditionText.includes('Rain') || conditionText.includes('Thunderstorm')) {
                majorCondition = conditionText;
            }
        }
        
        if (highestRain > 10) shouldCarryCoat = true;
        
        const finalAdvice = {
            needsUmbrella: shouldCarryUmbrella,
            needsRainCoat: shouldCarryCoat,
            highestPrecipitation: highestRain,
            majorCondition: majorCondition || mapWeatherCode(wmoCodes[0], true).conditionText,
            startDate: dates[0]
        };


        // 4. Balas ke Frontend
        res.json({
            start: locA,
            end: locB,
            midpoint: { lat: midLat, lon: midLon },
            advice: finalAdvice,
            forecast: dailyData
        });

    } catch (error) {
        console.error("Error fetching route data:", error.message);
        res.status(500).json({ error: error.message || 'Failed to analyze route weather.' });
    }
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log('Access the website via: http://localhost:3000/');
});
