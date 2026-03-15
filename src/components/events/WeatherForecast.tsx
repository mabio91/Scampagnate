import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudRain, Sun, Snowflake, CloudSun, Droplets, ThermometerSun } from "lucide-react";
import { motion } from "framer-motion";

interface WeatherForecastProps {
  location: string;
  date: string;
}

interface DailyWeather {
  temperature_max: number;
  temperature_min: number;
  weathercode: number;
  precipitation_probability_max: number;
}

const WMO_CODES: Record<number, { label: string; icon: typeof Sun }> = {
  0: { label: "Clear sky", icon: Sun },
  1: { label: "Mostly clear", icon: Sun },
  2: { label: "Partly cloudy", icon: CloudSun },
  3: { label: "Overcast", icon: Cloud },
  45: { label: "Fog", icon: Cloud },
  48: { label: "Rime fog", icon: Cloud },
  51: { label: "Light drizzle", icon: CloudRain },
  53: { label: "Drizzle", icon: CloudRain },
  55: { label: "Heavy drizzle", icon: CloudRain },
  61: { label: "Light rain", icon: CloudRain },
  63: { label: "Rain", icon: CloudRain },
  65: { label: "Heavy rain", icon: CloudRain },
  66: { label: "Freezing rain", icon: CloudRain },
  67: { label: "Heavy freezing rain", icon: CloudRain },
  71: { label: "Light snow", icon: Snowflake },
  73: { label: "Snow", icon: Snowflake },
  75: { label: "Heavy snow", icon: Snowflake },
  77: { label: "Snow grains", icon: Snowflake },
  80: { label: "Light showers", icon: CloudRain },
  81: { label: "Showers", icon: CloudRain },
  82: { label: "Heavy showers", icon: CloudRain },
  85: { label: "Snow showers", icon: Snowflake },
  86: { label: "Heavy snow showers", icon: Snowflake },
  95: { label: "Thunderstorm", icon: CloudRain },
  96: { label: "Thunderstorm w/ hail", icon: CloudRain },
  99: { label: "Thunderstorm w/ heavy hail", icon: CloudRain },
};

const getWeatherInfo = (code: number) => {
  return WMO_CODES[code] || { label: "Unknown", icon: Cloud };
};

const isRainy = (code: number) => code >= 51;

// Extract a geocodable location: try last comma-separated part (usually city), or full string
const extractGeoLocation = (location: string): string => {
  // Common patterns: "Venue Name, City" or "Address, City" or just "City"
  const parts = location.split(",").map(p => p.trim());
  // Try the last part first (usually city), then full location
  if (parts.length >= 2) {
    return parts[parts.length - 1]; // e.g., "Roma" from "Terrazza Romana, Roma"
  }
  return location;
};

export const WeatherForecast = ({ location, date }: WeatherForecastProps) => {
  const eventDate = new Date(date);
  const now = new Date();
  const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const canShowForecast = daysUntil >= 0 && daysUntil <= 14;

  const { data: weather, isLoading } = useQuery({
    queryKey: ["weather-forecast", location, date],
    queryFn: async (): Promise<DailyWeather | null> => {
      const geoLocation = extractGeoLocation(location);
      
      // Try geocoding with extracted location, fallback to full location
      let geoData: any = null;
      for (const loc of [geoLocation, location]) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=it`
        );
        geoData = await geoRes.json();
        if (geoData.results?.length) break;
      }
      
      if (!geoData?.results?.length) return null;

      const { latitude, longitude } = geoData.results[0];

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=Europe/Rome&start_date=${date}&end_date=${date}`
      );
      const weatherData = await weatherRes.json();

      if (!weatherData.daily?.time?.length) return null;

      return {
        temperature_max: weatherData.daily.temperature_2m_max[0],
        temperature_min: weatherData.daily.temperature_2m_min[0],
        weathercode: weatherData.daily.weathercode[0],
        precipitation_probability_max: weatherData.daily.precipitation_probability_max[0],
      };
    },
    enabled: canShowForecast,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  if (!canShowForecast || isLoading || !weather) return null;

  const info = getWeatherInfo(weather.weathercode);
  const WeatherIcon = info.icon;
  const rainy = isRainy(weather.weathercode);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.13 }} 
      className="py-4 border-b border-border"
    >
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${
        rainy 
          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30" 
          : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30"
      }`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          rainy ? "bg-blue-100 dark:bg-blue-900/40" : "bg-amber-100 dark:bg-amber-900/40"
        }`}>
          <WeatherIcon className={`h-5 w-5 ${rainy ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-body font-semibold text-foreground">
              {info.label} · {Math.round(weather.temperature_max)}°C
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-body text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <ThermometerSun className="h-3 w-3" />
              {Math.round(weather.temperature_min)}–{Math.round(weather.temperature_max)}°C
            </span>
            {weather.precipitation_probability_max > 0 && (
              <span className="flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                {weather.precipitation_probability_max}% rain
              </span>
            )}
          </div>
        </div>
        {rainy && (
          <span className="text-[10px] font-body font-bold text-blue-600 dark:text-blue-400 px-2 py-1 bg-blue-100/80 dark:bg-blue-900/40 rounded-full flex-shrink-0">
            ☔ Rain
          </span>
        )}
      </div>
    </motion.div>
  );
};
