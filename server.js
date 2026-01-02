// server.js
const express = require('express');
const axios = require('axios');
const path = require('path'); 
const app = express();
const port = 3000;

// Use CORS middleware
const cors = require('cors');
app.use(cors());

const publicPath = path.join(__dirname, 'public_html');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'home.html')); 
});

// --- KONSTANTA API ---
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// =================================================================================
// 🧠 MARKOV CHAIN MACHINE LEARNING ENGINE
// =================================================================================

class WeatherMarkovChain {
    constructor() {
        // Matriks Transisi Probabilitas (Pre-trained/Hardcoded Knowledge Base)
        // Baris: Kondisi Saat Ini -> Kolom: Probabilitas Pindah ke Kondisi Berikutnya
        // Kondisi: 0=Cerah, 1=Berawan, 2=Hujan Ringan, 3=Hujan Lebat/Badai
        this.transitionMatrix = {
            'clear':   { 'clear': 0.85, 'cloudy': 0.12, 'rain': 0.03, 'storm': 0.00 },
            'cloudy':  { 'clear': 0.25, 'cloudy': 0.55, 'rain': 0.15, 'storm': 0.05 },
            'rain':    { 'clear': 0.10, 'cloudy': 0.30, 'rain': 0.50, 'storm': 0.10 },
            'storm':   { 'clear': 0.05, 'cloudy': 0.15, 'rain': 0.40, 'storm': 0.40 }
        };
    }

    // Helper untuk memetakan WMO Code ke State Sederhana
    getStateFromWmo(code) {
        if (code === 0 || code === 1) return 'clear';
        if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
        if (code >= 95) return 'storm';
        return 'cloudy'; // Default fallback
    }

    // Fungsi Prediksi Monte Carlo (Simulasi)
    predictStability(startConditionCode, hoursAhead = 3) {
        let currentState = this.getStateFromWmo(startConditionCode);
        const simulations = 100; // Jalankan 100 simulasi untuk akurasi
        let badWeatherCount = 0;

        for (let i = 0; i < simulations; i++) {
            let tempState = currentState;
            // Simulasi langkah per jam
            for (let h = 0; h < hoursAhead; h++) {
                tempState = this.nextState(tempState);
                if (tempState === 'rain' || tempState === 'storm') {
                    badWeatherCount++;
                    break; // Jika hujan, kita anggap trip terganggu
                }
            }
        }

        const riskPercentage = (badWeatherCount / simulations) * 100;
        return {
            riskScore: riskPercentage,
            stabilityMessage: this.getAdvice(riskPercentage, currentState)
        };
    }

    // Algoritma Roulete Wheel Selection untuk memilih state berikutnya berdasarkan probabilitas
    nextState(current) {
        const probabilities = this.transitionMatrix[current];
        const rand = Math.random();
        let cumulative = 0;

        for (const [state, prob] of Object.entries(probabilities)) {
            cumulative += prob;
            if (rand <= cumulative) {
                return state;
            }
        }
        return current; // Fallback
    }

    getAdvice(risk, startState) {
        if (risk < 20) return `Analisis Markov: Cuaca Sangat Stabil. Probabilitas perubahan drastis sangat kecil (${risk.toFixed(1)}%).`;
        if (risk < 50) return `Analisis Markov: Stabilitas Sedang. Ada kemungkinan (${risk.toFixed(1)}%) kondisi berubah menjadi basah.`;
        return `Analisis Markov: KETIDAKSTABILAN TINGGI. Model mendeteksi risiko tinggi (${risk.toFixed(1)}%) cuaca memburuk. Waspada.`;
    }
}

// Inisialisasi Model AI
const markovModel = new WeatherMarkovChain();

// =================================================================================
// END MARKOV ENGINE
// =================================================================================


