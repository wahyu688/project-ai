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

// --- API Route Cuaca ---
app.get('/api/weather', async (req, res) => {
    let { location, lat, lon } = req.query; 

    try {
        if (location) {
            // Langkah 1: Konversi Nama Kota ke Lat/Lon menggunakan Nominatim
            const geoResponse = await axios.get(NOMINATIM_BASE_URL, {
                params: {
                    q: location,
                    format: 'json',
                    limit: 1
                }
            });

            if (!geoResponse.data || geoResponse.data.length === 0) {
                return res.status(404).json({ error: 'Location not found via search.' });
            }

            lat = geoResponse.data[0].lat;
            lon = geoResponse.data[0].lon;
            // Ambil nama kota utama, hapus koma dan detail lainnya
            location = geoResponse.data[0].display_name.split(',')[0].trim(); 
        } else if (!lat || !lon) {
            return res.status(400).json({ error: 'Location or valid coordinates (lat/lon) parameter is required' });
        }

        // Langkah 2: Ambil data cuaca dari Open-Meteo
        const weatherResponse = await axios.get(OPEN_METEO_BASE_URL, {
            params: {
                latitude: lat,
                longitude: lon,
                // Meminta data yang diperlukan, termasuk 'is_day'
                current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
                temperature_unit: 'celsius',
                wind_speed_unit: 'ms',
                timezone: 'auto'
            }
        });

        const current = weatherResponse.data.current;
        const wmoCode = current.weather_code;
        const isDay = current.is_day === 1;
        const isNight = current.is_day === 0; // Logika kartu gelap

        const { iconClass, conditionText } = mapWeatherCode(wmoCode, isDay);

        // Langkah 3: Balas ke frontend
        res.json({
            temp: current.temperature_2m,
            city: location || 'Current Location', 
            condition: conditionText,
            icon: iconClass, // Mengirim class Font Awesome
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            isNight: isNight // Mengirim status malam
        });

    } catch (error) {
        console.error("Error fetching weather data:", error.message);
        res.status(500).json({ error: 'Failed to fetch weather data from external APIs.' });
    }
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log('Access the website via: http://localhost:3000/');
});
