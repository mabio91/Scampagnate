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
  "bot",
  "crawl",
  "spider",
  "curl",
  "wget",
  "python-requests",
  "OpenGraph",
  "Iframely",
  "embedly",
];

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

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const ua = req.headers.get("user-agent") || "";
  const isBot = BOT_USER_AGENTS.some((bot) =>
    ua.toLowerCase().includes(bot.toLowerCase())
  );

  // Extract event ID from the path: /api/og/[id]
  const pathParts = url.pathname.split("/");
  const eventId = pathParts[pathParts.length - 1];

  if (!eventId) {
    return Response.redirect(`${url.origin}/event/${eventId || ""}`, 302);
  }

  // For non-bots, redirect to the SPA
  if (!isBot) {
    return Response.redirect(`${url.origin}/event/${eventId}`, 302);
  }

  try {
    const SUPABASE_URL = "https://etiynvukviykquqcsjln.supabase.co";
    const SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI";

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&visibility=eq.public&select=title,description,image_url,date,location,organizer_name`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return Response.redirect(`${url.origin}/event/${eventId}`, 302);
    }

    const events = await res.json();
    if (!events || events.length === 0) {
      return Response.redirect(`${url.origin}/event/${eventId}`, 302);
    }

    const event = events[0];
    const baseUrl = url.origin;
    const eventUrl = `${baseUrl}/event/${eventId}`;

    let imageUrl = `${baseUrl}/pwa-512x512.png`;
    if (event.image_url) {
      if (event.image_url.startsWith("http")) {
        imageUrl = event.image_url;
      }
    }

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

  <meta http-equiv="refresh" content="0;url=${eventUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${eventUrl}">Vedi evento su Scampagnate</a>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.redirect(`${url.origin}/event/${eventId}`, 302);
  }
}
