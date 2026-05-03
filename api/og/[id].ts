const BOT_USER_AGENTS = [
  "whatsapp",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterest",
  "googlebot",
  "bingbot",
  "bot",
  "crawl",
  "spider",
  "opengraph",
  "iframely",
  "embedly",
];

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://etiynvukviykquqcsjln.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI";

export const config = {
  runtime: "edge",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function getEventId(pathname: string): string {
  const pathParts = pathname.split("/").filter(Boolean);
  return pathParts[pathParts.length - 1] || "";
}

function imageVersion(imageUrl: unknown): string {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) return "fallback";

  let hash = 0;
  for (let i = 0; i < imageUrl.length; i += 1) {
    hash = (hash * 31 + imageUrl.charCodeAt(i)) >>> 0;
  }

  return hash.toString(36);
}

async function getSpaHtml(origin: string): Promise<Response> {
  try {
    const spaResponse = await fetch(`${origin}/index.html`);
    const spaHtml = await spaResponse.text();

    return new Response(spaHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch {
    return new Response("", { status: 302, headers: { Location: "/" } });
  }
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const isBot = BOT_USER_AGENTS.some((bot) => userAgent.includes(bot));
  const eventId = getEventId(url.pathname);

  if (!isBot) {
    return getSpaHtml(url.origin);
  }

  if (!eventId) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(
        eventId
      )}&visibility=eq.public&select=title,description,image_url,date,location,location_label,organizer_name`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return new Response("Not found", { status: 404 });
    }

    const events = await res.json();
    if (!Array.isArray(events) || events.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    const event = events[0];
    const eventUrl = `${url.origin}/event/${eventId}`;
    const imageUrl = `${url.origin}/api/og-image/${encodeURIComponent(
      eventId
    )}?v=${imageVersion(event.image_url)}`;

    let formattedDate = "";
    if (event.date) {
      try {
        formattedDate = new Date(event.date).toLocaleDateString("it-IT", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch {
        formattedDate = event.date;
      }
    }

    const title = event.title || "Evento Scampagnate";
    const shortEventDescription =
      typeof event.description === "string" ? truncate(stripHtml(event.description), 180) : "";
    const description =
      shortEventDescription ||
      [formattedDate, event.location_label || event.location, event.organizer_name]
        .filter(Boolean)
        .join(" - ") ||
      "Scopri questo evento su Scampagnate";

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} - Scampagnate</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:site_name" content="Scampagnate" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(eventUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta property="og:locale" content="it_IT" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${escapeHtml(eventUrl)}">Vedi evento su Scampagnate</a>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