// Helper function WMO
function mapWeatherCode(wmoCode, isDay) {
    let iconClass = 'fas fa-question';
    let conditionText = 'Variable'; 

    switch (wmoCode) {
        case 0: iconClass = isDay ? 'fas fa-sun' : 'fas fa-moon'; conditionText = 'Clear Sky'; break;
        case 1: case 2: iconClass = isDay ? 'fas fa-cloud-sun' : 'fas fa-cloud-moon'; conditionText = 'Partly Cloudy'; break;
        case 3: iconClass = 'fas fa-cloud'; conditionText = 'Overcast'; break;
        case 45: case 48: iconClass = 'fas fa-smog'; conditionText = 'Fog'; break;
        case 51: case 53: case 55: iconClass = 'fas fa-cloud-rain'; conditionText = 'Drizzle'; break;
        case 61: iconClass = 'fas fa-cloud-rain'; conditionText = 'Slight Rain'; break;
        case 63: iconClass = 'fas fa-cloud-showers-heavy'; conditionText = 'Moderate Rain'; break;
        case 65: iconClass = 'fas fa-cloud-showers-heavy'; conditionText = 'Heavy Rain'; break;
        case 80: case 81: case 82: iconClass = 'fas fa-cloud-showers-heavy'; conditionText = 'Rain Showers'; break;
        case 95: case 96: case 99: iconClass = 'fas fa-bolt'; conditionText = 'Thunderstorm'; break;
        default: iconClass = 'fas fa-question-circle'; conditionText = 'Variable';
    }
    return { iconClass, conditionText };
}

async function geocodeLocation(locationName) {
    try {
        const geoResponse = await axios.get(NOMINATIM_BASE_URL, {
            params: { q: locationName, format: 'json', limit: 1 },
            headers: { 'User-Agent': 'CuacaneApp/1.0' }
        });

        if (!geoResponse.data || geoResponse.data.length === 0) {
            throw new Error(`Location not found for: ${locationName}`);
        }

        const data = geoResponse.data[0];
        let name = data.display_name.split(',')[0].trim();
        return { lat: parseFloat(data.lat), lon: parseFloat(data.lon), name };
    } catch (e) {
        throw e;
    }
}

