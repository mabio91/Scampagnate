import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudRain, Sun, Snowflake, CloudSun, CloudDrizzle, CloudLightning, CloudFog, Wind } from "lucide-react";
import { motion } from "framer-motion";

interface WeatherForecastProps {
  location: string;
  date: string;
  overrideCondition?: string | null;
  overrideTempMin?: number | null;
  overrideTempMax?: number | null;
  overrideTempAvg?: number | null;
  /** @deprecated Use overrideTempAvg instead */
  overrideTemp?: number | null;
}

interface DailyWeather {
  temperature_max: number;
  temperature_min: number;
  weathercode: number;
  precipitation_probability_max: number;
}

// Predefined weather conditions (keys match the dropdown in EventForm)
const WEATHER_CONDITIONS: Record<string, { label: string; icon: typeof Sun; weatherCode: number }> = {
  sereno: { label: "Sereno", icon: Sun, weatherCode: 0 },
  parzialmente_nuvoloso: { label: "Parzialmente nuvoloso", icon: CloudSun, weatherCode: 2 },
  nuvoloso: { label: "Nuvoloso", icon: Cloud, weatherCode: 3 },
  pioggia_debole: { label: "Pioggia debole", icon: CloudDrizzle, weatherCode: 51 },
  pioggia: { label: "Pioggia", icon: CloudRain, weatherCode: 63 },
  temporale: { label: "Temporale", icon: CloudLightning, weatherCode: 95 },
  ventoso: { label: "Ventoso", icon: Wind, weatherCode: 2 },
  neve: { label: "Neve", icon: Snowflake, weatherCode: 73 },
  nebbia: { label: "Nebbia", icon: CloudFog, weatherCode: 45 },
};

const WMO_CODES: Record<number, { label: string; labelIt: string; icon: typeof Sun }> = {
  0: { label: "Clear sky", labelIt: "Sereno", icon: Sun },
  1: { label: "Mostly clear", labelIt: "Prevalentemente sereno", icon: Sun },
  2: { label: "Partly cloudy", labelIt: "Parzialmente nuvoloso", icon: CloudSun },
  3: { label: "Overcast", labelIt: "Nuvoloso", icon: Cloud },
  45: { label: "Fog", labelIt: "Nebbia", icon: CloudFog },
  48: { label: "Rime fog", labelIt: "Nebbia gelata", icon: CloudFog },
  51: { label: "Light drizzle", labelIt: "Pioggerella leggera", icon: CloudDrizzle },
  53: { label: "Drizzle", labelIt: "Pioggerella", icon: CloudDrizzle },
  55: { label: "Heavy drizzle", labelIt: "Pioggerella intensa", icon: CloudDrizzle },
  61: { label: "Light rain", labelIt: "Pioggia leggera", icon: CloudRain },
  63: { label: "Rain", labelIt: "Pioggia", icon: CloudRain },
  65: { label: "Heavy rain", labelIt: "Pioggia intensa", icon: CloudRain },
  66: { label: "Freezing rain", labelIt: "Pioggia gelata", icon: CloudRain },
  67: { label: "Heavy freezing rain", labelIt: "Pioggia gelata intensa", icon: CloudRain },
  71: { label: "Light snow", labelIt: "Neve leggera", icon: Snowflake },
  73: { label: "Snow", labelIt: "Neve", icon: Snowflake },
  75: { label: "Heavy snow", labelIt: "Neve intensa", icon: Snowflake },
  77: { label: "Snow grains", labelIt: "Granuli di neve", icon: Snowflake },
  80: { label: "Light showers", labelIt: "Rovesci leggeri", icon: CloudRain },
  81: { label: "Showers", labelIt: "Rovesci", icon: CloudRain },
  82: { label: "Heavy showers", labelIt: "Rovesci intensi", icon: CloudRain },
  85: { label: "Snow showers", labelIt: "Rovesci di neve", icon: Snowflake },
  86: { label: "Heavy snow showers", labelIt: "Rovesci di neve intensi", icon: Snowflake },
  95: { label: "Thunderstorm", labelIt: "Temporale", icon: CloudLightning },
  96: { label: "Thunderstorm w/ hail", labelIt: "Temporale con grandine", icon: CloudLightning },
  99: { label: "Thunderstorm w/ heavy hail", labelIt: "Temporale con grandine intensa", icon: CloudLightning },
};

