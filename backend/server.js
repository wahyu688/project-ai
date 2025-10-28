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
    if (!name || name === data.lat) { 
        name = locationName; 
    }

    return { lat, lon, name };
}

// --- API Route Cuaca Standar (Untuk Home dan World Forecast) ---
app.get('/api/weather', async (req, res) => {
    let { location, lat, lon } = req.query; 
    let geoLoc = {}; 

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
                current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
                temperature_unit: 'celsius',
                wind_speed_unit: 'ms',
                timezone: 'auto'
            }
        });

        if (!weatherResponse.data || !weatherResponse.data.current) {
            return res.status(500).json({ error: 'Failed to retrieve current weather data from Open-Meteo.' });
        }
        
        const current = weatherResponse.data.current;
        
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
            isNight: isNight 
        });

    } catch (error) {
        console.error("Error fetching weather data:", error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch weather data from external APIs.' });
    }
});


// --- API Route Khusus Analisis Rute (Prakiraan 3 Jam & Zona Warna) ---
app.get('/api/route-weather', async (req, res) => {
    const { start, end, startTime } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: 'Start and end location parameters are required.' });
    }

    try {
        // 1. Geocoding Titik A dan B
        const locA = await geocodeLocation(start);
        const locB = await geocodeLocation(end);

        // 2. Tentukan Titik Cuaca Rute (4 Titik: Awal, Tengah 1, Tengah 2, Akhir)
        const midLat1 = (locA.lat * 2 + locB.lat) / 3;
        const midLon1 = (locA.lon * 2 + locB.lon) / 3;
        const midLat2 = (locA.lat + locB.lat * 2) / 3;
        const midLon2 = (locA.lon + locB.lon * 2) / 3;

        const checkPoints = [
            { lat: locA.lat, lon: locA.lon, name: locA.name },
            { lat: midLat1, lon: midLon1, name: 'Midpoint 1' },
            { lat: midLat2, lon: midLon2, name: 'Midpoint 2' },
            { lat: locB.lat, lon: locB.lon, name: locB.name },
        ];
        
        // Waktu mulai perjalanan (dalam jam)
        const startHour = startTime ? parseInt(startTime) : new Date().getHours();
        
        const hourlyForecasts = [];
        let rainPoints = [];
        let shouldCarryUmbrella = false;
        let finalMajorCondition = '';
        let highestRain = 0;
        
        // Durasi prakiraan (3 jam sesuai permintaan)
        const FORECAST_DURATION = 3; 

        // 3. Ambil Prakiraan Cuaca Jam Per Jam untuk SETIAP Titik Cuaca
        for (const point of checkPoints) {
            const weatherResponse = await axios.get(OPEN_METEO_BASE_URL, {
                params: {
                    latitude: point.lat,
                    longitude: point.lon,
                    // Meminta suhu, kode cuaca, curah hujan, dan is_day
                    hourly: 'weather_code,temperature_2m,precipitation,is_day', 
                    temperature_unit: 'celsius',
                    timezone: 'auto',
                    forecast_days: 1 
                }
            });
            
            if (!weatherResponse.data || !weatherResponse.data.hourly) {
                 continue; 
            }
            
            const hourlyData = weatherResponse.data.hourly;
            
            // Cari indeks waktu mulai
            const startIndex = hourlyData.time.findIndex(timeStr => {
                const hour = new Date(timeStr).getHours();
                return hour === startHour;
            });
            
            if (startIndex === -1) {
                continue;
            }
            
            // Ambil data untuk 3 jam ke depan
            for (let i = 0; i < FORECAST_DURATION; i++) {
                const index = startIndex + i;
                if (index >= hourlyData.time.length) break; 

                const wmoCode = hourlyData.weather_code[index];
                const rain = hourlyData.precipitation[index];
                const temp = hourlyData.temperature_2m[index];
                const isDay = hourlyData.is_day[index] === 1;
                const timeStr = hourlyData.time[index];
                const hour = new Date(timeStr).getHours();
                
                const { conditionText, iconClass } = mapWeatherCode(wmoCode, isDay);
                
                // Analisis Curah Hujan/Kondisi
                if (rain > 0.5 || (wmoCode >= 51 && wmoCode <= 82) || wmoCode === 95 || wmoCode === 96 || wmoCode === 99) {
                    shouldCarryUmbrella = true;
                    if (rain > highestRain) highestRain = rain;
                }
                
                // Kumpulkan titik cuaca untuk visualisasi peta (Ambil data dari jam pertama)
                if (i === 0) {
                     rainPoints.push({
                        lat: point.lat, 
                        lon: point.lon, 
                        time: timeStr,
                        condition: conditionText,
                        precipitation: rain.toFixed(1),
                        // Kirim suhu untuk penentuan warna peta (Merah/Kuning/Biru)
                        temp: temp.toFixed(1), 
                        wmoCode: wmoCode // Kirim WMO code untuk penentuan kondisi
                    });
                }
                
                // Kumpulkan prakiraan jam per jam (hanya dari titik awal untuk analisis AI)
                if (point.name === locA.name) {
                    hourlyForecasts.push({
                        hour: hour,
                        condition: conditionText,
                        icon: iconClass,
                        temp: temp,
                        rain: rain.toFixed(1)
                    });
                    
                    if (i === 0) finalMajorCondition = conditionText;
                }
            }
        }
        
        // Analisis akhir AI
        const finalAdvice = {
            needsUmbrella: shouldCarryUmbrella,
            needsRainCoat: highestRain >= 5.0,
            highestPrecipitation: highestRain,
            majorCondition: finalMajorCondition,
            forecast: hourlyForecasts,
        };

        // 4. Balas ke Frontend
        res.json({
            start: locA,
            end: locB,
            rainPoints: rainPoints, // rainPoints sekarang membawa suhu dan WMO code
            advice: finalAdvice,
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
