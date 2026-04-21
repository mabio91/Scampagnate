/**
 * Centralized Italian UI labels — single source of truth.
 * All user-facing text must reference these constants.
 */
export const UI_LABELS = {
  // Sections
  featuredEvent: "Evento in evidenza",
  recommended: "Consigliati per te",
  recommendedSubtitle: "In base al tuo profilo",
  upcomingEvents: "Prossimi eventi",
  thisWeek: "Questa settimana",
  later: "Più avanti",

  // Quick Filters
  filterFeatured: "In evidenza",
  filterLastSpots: "Ultimi posti",
  filterThisWeek: "Questa settimana",
  filterNextWeek: "Prossima settimana",
  filterWeekend: "Weekend",

  // Event States
  open: "Aperto",
  almostFull: "Quasi completo",
  full: "Completo",
  closed: "Chiuso",
  draft: "Bozza",
  cancelled: "Cancellato",
  past: "Passato",

  // Card statuses (user-facing labels)
  statusOpen: "Aperto",
  statusWaitlist: "In attesa",
  statusSpotAvailable: "Posto disponibile",
  statusComingSoon: "In arrivo",
  statusJoined: "Iscritto ✓",
  statusClosed: "Chiuso",
  statusAttended: "Partecipato",

  // Image badges
  badgeSoldOut: "Sold Out",
  badgePromo: "Promo",

  // Urgency badges (hero only — pick highest priority)
  urgencyLastSpots: "Ultimi posti",
  urgencyAlmostFull: "Quasi completo",
  urgencyTopEvent: "Evento top",
  urgencyFree: "Gratuito",

  // Countdown
  today: "Oggi",
  tomorrow: "Domani",
  inDays: (n: number) => `Tra ${n} giorni`,

  // CTA
  discover: "Scopri",
  joinNow: "Partecipa ora",
  proposeActivity: "Proponi attività",
  showAll: "Mostra tutti",
  exploreEvents: "Esplora eventi",

  // Proposal card
  proposalTitle: "Hai un'idea per una nuova attività?",
  proposalSubtitle: "Proponila alla community!",

  // Empty states
  noEventsTitle: "Nessun evento disponibile al momento",
  noEventsDesc: "Torna presto o proponi tu una nuova attività",
  noResultsTitle: "Nessun evento corrisponde ai filtri selezionati",
  noResultsDesc: "Prova a cambiare categoria o a rimuovere alcuni filtri",

  // Pricing
  free: "Gratuito",
  priceFrom: (p: number) => `Da €${p}`,

  // Compatibility
  compatHigh: "Ottima compatibilità",
  compatMedium: "Buona compatibilità",
  compatLow: "Bassa compatibilità",

  // Social proof
  popularEvent: "Evento popolare",

  // Generic
  all: "Tutti",
  participants: "Partecipanti",

  // Registration not open yet
  registrationNotOpenYet: "Le prenotazioni apriranno a breve.\nTorna presto per assicurarti un posto.",
} as const;