const getWeatherInfo = (code: number) => {
  return WMO_CODES[code] || { label: "Unknown", labelIt: "Sconosciuto", icon: Cloud };
};

const getWeatherTheme = (code: number) => {
  if (code >= 95) return { bg: "bg-purple-50/60 dark:bg-purple-950/20", iconBg: "bg-purple-100 dark:bg-purple-900/40", iconColor: "text-purple-600 dark:text-purple-400" };
  if (code >= 71 && code <= 86) return { bg: "bg-sky-50/60 dark:bg-sky-950/20", iconBg: "bg-sky-100 dark:bg-sky-900/40", iconColor: "text-sky-600 dark:text-sky-400" };
  if (code >= 51) return { bg: "bg-blue-50/60 dark:bg-blue-950/20", iconBg: "bg-blue-100 dark:bg-blue-900/40", iconColor: "text-blue-600 dark:text-blue-400" };
  if (code >= 45) return { bg: "bg-gray-50/60 dark:bg-gray-800/20", iconBg: "bg-gray-100 dark:bg-gray-800/40", iconColor: "text-gray-500 dark:text-gray-400" };
  if (code >= 2) return { bg: "bg-slate-50/60 dark:bg-slate-800/20", iconBg: "bg-slate-100 dark:bg-slate-800/40", iconColor: "text-slate-500 dark:text-slate-400" };
  return { bg: "bg-amber-50/60 dark:bg-amber-950/20", iconBg: "bg-amber-100 dark:bg-amber-900/40", iconColor: "text-amber-600 dark:text-amber-400" };
};

const extractGeoLocation = (location: string): string => {
  const parts = location.split(",").map(p => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return location;
};

export const WeatherForecast = ({ location, date, overrideCondition, overrideTempMin, overrideTempMax, overrideTempAvg, overrideTemp }: WeatherForecastProps) => {
  const eventDate = new Date(date);
  const now = new Date();
  const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const canShowForecast = daysUntil >= 0 && daysUntil <= 14;

  const { data: weather, isLoading } = useQuery({
    queryKey: ["weather-forecast", location, date],
    queryFn: async (): Promise<DailyWeather | null> => {
      const geoLocation = extractGeoLocation(location);
      
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

  // Resolve override condition (new key-based or legacy free-text)
  const conditionMeta = overrideCondition ? WEATHER_CONDITIONS[overrideCondition] : null;
  const hasOverride = !!overrideCondition;
  // Legacy single temp support
  const legacyAvg = overrideTemp ?? null;

  if (!hasOverride && (!canShowForecast || isLoading || !weather)) return null;

  // Determine display values — override temps fall back to forecast values
  let displayCondition: string;
  let WeatherIcon: typeof Sun;
  let effectiveWeatherCode: number;

  if (conditionMeta) {
    displayCondition = conditionMeta.label;
    WeatherIcon = conditionMeta.icon;
    effectiveWeatherCode = conditionMeta.weatherCode;
  } else if (overrideCondition) {
    // Legacy free-text condition
    displayCondition = overrideCondition;
    effectiveWeatherCode = weather?.weathercode ?? 2;
    WeatherIcon = getWeatherInfo(effectiveWeatherCode).icon;
  } else {
    effectiveWeatherCode = weather?.weathercode ?? 2;
    const info = getWeatherInfo(effectiveWeatherCode);
    displayCondition = info.labelIt;
    WeatherIcon = info.icon;
  }

  const displayTempMin = overrideTempMin ?? weather?.temperature_min ?? null;
  const displayTempMax = overrideTempMax ?? weather?.temperature_max ?? null;
  const displayTempAvg = overrideTempAvg ?? legacyAvg ?? (displayTempMin != null && displayTempMax != null ? Math.round((displayTempMin + displayTempMax) / 2) : displayTempMax);
  const theme = getWeatherTheme(effectiveWeatherCode);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.08 }} 
      className="py-3"
    >
      <div className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl ${theme.bg}`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${theme.iconBg}`}>
          <WeatherIcon className={`h-5 w-5 ${theme.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
            Meteo previsto
          </p>
          <p className="text-sm font-body font-semibold text-foreground">
            {displayCondition}{displayTempAvg != null ? ` · ${Math.round(displayTempAvg)}°C` : ""}
          </p>
          {displayTempMin != null && displayTempMax != null && (
            <p className="text-[11px] font-body text-muted-foreground">
              Min {Math.round(displayTempMin)}° · Max {Math.round(displayTempMax)}°
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
