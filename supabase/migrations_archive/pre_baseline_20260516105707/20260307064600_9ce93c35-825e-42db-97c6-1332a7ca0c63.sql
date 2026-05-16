
-- Seed events
INSERT INTO public.events (title, description, date, time, location, category_id, status, price, deposit, payment_type, image_url, difficulty, distance, elevation, duration, spots_total, spots_taken, featured, organizer_name, cancellation_policy)
VALUES
('Trekking Monte Livata', 'Un''escursione panoramica tra i boschi del Monte Livata, con vista mozzafiato sulle valli laziali.', '2026-03-15', '08:00:00'::time, 'Monte Livata, Lazio', '0c22cf50-75d0-48e6-9c33-38235a3f22be', 'available', 15, 5, 'deposit', 'trekking', 'Moderato', '9 km', '450 m', '4h', 25, 0, true, 'Gruppo Scampagnate', 'Cancellazione gratuita fino a 24h prima'),
('Aperitivo al Tramonto', 'Un aperitivo esclusivo su una terrazza panoramica nel cuore di Roma.', '2026-03-20', '18:30:00'::time, 'Terrazza Romana, Roma', '6512aa7e-8850-4696-bebb-1f18500fe777', 'available', 25, NULL, 'paid', 'social', NULL, NULL, NULL, NULL, 30, 0, false, 'Gruppo Scampagnate', NULL),
('Torneo Padel Social', 'Torneo di padel amatoriale aperto a tutti i livelli.', '2026-03-22', '10:00:00'::time, 'Padel Club Roma Sud', 'd2b0aeb5-2234-4a76-af91-5114536d9132', 'available', 20, NULL, 'paid', 'sport', NULL, NULL, NULL, NULL, 16, 0, false, 'Gruppo Scampagnate', NULL),
('Visita Guidata Ostia Antica', 'Una visita guidata gratuita al parco archeologico di Ostia Antica.', '2026-03-28', '09:30:00'::time, 'Ostia Antica, Roma', '756c1cf0-29a4-40b7-a2a0-e5dbd67cb4cd', 'available', 0, NULL, 'free', 'culture', NULL, NULL, NULL, '3h', 20, 0, false, 'Gruppo Scampagnate', NULL),
('Weekend in Tenda – Gran Sasso', 'Un weekend all''insegna dell''avventura nel cuore del Gran Sasso.', '2026-04-05', '07:00:00'::time, 'Gran Sasso, Abruzzo', 'f82bd870-4eaa-4edc-ae1e-bde23b090fd5', 'available', 45, 15, 'deposit', 'trekking', 'Impegnativo', '18 km', '900 m', '2 giorni', 15, 0, false, 'Gruppo Scampagnate', 'Acconto non rimborsabile dopo 48h');

-- Meeting points
INSERT INTO public.event_meeting_points (event_id, name, location, time, sort_order)
SELECT e.id, 'Roma – Metro Anagnina', 'Metro Anagnina, Roma', '08:00:00'::time, 1 FROM public.events e WHERE e.title = 'Trekking Monte Livata'
UNION ALL SELECT e.id, 'Parcheggio Monte Livata', 'Parcheggio Monte Livata', '09:30:00'::time, 2 FROM public.events e WHERE e.title = 'Trekking Monte Livata'
UNION ALL SELECT e.id, 'Terrazza Romana', 'Via dei Fori Imperiali 12, Roma', '18:30:00'::time, 1 FROM public.events e WHERE e.title = 'Aperitivo al Tramonto'
UNION ALL SELECT e.id, 'Padel Club Roma Sud', 'Via Tuscolana 800, Roma', '10:00:00'::time, 1 FROM public.events e WHERE e.title = 'Torneo Padel Social'
UNION ALL SELECT e.id, 'Ingresso Scavi', 'Viale dei Romagnoli 717, Ostia', '09:30:00'::time, 1 FROM public.events e WHERE e.title = 'Visita Guidata Ostia Antica'
UNION ALL SELECT e.id, 'Roma Tiburtina', 'Stazione Tiburtina, Roma', '07:00:00'::time, 1 FROM public.events e WHERE e.title = 'Weekend in Tenda – Gran Sasso'
UNION ALL SELECT e.id, 'Campo Imperatore', 'Parcheggio Campo Imperatore', '09:30:00'::time, 2 FROM public.events e WHERE e.title = 'Weekend in Tenda – Gran Sasso';
