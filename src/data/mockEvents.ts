export type EventCategory = 
  | "Trekking & Outdoor"
  | "Sport & Movimento"
  | "Social & Aperitivi"
  | "Esperienze & Cultura"
  | "Eventi Speciali";

export type EventStatus = "available" | "full" | "closed";
export type PaymentType = "free" | "paid" | "deposit";

export interface MeetingPoint {
  name: string;
  location: string;
  time: string;
  notes?: string;
}

export interface EventParticipant {
  name: string;
  avatar?: string;
  badge?: string;
}

export interface EventData {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: EventCategory;
  status: EventStatus;
  price: number;
  deposit?: number;
  paymentType: PaymentType;
  description: string;
  image: string;
  difficulty?: string;
  distance?: string;
  elevation?: string;
  duration?: string;
  spotsTotal: number;
  spotsTaken: number;
  featured?: boolean;
  meetingPoints: MeetingPoint[];
  participants: EventParticipant[];
  organizer: string;
}

export const categories: { name: EventCategory; icon: string; description: string }[] = [
  { name: "Trekking & Outdoor", icon: "mountain", description: "Escursioni, camminate e natura" },
  { name: "Sport & Movimento", icon: "dumbbell", description: "Padel, corsa e attività sportive" },
  { name: "Social & Aperitivi", icon: "wine", description: "Aperitivi, cene e serate sociali" },
  { name: "Esperienze & Cultura", icon: "landmark", description: "Visite guidate e workshop" },
  { name: "Eventi Speciali", icon: "sparkles", description: "Weekend, viaggi ed esperienze uniche" },
];

export const mockEvents: EventData[] = [
  {
    id: "1",
    title: "Trekking Monte Livata",
    date: "2026-03-15",
    time: "08:00",
    location: "Monte Livata, Lazio",
    category: "Trekking & Outdoor",
    status: "available",
    price: 15,
    paymentType: "deposit",
    deposit: 5,
    description: "Un'escursione panoramica tra i boschi del Monte Livata, con vista mozzafiato sulle valli laziali. Percorso adatto a escursionisti con un minimo di esperienza. Pranzo al sacco incluso nella quota.",
    image: "trekking",
    difficulty: "2",
    distance: "9 km",
    elevation: "450 m",
    duration: "4h",
    spotsTotal: 25,
    spotsTaken: 18,
    featured: true,
    meetingPoints: [
      { name: "Roma – Metro Anagnina", location: "Metro Anagnina, Roma", time: "08:00" },
      { name: "Parcheggio Monte Livata", location: "Parcheggio Monte Livata", time: "09:30" },
    ],
    participants: [
      { name: "Matteo" },
      { name: "Giulia" },
      { name: "Andrea" },
      { name: "Sara" },
      { name: "Marco" },
    ],
    organizer: "Gruppo Scampagnate",
  },
  {
    id: "2",
    title: "Aperitivo al Tramonto",
    date: "2026-03-20",
    time: "18:30",
    location: "Terrazza Romana, Roma",
    category: "Social & Aperitivi",
    status: "available",
    price: 25,
    paymentType: "paid",
    description: "Un aperitivo esclusivo su una terrazza panoramica nel cuore di Roma. Drink, stuzzichini e buona compagnia con vista sulla città eterna.",
    image: "social",
    spotsTotal: 30,
    spotsTaken: 22,
    meetingPoints: [
      { name: "Terrazza Romana", location: "Via dei Fori Imperiali 12, Roma", time: "18:30" },
    ],
    participants: [
      { name: "Francesca" },
      { name: "Luca" },
      { name: "Valentina" },
    ],
    organizer: "Gruppo Scampagnate",
  },
  {
    id: "3",
    title: "Torneo Padel Social",
    date: "2026-03-22",
    time: "10:00",
    location: "Padel Club Roma Sud",
    category: "Sport & Movimento",
    status: "available",
    price: 20,
    paymentType: "paid",
    description: "Torneo di padel amatoriale aperto a tutti i livelli. Squadre miste formate il giorno stesso. Pranzo e premiazione inclusi.",
    image: "sport",
    spotsTotal: 16,
    spotsTaken: 12,
    meetingPoints: [
      { name: "Padel Club Roma Sud", location: "Via Tuscolana 800, Roma", time: "10:00" },
    ],
    participants: [
      { name: "Roberto" },
      { name: "Elena" },
    ],
    organizer: "Gruppo Scampagnate",
  },
  {
    id: "4",
    title: "Visita Guidata Ostia Antica",
    date: "2026-03-28",
    time: "09:30",
    location: "Ostia Antica, Roma",
    category: "Esperienze & Cultura",
    status: "full",
    price: 0,
    paymentType: "free",
    description: "Una visita guidata gratuita al parco archeologico di Ostia Antica. Scopriamo insieme le meraviglie dell'antica Roma portuale.",
    image: "culture",
    duration: "3h",
    spotsTotal: 20,
    spotsTaken: 20,
    meetingPoints: [
      { name: "Ingresso Scavi", location: "Viale dei Romagnoli 717, Ostia", time: "09:30" },
    ],
    participants: [
      { name: "Chiara" },
      { name: "Paolo" },
    ],
    organizer: "Gruppo Scampagnate",
  },
  {
    id: "5",
    title: "Weekend in Tenda – Gran Sasso",
    date: "2026-04-05",
    time: "07:00",
    location: "Gran Sasso, Abruzzo",
    category: "Eventi Speciali",
    status: "available",
    price: 45,
    paymentType: "deposit",
    deposit: 15,
    description: "Un weekend all'insegna dell'avventura! Due giorni di trekking e campeggio nel cuore del Gran Sasso. Esperienza indimenticabile per gli amanti della natura.",
    image: "trekking",
    difficulty: "4",
    distance: "18 km",
    elevation: "900 m",
    duration: "2 giorni",
    spotsTotal: 15,
    spotsTaken: 8,
    meetingPoints: [
      { name: "Roma Tiburtina", location: "Stazione Tiburtina, Roma", time: "07:00" },
      { name: "Campo Imperatore", location: "Parcheggio Campo Imperatore", time: "09:30" },
    ],
    participants: [
      { name: "Alessandro" },
      { name: "Maria" },
      { name: "Giovanni" },
    ],
    organizer: "Gruppo Scampagnate",
  },
];
