
-- Enum types
CREATE TYPE public.event_status AS ENUM ('available', 'full', 'closed');
CREATE TYPE public.payment_type AS ENUM ('free', 'paid', 'deposit');
CREATE TYPE public.registration_status AS ENUM ('registered', 'paid', 'waitlist', 'cancelled');
CREATE TYPE public.app_role AS ENUM ('admin', 'organizer', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT,
  total_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Event categories
CREATE TABLE public.event_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.event_categories FOR SELECT USING (true);

-- Seed default categories
INSERT INTO public.event_categories (name, icon, description, sort_order) VALUES
('Trekking & Outdoor', '🏔', 'Escursioni, camminate e natura', 1),
('Sport & Movimento', '🏸', 'Padel, corsa e attività sportive', 2),
('Social & Aperitivi', '🥂', 'Aperitivi, cene e serate sociali', 3),
('Esperienze & Cultura', '🏛', 'Visite guidate e workshop', 4),
('Eventi Speciali', '✨', 'Weekend, viaggi ed esperienze uniche', 5);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  category_id UUID REFERENCES public.event_categories(id),
  status event_status NOT NULL DEFAULT 'available',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit NUMERIC(10,2),
  payment_type payment_type NOT NULL DEFAULT 'free',
  image_url TEXT,
  difficulty TEXT,
  distance TEXT,
  elevation TEXT,
  duration TEXT,
  spots_total INT NOT NULL DEFAULT 20,
  spots_taken INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  organizer_id UUID REFERENCES auth.users(id),
  organizer_name TEXT NOT NULL DEFAULT 'Gruppo Scampagnate',
  cancellation_policy TEXT,
  equipment_list JSONB,
  additional_fields JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Organizers can insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Organizers can update own events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = organizer_id);

-- Meeting points
CREATE TABLE public.event_meeting_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  time TIME NOT NULL,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.event_meeting_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view meeting points" ON public.event_meeting_points FOR SELECT USING (true);
CREATE POLICY "Organizers can manage meeting points" ON public.event_meeting_points FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = event_meeting_points.event_id AND events.organizer_id = auth.uid()));

-- Registrations
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meeting_point_id UUID REFERENCES public.event_meeting_points(id),
  status registration_status NOT NULL DEFAULT 'registered',
  payment_status TEXT DEFAULT 'pending',
  sport_level TEXT,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view registrations" ON public.event_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can register" ON public.event_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own registration" ON public.event_registrations FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Saved events (wishlist)
CREATE TABLE public.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved events" ON public.saved_events FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Badges
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  required_events INT NOT NULL DEFAULT 1,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT USING (true);

INSERT INTO public.badges (name, description, icon, required_events, category) VALUES
('Nuovo Arrivato', 'Primo evento frequentato', '🌱', 1, NULL),
('Scampagnatore', '3 eventi frequentati', '🥾', 3, NULL),
('Esploratore', '5 eventi frequentati', '🗺', 5, NULL),
('Avventuriero', '10 eventi frequentati', '⛰', 10, NULL),
('Veterano delle Scampagnate', '20 eventi frequentati', '🏆', 20, NULL),
('Leggenda delle Scampagnate', '50 eventi frequentati', '👑', 50, NULL),
('Alba Hunter', 'Partecipazione a eventi all''alba', '🌅', 1, 'special'),
('Re dell''Aperitivo', 'Partecipazione a eventi social', '🍸', 3, 'Social & Aperitivi'),
('Spirito d''Avventura', 'Partecipazione a eventi impegnativi', '🔥', 3, 'Trekking & Outdoor'),
('Anima della Community', 'Partecipante molto attivo', '💫', 15, NULL);

-- User badges
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "System can insert badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update spots_taken
CREATE OR REPLACE FUNCTION public.update_spots_taken()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.events SET spots_taken = (
      SELECT COUNT(*) FROM public.event_registrations 
      WHERE event_id = NEW.event_id AND status IN ('registered', 'paid')
    ) WHERE id = NEW.event_id;
    -- Auto-set to full if spots are filled
    UPDATE public.events SET status = 'full' 
    WHERE id = NEW.event_id AND spots_taken >= spots_total AND status = 'available';
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET spots_taken = (
      SELECT COUNT(*) FROM public.event_registrations 
      WHERE event_id = OLD.event_id AND status IN ('registered', 'paid')
    ) WHERE id = OLD.event_id;
    -- Re-open if spots available
    UPDATE public.events SET status = 'available'
    WHERE id = OLD.event_id AND spots_taken < spots_total AND status = 'full';
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_registration_change
  AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_spots_taken();
