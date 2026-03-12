import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = "https://etiynvukviykquqcsjln.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const siteUrl = "https://scampagnate.techyfux.com";
  const eventUrl = `${siteUrl}/event/${id}`;
  const fallbackImage = `${siteUrl}/pwa-512x512.png`;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/events?id=eq.${id}&select=title,description,image_url,date,location`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await response.json();
    const event = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!event) {
      return res.redirect(302, eventUrl);
    }

    const title = event.title || "Evento Scampagnate";
    const description = event.description
      ? event.description.substring(0, 200)
      : "Scopri questo evento su Scampagnate";
    const image = event.image_url || fallbackImage;

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} – Scampagnate</title>
  <meta name="description" content="${escapeHtml(description)}" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Scampagnate" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(eventUrl)}" />
  <meta property="og:locale" content="it_IT" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  
  <!-- Redirect real users to SPA -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(eventUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(eventUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(html);
  } catch {
    return res.redirect(302, eventUrl);
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
