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
const supabaseObjectPublicPath = "/storage/v1/object/public/";
const supabaseRenderPublicPath = "/storage/v1/render/image/public/";
const transformQueryNames = new Set(["width", "height", "resize", "quality", "format"]);

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

export const resolveSupabaseImageTransformSrc = (
  imageUrl: string,
  width?: number,
  height?: number,
  quality = 75,
): string => {
  if (!width || !imageUrl.includes("supabase.co/storage/v1/")) return imageUrl;

  try {
    const url = new URL(imageUrl);
    if (!url.hostname.includes("supabase.co")) return imageUrl;

    if (url.pathname.includes(supabaseObjectPublicPath)) {
      url.pathname = url.pathname.replace(supabaseObjectPublicPath, supabaseRenderPublicPath);
    } else if (!url.pathname.includes(supabaseRenderPublicPath)) {
      return imageUrl;
    }

    transformQueryNames.forEach((name) => url.searchParams.delete(name));
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height || width));
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", String(quality));
    return url.toString();
  } catch {
    return imageUrl;
  }
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

  const optimizedSrc = resolveSupabaseImageTransformSrc(resolvedSrc, width, height);

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