// --- API Route Cuaca Standar ---
app.get('/api/weather', async (req, res) => {
    let { location, lat, lon } = req.query; 

    try {
        if (location) {
            const geoLoc = await geocodeLocation(location);
            lat = geoLoc.lat;
            lon = geoLoc.lon;
            location = geoLoc.name;
        } else if (!lat || !lon) {
            return res.status(400).json({ error: 'Location required' });
        }

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

        const current = weatherResponse.data.current;
        const { iconClass, conditionText } = mapWeatherCode(current.weather_code, current.is_day === 1);

        res.json({
            temp: current.temperature_2m,
            city: location || 'Location', 
            condition: conditionText,
            icon: iconClass, 
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            isNight: current.is_day === 0
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API Route Detail (24 Jam) ---
app.get('/api/weather-detail', async (req, res) => {
    let { location } = req.query;
    if (!location) return res.status(400).json({ error: 'Location required' });

    try {
        const geoLoc = await geocodeLocation(location);
        const weatherResponse = await axios.get(OPEN_METEO_BASE_URL, {
            params: {
                latitude: geoLoc.lat,
                longitude: geoLoc.lon,
                current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
                hourly: 'temperature_2m,weather_code,is_day',
                temperature_unit: 'celsius',
                wind_speed_unit: 'ms',
                timezone: 'auto',
                forecast_days: 2
            }
        });

        const data = weatherResponse.data;
        const current = data.current;
        const hourly = data.hourly;
        const currentWmo = mapWeatherCode(current.weather_code, current.is_day === 1);

        const currentHour = new Date().getHours();
        const next24Hours = [];
        let startIndex = hourly.time.findIndex(t => new Date(t).getHours() === currentHour);
        if (startIndex === -1) startIndex = 0;

        for (let i = 0; i < 24; i++) {
            const index = startIndex + i;
            if (index >= hourly.time.length) break;
            const wmo = mapWeatherCode(hourly.weather_code[index], hourly.is_day[index] === 1);
            next24Hours.push({
                time: new Date(hourly.time[index]).getHours() + ':00',
                temp: Math.round(hourly.temperature_2m[index]),
                icon: wmo.iconClass,
                condition: wmo.conditionText
            });
        }

        res.json({
            city: geoLoc.name,
            current: {
                temp: current.temperature_2m,
                humidity: current.relative_humidity_2m,
                windSpeed: current.wind_speed_10m,
                condition: currentWmo.conditionText,
                icon: currentWmo.iconClass
            },
            hourly: next24Hours
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API Route Khusus Analisis Rute (DENGAN MARKOV CHAIN AI) ---
app.get('/api/route-weather', async (req, res) => {
    const { start, end, startTime } = req.query;

    if (!start || !end) return res.status(400).json({ error: 'Start/End required.' });

    try {
        const locA = await geocodeLocation(start);
        const locB = await geocodeLocation(end);

        const midLat = (locA.lat + locB.lat) / 2;
        const midLon = (locA.lon + locB.lon) / 2;

        const checkPoints = [
            { lat: locA.lat, lon: locA.lon, name: locA.name },
            { lat: midLat, lon: midLon, name: 'Midpoint' },
            { lat: locB.lat, lon: locB.lon, name: locB.name },
        ];
        
        const startHour = startTime ? parseInt(startTime) : new Date().getHours();
        
        let rainPoints = [];
        let shouldCarryUmbrella = false;
        let highestRain = 0;
        let startWeatherCode = 0; // Untuk input ke Markov Model

        // Ambil Data Aktual dari API
        for (let i = 0; i < checkPoints.length; i++) {
            const point = checkPoints[i];
            const weatherResponse = await axios.get(OPEN_METEO_BASE_URL, {
                params: {
                    latitude: point.lat,
                    longitude: point.lon,
                    hourly: 'weather_code,temperature_2m,precipitation,is_day', 
                    temperature_unit: 'celsius',
                    timezone: 'auto',
                    forecast_days: 1 
                }
            });
            
            if (!weatherResponse.data || !weatherResponse.data.hourly) continue;
            
            const hourlyData = weatherResponse.data.hourly;
            const startIndex = hourlyData.time.findIndex(t => new Date(t).getHours() === startHour);
            if (startIndex === -1) continue;

            const wmoCode = hourlyData.weather_code[startIndex];
            const rain = hourlyData.precipitation[startIndex];
            const temp = hourlyData.temperature_2m[startIndex];
            const isDay = hourlyData.is_day[startIndex] === 1;
            
            // Simpan kode cuaca awal untuk analisis Markov
            if (i === 0) startWeatherCode = wmoCode;

            const { conditionText } = mapWeatherCode(wmoCode, isDay);

            if (rain > 0.5 || (wmoCode >= 51 && wmoCode <= 99)) {
                shouldCarryUmbrella = true;
                if (rain > highestRain) highestRain = rain;
            }

            rainPoints.push({
                lat: point.lat, lon: point.lon, 
                time: hourlyData.time[startIndex],
                condition: conditionText,
                precipitation: rain.toFixed(1),
                temp: temp.toFixed(1), wmoCode: wmoCode
            });
        }

        // --- JALANKAN ANALISIS MARKOV (AI PREDICTION) ---
        // Kita gunakan Markov Model untuk memprediksi stabilitas cuaca 3 jam ke depan
        // berdasarkan kondisi awal di titik keberangkatan.
        const markovAnalysis = markovModel.predictStability(startWeatherCode, 3);

        const finalAdvice = {
            needsUmbrella: shouldCarryUmbrella,
            needsRainCoat: highestRain >= 2.0,
            highestPrecipitation: highestRain,
            // Gabungkan logika rule-based dengan analisis Markov
            majorCondition: markovAnalysis.stabilityMessage, 
            markovRiskScore: markovAnalysis.riskScore, // Data tambahan untuk frontend jika perlu
            forecast: [] // Disederhanakan untuk contoh ini
        };

        res.json({
            start: locA,
            end: locB,
            rainPoints: rainPoints, 
            advice: finalAdvice,
        });

    } catch (error) {
        console.error("Error route:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- API BERITA (REAL-TIME VIA GOOGLE NEWS RSS) ---
app.get('/api/weather-news', async (req, res) => {
    try {
        const rssUrl = 'https://news.google.com/rss/search?q=weather+climate+environment&hl=en-US&gl=US&ceid=US:en';
        const response = await axios.get(rssUrl);
        const xmlData = response.data;
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xmlData)) !== null && items.length < 6) {
            const itemContent = match[1];
            const titleMatch = /<title>(.*?)<\/title>/.exec(itemContent);
            const linkMatch = /<link>(.*?)<\/link>/.exec(itemContent);
            const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);
            const sourceMatch = /<source url=".*?">(.*?)<\/source>/.exec(itemContent);

            if (titleMatch && linkMatch) {
                items.push({
                    title: titleMatch[1].replace('<![CDATA[', '').replace(']]>', ''),
                    link: linkMatch[1],
                    date: dateMatch ? dateMatch[1] : new Date().toISOString(),
                    source: sourceMatch ? sourceMatch[1] : "Global News"
                });
            }
        }
        res.json({ news: items });
    } catch (error) {
        res.status(500).json({ news: [], error: 'Gagal mengambil berita.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});