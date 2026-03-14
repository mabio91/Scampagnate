import { NextRequest, NextResponse } from "next/server";

const BOT_USER_AGENTS = [
  "whatsapp",
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
  "Pinterest",
  "Googlebot",
  "bingbot",
];

export const config = {
  matcher: "/event/:id*",
};

export default async function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const isBot = BOT_USER_AGENTS.some((bot) =>
    ua.toLowerCase().includes(bot.toLowerCase())
  );

  if (!isBot) {
    return NextResponse.next();
  }

  // Extract event ID from path: /event/{id}
  const pathParts = req.nextUrl.pathname.split("/");
  const eventId = pathParts[2];
  if (!eventId) return NextResponse.next();

  try {
    const SUPABASE_URL = "https://etiynvukviykquqcsjln.supabase.co";
    const SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI";

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=title,description,image_url,date,location,organizer_name`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) return NextResponse.next();

    const events = await res.json();
    if (!events || events.length === 0) return NextResponse.next();

    const event = events[0];
    const baseUrl = "https://scampagnate.vercel.app";
    const eventUrl = `${baseUrl}/event/${eventId}`;

    // Resolve image URL
    let imageUrl = `${baseUrl}/pwa-512x512.png`;
    if (event.image_url) {
      if (event.image_url.startsWith("http")) {
        imageUrl = event.image_url;
      }
    }

    // Format date
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
    const description =
      [formattedDate, event.location, event.organizer_name]
        .filter(Boolean)
        .join(" · ") ||
      event.description?.substring(0, 160) ||
      "Scopri questo evento su Scampagnate";

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)} – Scampagnate</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:site_name" content="Scampagnate" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${eventUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="it_IT" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${eventUrl}">Vedi evento su Scampagnate</a>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.next();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
