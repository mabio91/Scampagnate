const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://etiynvukviykquqcsjln.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI";
const DEFAULT_IMAGE_PATH = "/pwa-512x512.png";
const SUPABASE_PUBLIC_STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`;

export const config = {
  runtime: "edge",
};

function getEventId(pathname: string): string {
  const pathParts = pathname.split("/").filter(Boolean);
  return pathParts[pathParts.length - 1] || "";
}

function contentTypeFromUrl(imageUrl: string): string {
  const pathname = new URL(imageUrl).pathname.toLowerCase();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function buildSupabasePublicUrl(imageValue: string): string {
  const cleanValue = imageValue.replace(/^\/+/, "");
  const storagePath = cleanValue.startsWith("event-images/")
    ? cleanValue
    : `event-images/${cleanValue}`;

  return `${SUPABASE_PUBLIC_STORAGE_PREFIX}${storagePath}`;
}

function resolveImageUrl(imageValue: unknown, origin: string): string {
  if (typeof imageValue !== "string" || !imageValue.trim()) {
    return `${origin}${DEFAULT_IMAGE_PATH}`;
  }

  const trimmed = imageValue.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${origin}${trimmed}`;
  }

  if (trimmed.includes("/") || trimmed.includes(".")) {
    return buildSupabasePublicUrl(trimmed);
  }

  return `${origin}${DEFAULT_IMAGE_PATH}`;
}

function buildTransformedSupabaseUrl(imageUrl: string): string {
  if (!imageUrl.startsWith(SUPABASE_PUBLIC_STORAGE_PREFIX)) {
    return imageUrl;
  }

  const url = new URL(imageUrl);
  url.pathname = url.pathname.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );
  url.searchParams.set("width", "1200");
  url.searchParams.set("height", "630");
  url.searchParams.set("resize", "cover");
  url.searchParams.set("quality", "85");

  return url.toString();
}

async function getEventImageUrl(eventId: string, origin: string): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(
      eventId
    )}&visibility=eq.public&select=image_url`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    return `${origin}${DEFAULT_IMAGE_PATH}`;
  }

  const events = await res.json();
  if (!Array.isArray(events) || events.length === 0) {
    return `${origin}${DEFAULT_IMAGE_PATH}`;
  }

  return resolveImageUrl(events[0]?.image_url, origin);
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const eventId = getEventId(url.pathname);

  if (!eventId) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const sourceImageUrl = await getEventImageUrl(eventId, url.origin);
    const preferredImageUrl = buildTransformedSupabaseUrl(sourceImageUrl);
    let imageResponse = await fetch(preferredImageUrl, {
      headers: { Accept: "image/avif,image/webp,image/jpeg,image/png,*/*" },
    });

    if (!imageResponse.ok && preferredImageUrl !== sourceImageUrl) {
      imageResponse = await fetch(sourceImageUrl);
    }

    if (!imageResponse.ok) {
      imageResponse = await fetch(`${url.origin}${DEFAULT_IMAGE_PATH}`);
    }

    if (!imageResponse.ok || !imageResponse.body) {
      return new Response("Image not found", { status: 404 });
    }

    return new Response(imageResponse.body, {
      status: 200,
      headers: {
        "Content-Type":
          imageResponse.headers.get("content-type") || contentTypeFromUrl(sourceImageUrl),
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
