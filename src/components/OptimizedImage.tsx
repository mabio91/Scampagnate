import { useState, useCallback, ImgHTMLAttributes, memo } from "react";
import heroTrekking from "@/assets/hero-trekking.jpg";
import eventSocial from "@/assets/event-social.jpg";
import eventSport from "@/assets/event-sport.jpg";
import eventCulture from "@/assets/event-culture.jpg";

const fallbackMap: Record<string, string> = {
  trekking: heroTrekking,
  social: eventSocial,
  sport: eventSport,
  culture: eventCulture,
};

const defaultFallback = heroTrekking;

/**
 * Resolves an event image_url to a displayable src.
 * - If it's a full URL (http/https), use as-is
 * - If it's a known key like "trekking", map to local asset
 * - Otherwise, use default fallback
 */
export const resolveEventImageSrc = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return defaultFallback;
  if (imageUrl.startsWith("http")) return imageUrl;
  return fallbackMap[imageUrl] || defaultFallback;
};

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fallbackKey?: string;
  width?: number;
  height?: number;
  eager?: boolean;
}

/**
 * Optimized image component with:
 * - Lazy loading by default
 * - Fallback on error
 * - Fade-in on load
 * - Supabase Storage transform support for thumbnails
 */
const OptimizedImage = memo(({ src, fallbackKey, className = "", alt = "", width, height, eager = false, ...props }: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(eager);
  const [error, setError] = useState(false);

  const resolvedSrc = error ? defaultFallback : resolveEventImageSrc(src);

  // For Supabase storage URLs, append transform params for thumbnails
  const optimizedSrc = (() => {
    if (!resolvedSrc.includes("supabase.co/storage") || !width) return resolvedSrc;
    const separator = resolvedSrc.includes("?") ? "&" : "?";
    return `${resolvedSrc}${separator}width=${width}&height=${height || width}&resize=cover&quality=75`;
  })();

  const handleError = useCallback(() => {
    if (!error) setError(true);
  }, [error]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      fetchPriority={eager ? "high" : undefined}
      onError={handleError}
      onLoad={handleLoad}
      className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      {...props}
    />
  );
});

OptimizedImage.displayName = "OptimizedImage";

export default OptimizedImage;
