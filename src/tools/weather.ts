// ─── Weather Tool ─────────────────────────────────────────────

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const weatherTool = new DynamicStructuredTool({
    name: "get_weather",
    description: "Get the current weather for a location. Provide a city name.",
    schema: z.object({
        location: z.string().describe("City name (e.g., 'Tokyo', 'New York', 'London')"),
    }),
    func: async ({ location }) => {
        try {
            // Step 1: Geocode the location
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
            const geoResponse = await fetch(geoUrl);
            const geoData = (await geoResponse.json()) as {
                results?: Array<{
                    name: string;
                    country: string;
                    latitude: number;
                    longitude: number;
                }>;
            };

            if (!geoData.results?.length) {
                return JSON.stringify({ error: `Location "${location}" not found.` });
            }

            const loc = geoData.results[0];

            // Step 2: Fetch weather
            const weatherUrl =
                `https://api.open-meteo.com/v1/forecast?` +
                `latitude=${loc.latitude}&longitude=${loc.longitude}` +
                `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
                `&temperature_unit=celsius`;

            const weatherResponse = await fetch(weatherUrl);
            const weatherData = (await weatherResponse.json()) as {
                current: {
                    temperature_2m: number;
                    relative_humidity_2m: number;
                    wind_speed_10m: number;
                    weather_code: number;
                };
            };

            const current = weatherData.current;

            return JSON.stringify({
                location: `${loc.name}, ${loc.country}`,
                temperature: current.temperature_2m,
                unit: "°C",
                humidity: current.relative_humidity_2m,
                windSpeed: current.wind_speed_10m,
                windUnit: "km/h",
                condition: getWeatherDescription(current.weather_code),
            });
        } catch (err) {
            return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
    },
});

function getWeatherDescription(code: number): string {
    const descriptions: Record<number, string> = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
        55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
        71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
        80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
        95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
    };
    return descriptions[code] ?? "Unknown";
}
