import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CloudRain,
  Sun,
  Snowflake,
  CloudSun,
  CloudDrizzle,
  CloudLightning,
  CloudFog,
  Wind,
} from "lucide-react";

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

const extractGeoLocation = (location: string): string => {
  const parts = location.split(",").map((part) => part.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return location;
};

export const WeatherForecast = ({
  location,
  date,
  overrideCondition,
  overrideTempMin,
  overrideTempMax,
  overrideTempAvg,
  overrideTemp,
}: WeatherForecastProps) => {
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

  const conditionMeta = overrideCondition ? WEATHER_CONDITIONS[overrideCondition] : null;
  const hasOverride = !!overrideCondition;
  const legacyAvg = overrideTemp ?? null;

  if (!hasOverride && (!canShowForecast || isLoading || !weather)) return null;

  let displayCondition: string;
  let WeatherIcon: typeof Sun;

  if (conditionMeta) {
    displayCondition = conditionMeta.label;
    WeatherIcon = conditionMeta.icon;
  } else if (overrideCondition) {
    displayCondition = overrideCondition;
    const effectiveCode = weather?.weathercode ?? 2;
    WeatherIcon = getWeatherInfo(effectiveCode).icon;
  } else {
    const effectiveCode = weather?.weathercode ?? 2;
    const info = getWeatherInfo(effectiveCode);
    displayCondition = info.labelIt;
    WeatherIcon = info.icon;
  }

  const displayTempMin = overrideTempMin ?? weather?.temperature_min ?? null;
  const displayTempMax = overrideTempMax ?? weather?.temperature_max ?? null;
  const displayTempAvg =
    overrideTempAvg ??
    legacyAvg ??
    (displayTempMin != null && displayTempMax != null
      ? Math.round((displayTempMin + displayTempMax) / 2)
      : displayTempMax);

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-16 h-16 rounded-3xl bg-muted/35 border border-border/40 flex items-center justify-center shrink-0">
        <WeatherIcon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-display font-bold text-foreground leading-tight">
          {displayCondition}
          {displayTempAvg != null ? ` ${Math.round(displayTempAvg)}°` : ""}
        </p>
        {(displayTempMin != null || displayTempMax != null) && (
          <p className="text-sm font-body text-muted-foreground mt-1 leading-tight">
            {displayTempMin != null ? `Min ${Math.round(displayTempMin)}°` : ""}
            {displayTempMin != null && displayTempMax != null ? "  " : ""}
            {displayTempMax != null ? `Max ${Math.round(displayTempMax)}°` : ""}
          </p>
        )}
      </div>
    </div>
  );
};
