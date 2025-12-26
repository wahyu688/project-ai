// server.js
const express = require('express');
const axios = require('axios');
const path = require('path'); 
const app = express();
const port = 3000;

// Use CORS middleware
const cors = require('cors');
app.use(cors());

// Path configuration
const publicPath = path.join(__dirname, '..', 'public_html');

// 1. Melayani File Statis
app.use(express.static(publicPath));

// 2. Route Root
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'home.html')); 
});


// --- KONSTANTA API ---
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
// URL RSS untuk Berita Real-Time (NASA Earth Observatory)
const NEWS_RSS_URL = 'https://earthobservatory.nasa.gov/feeds/earth-observatory.rss';

// Helper function to map WMO code
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

// Helper Geocoding
async function geocodeLocation(locationName) {
    const geoResponse = await axios.get(NOMINATIM_BASE_URL, {
        params: { q: locationName, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'CuacaneApp/1.0' }
    });

    if (!geoResponse.data || geoResponse.data.length === 0) {
        throw new Error(`Location not found for: ${locationName}`);
    }

    const data = geoResponse.data[0];
    let name = data.display_name.split(',')[0].trim();
    if (!name || name === data.lat) { name = locationName; }

    return { lat: parseFloat(data.lat), lon: parseFloat(data.lon), name };
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
            return res.status(400).json({ error: 'Location or valid coordinates (lat/lon) parameter is required' });
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

        if (!weatherResponse.data || !weatherResponse.data.current) {
            return res.status(500).json({ error: 'Failed to retrieve current weather data.' });
        }
        
        const current = weatherResponse.data.current;
        const wmoCode = current.weather_code;
        const isDay = current.is_day === 1;
        const isNight = current.is_day === 0; 

        const { iconClass, conditionText } = mapWeatherCode(wmoCode, isDay);

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
        res.status(500).json({ error: error.message || 'Failed to fetch weather data.' });
    }
});


// --- API Route Khusus Analisis Rute (TETAP SAMA SEPERTI YANG ANDA KIRIM) ---
app.get('/api/route-weather', async (req, res) => {
    const { start, end, startTime } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: 'Start and end location parameters are required.' });
    }

    try {
        const locA = await geocodeLocation(start);
        const locB = await geocodeLocation(end);

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
        
        const startHour = startTime ? parseInt(startTime) : new Date().getHours();
        
        const hourlyForecasts = [];
        let rainPoints = [];
        let shouldCarryUmbrella = false;
        let finalMajorCondition = '';
        let highestRain = 0;
        const FORECAST_DURATION = 3; 

        for (const point of checkPoints) {
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
            const startIndex = hourlyData.time.findIndex(timeStr => {
                const hour = new Date(timeStr).getHours();
                return hour === startHour;
            });
            
            if (startIndex === -1) continue;
            
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
                
                if (rain > 0.5 || (wmoCode >= 51 && wmoCode <= 82) || wmoCode === 95 || wmoCode === 96 || wmoCode === 99) {
                    shouldCarryUmbrella = true;
                    if (rain > highestRain) highestRain = rain;
                }
                
                if (i === 0) {
                     rainPoints.push({
                        lat: point.lat, lon: point.lon, 
                        time: timeStr, condition: conditionText,
                        precipitation: rain.toFixed(1),
                        temp: temp.toFixed(1), wmoCode: wmoCode 
                    });
                }
                
                if (point.name === locA.name) {
                    hourlyForecasts.push({
                        hour: hour, condition: conditionText,
                        icon: iconClass, temp: temp, rain: rain.toFixed(1)
                    });
                    if (i === 0) finalMajorCondition = conditionText;
                }
            }
        }
        
        res.json({
            start: locA,
            end: locB,
            rainPoints: rainPoints, 
            advice: {
                needsUmbrella: shouldCarryUmbrella,
                needsRainCoat: highestRain >= 5.0,
                highestPrecipitation: highestRain,
                majorCondition: finalMajorCondition,
                forecast: hourlyForecasts,
            },
        });

    } catch (error) {
        console.error("Error fetching route data:", error.message);
        res.status(500).json({ error: error.message || 'Failed to analyze route weather.' });
    }
});

// --- API BERITA (REAL-TIME VIA GOOGLE NEWS RSS) ---
app.get('/api/weather-news', async (req, res) => {
    try {
        // 1. URL RSS Google News (Topik: Climate & Weather)
        // hl=en-US&gl=US artinya kita ambil berita Global dalam Bahasa Inggris (sesuai UI app Anda)
        const rssUrl = 'https://news.google.com/rss/search?q=weather+climate+environment&hl=en-US&gl=US&ceid=US:en';
        
        const response = await axios.get(rssUrl);
        const xmlData = response.data;

        // 2. Parsing XML Manual dengan Regex (Tanpa perlu install library tambahan)
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        // Ambil maksimal 6 berita terbaru
        while ((match = itemRegex.exec(xmlData)) !== null && items.length < 6) {
            const itemContent = match[1];
            
            // Ekstrak data spesifik
            const titleMatch = /<title>(.*?)<\/title>/.exec(itemContent);
            const linkMatch = /<link>(.*?)<\/link>/.exec(itemContent);
            const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);
            const sourceMatch = /<source url=".*?">(.*?)<\/source>/.exec(itemContent);

            if (titleMatch && linkMatch) {
                items.push({
                    // Bersihkan karakter aneh jika ada
                    title: titleMatch[1].replace('<![CDATA[', '').replace(']]>', ''),
                    link: linkMatch[1],
                    // Gunakan tanggal publikasi asli atau tanggal sekarang
                    date: dateMatch ? dateMatch[1] : new Date().toISOString(),
                    // Ambil nama penerbit (misal: CNN, BBC, Reuters)
                    source: sourceMatch ? sourceMatch[1] : "Weather News"
                });
            }
        }

        // 3. Kirim data JSON ke frontend
        res.json({ news: items });

    } catch (error) {
        console.error("Error fetching real-time news:", error.message);
        // Fallback darurat jika Google down (jarang terjadi)
        res.status(500).json({ 
            news: [], 
            error: 'Gagal mengambil berita real-time.' 
        });
    }
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log('Access the website via: http://localhost:3000/');
});