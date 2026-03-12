import { NextRequest, NextResponse } from 'next/server';

const BOT_USER_AGENTS = [
  'whatsapp',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'discord',
  'googlebot',
  'bingbot',
];

export const config = {
  matcher: '/event/:id*',
};

export default function middleware(req: NextRequest) {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  const isBot = BOT_USER_AGENTS.some((bot) => ua.includes(bot));

  if (!isBot) {
    return NextResponse.next();
  }

  // Extract event ID from path: /event/uuid
  const parts = req.nextUrl.pathname.split('/');
  const eventId = parts[2];

  if (!eventId) {
    return NextResponse.next();
  }

  // Rewrite bot requests to API route that serves OG meta tags
  const apiUrl = new URL(`/api/event/${eventId}`, req.url);
  return NextResponse.rewrite(apiUrl);
}
